// src/index.ts
import fastifyPlugin from "fastify-plugin";

// src/crypto/Hmac.ts
import crypto from "crypto";

// src/utils/buffer.ts
var asBuffer = (maybeBuffer, encoding = "ascii") => Buffer.isBuffer(maybeBuffer) ? maybeBuffer : Buffer.from(maybeBuffer, encoding);

// src/utils/crypto.ts
var CRYPTO_SPLIT_CHAR = ".";

// src/utils/error.ts
var ErrorWithCode = class extends Error {
  code;
  constructor(code, message) {
    super(`${code}: ${message}`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.code = code;
  }
};
var createError = (code, message) => new ErrorWithCode(code, message);

// src/crypto/Hmac.ts
var Hmac = class {
  protocol = "/hmac";
  stateless = false;
  algorithm;
  encoding;
  constructor(encoding = "base64", algorithm = "sha256") {
    this.encoding = encoding;
    this.algorithm = algorithm;
  }
  deriveSecretKeys(key, secret) {
    if (key) {
      return sanitizeSecretKeys(key, this.encoding);
    } else if (secret) {
      return [asBuffer(secret)];
    }
    throw createError("SecretKeyDerivation", "Failed to derive keys from options");
  }
  sealMessage(message, secretKey) {
    return message.toString(this.encoding) + CRYPTO_SPLIT_CHAR + crypto.createHmac(this.algorithm, secretKey).update(message).digest(this.encoding).replace(/=+$/, "");
  }
  unsealMessage(message, secretKeys) {
    const splitCharIndex = message.lastIndexOf(CRYPTO_SPLIT_CHAR);
    if (splitCharIndex === -1) {
      throw createError("MalformedMessageError", "The message is malformed");
    }
    const cleartext = Buffer.from(message.slice(0, splitCharIndex), this.encoding);
    let rotated = false;
    const success = secretKeys.some((secretKey, index) => {
      const signedBuffer = Buffer.from(this.sealMessage(cleartext, secretKey));
      const messageBuffer = Buffer.alloc(signedBuffer.length);
      messageBuffer.write(message);
      const verified = crypto.timingSafeEqual(signedBuffer, messageBuffer);
      rotated = verified && index > 0;
      return verified;
    });
    if (!success) {
      throw createError("VerifyError", "Unable to verify");
    }
    return { buffer: cleartext, rotated };
  }
};
var HMAC = new Hmac();
var sanitizeSecretKeys = (key, encoding = "base64") => {
  const secretKeys = Array.isArray(key) ? key.map((v) => asBuffer(v, encoding)) : [asBuffer(key, encoding)];
  return secretKeys;
};

// src/crypto/SessionCrypto.ts
var SessionCrypto = class {
};

// src/session/Session.ts
import { nanoid } from "nanoid";
import assert from "assert";

// src/store/MemoryStore.ts
import { EventEmitter } from "events";
var MemoryStore = class extends EventEmitter {
  store;
  prefix;
  constructor({ store = /* @__PURE__ */ new Map(), prefix = "sess:" } = {}) {
    super();
    this.store = store;
    this.prefix = prefix;
  }
  getKey(sessionId) {
    return `${this.prefix}${sessionId}`;
  }
  async set(sessionId, session, expiry = null) {
    this.store.set(this.getKey(sessionId), [session, expiry]);
  }
  async get(sessionId) {
    const result = this.store.get(this.getKey(sessionId)) ?? null;
    if (!result) {
      return null;
    }
    const [session, expiry] = result;
    if (expiry && expiry <= Date.now()) {
      return null;
    }
    return [session, expiry];
  }
  async destroy(sessionId) {
    this.store.delete(this.getKey(sessionId));
  }
  async touch(sessionId, expiry = null) {
    const sessionData = await this.get(sessionId);
    if (!sessionData) {
      return;
    }
    const [session] = sessionData;
    this.set(sessionId, session, expiry);
  }
  async all() {
    return [...this.store.entries()].reduce((soFar, [k, v]) => {
      soFar[k] = v[0];
      return soFar;
    }, {});
  }
};
var MEMORY_STORE = new MemoryStore();

// src/store/StatelessStore.ts
var StatelessStore = class {
  serialize;
  deserialize;
  useId;
  constructor({
    serialize = async (session) => Buffer.from(JSON.stringify(session)),
    deserialize = async (session) => JSON.parse(session.toString()),
    useId = true
  } = {}) {
    this.serialize = serialize;
    this.deserialize = deserialize;
    this.useId = useId;
  }
  async get() {
    return null;
  }
  async set() {
  }
  async destroy() {
  }
};
var STATELESS_STORE = new StatelessStore();

// src/store/SessionStore.ts
var SessionStore = class {
};

// src/session/Session.ts
var kSessionData = Symbol("kSessionData");
var kCookieOptions = Symbol("kCookieOptions");
var Session = class _Session {
  // Session metadata
  id;
  created = false;
  rotated = false;
  changed = false;
  deleted = false;
  saved = false;
  skipped = false;
  // Private instance fields
  #sessionData;
  #cookieOptions;
  #expiry = null;
  // expiration timestamp in ms
  // Private static fields
  static #secretKeys;
  static #sessionCrypto;
  static #sessionStore;
  static #globalCookieOptions;
  static #configured = false;
  /**
   * This method is used to setup the Session class with global options.
   */
  static configure({
    secretKeys,
    crypto: crypto2 = HMAC,
    store,
    cookieOptions = {}
  }) {
    _Session.#secretKeys = secretKeys;
    _Session.#sessionCrypto = crypto2;
    _Session.#sessionStore = store || (crypto2.stateless ? STATELESS_STORE : MEMORY_STORE);
    _Session.#globalCookieOptions = cookieOptions;
    _Session.#configured = true;
  }
  /**
   * Private constructor - instances should be created via the static `create` method
   */
  constructor(data, options = {}) {
    const { id = _Session.#sessionStore.useId ? nanoid() : void 0, ...cookieOptions } = options;
    this.#sessionData = data || {};
    this.#cookieOptions = { ..._Session.#globalCookieOptions, ...cookieOptions };
    this.id = id;
    this.created = !data;
  }
  /**
   * Create a new session instance.
   * Checks if the class is configured before creating a session.
   */
  static async create(data, options = {}) {
    if (!_Session.#configured) {
      throw createError(
        "MissingConfiguration",
        "Session is not configured. Please call Session.configure before creating a Session instance."
      );
    }
    const session = new _Session(data, options);
    await session.touch();
    return session;
  }
  /**
   * Decoding
   */
  /**
   * Create a Session from a serialized cookie.
   * Determines the type of the session (stateful/stateless) and delegates to the appropriate method.
   */
  static async fromCookie(cookie) {
    const { buffer, rotated } = _Session.#sessionCrypto.unsealMessage(cookie, _Session.#secretKeys);
    if (_Session.#sessionCrypto.stateless) {
      return await _Session.fromStatelessCookie(buffer, rotated);
    }
    return await _Session.fromStatefulCookie(buffer.toString(), rotated);
  }
  /**
   * Create a Session from a stateless cookie. The session data is all stored in the cookie.
   */
  static async fromStatelessCookie(payload, rotated) {
    let data;
    try {
      data = await _Session.#sessionStore.deserialize(payload);
    } catch (error) {
      throw createError(
        "InvalidData",
        "Failed to parse session data from cookie. Original error: " + error
      );
    }
    const session = await _Session.create(data, _Session.#sessionStore.useId ? { id: data.id } : void 0);
    session.rotated = rotated;
    return session;
  }
  /**
   * Create a Session from a stateful cookie. The cookie only contains the session id.
   * The rest of the session data is retrieved from the session store.
   */
  static async fromStatefulCookie(sessionId, rotated) {
    assert(_Session.#sessionStore);
    const result = await _Session.#sessionStore.get(sessionId);
    if (!result) {
      throw createError("SessionNotFound", "did not found a matching session in the store");
    }
    const [data, expiry] = result;
    if (expiry && expiry <= Date.now()) {
      throw createError("ExpiredSession", "the store returned an expired session");
    }
    const session = await _Session.create(data, {
      id: sessionId,
      expires: expiry ? new Date(expiry) : void 0
    });
    session.rotated = rotated;
    return session;
  }
  /**
   * Encoding
   */
  /**
   * Serialize the Session into a cookie.
   * The format of the cookie depends on whether the session is stateful or stateless.
   */
  async toCookie() {
    if (!_Session.#secretKeys[0]) {
      throw createError("MissingSecretKey", "Missing secret key for session encryption");
    }
    const buffer = _Session.#sessionCrypto.stateless ? await _Session.#sessionStore.serialize(_Session.#sessionStore.useId ? {
      ...this.#sessionData,
      id: this.id
    } : this.#sessionData) : Buffer.from(this.id);
    return _Session.#sessionCrypto.sealMessage(buffer, _Session.#secretKeys[0]);
  }
  /**
   * Refresh the expiration time of the session. Only applicable for stateful sessions.
   */
  async touch() {
    if (_Session.#sessionCrypto.stateless) {
      return;
    }
    const { maxAge = _Session.#globalCookieOptions.maxAge, expires = _Session.#globalCookieOptions.expires } = this.#cookieOptions;
    if (maxAge) {
      const expiry = Date.now() + maxAge * 1e3;
      this.#expiry = expires ? Math.max(expires.getTime(), expiry) : expiry;
    } else if (expires) {
      this.#expiry = expires.getTime();
    }
    assert(_Session.#sessionStore);
    if (!this.created && _Session.#sessionStore.touch) {
      await _Session.#sessionStore.touch(this.id, this.#expiry);
    }
  }
  /**
   * Delete the session.
   */
  async destroy() {
    this.deleted = true;
    if (_Session.#sessionCrypto.stateless) {
      return;
    }
    if (this.created && !this.saved) {
      return;
    }
    assert(_Session.#sessionStore);
    await _Session.#sessionStore.destroy(this.id);
  }
  /**
   * Save the session data to the session store. Only applicable for stateful sessions.
   */
  async save() {
    if (_Session.#sessionCrypto.stateless) {
      return;
    }
    this.saved = true;
    assert(_Session.#sessionStore);
    await _Session.#sessionStore.set(this.id, this.#sessionData, this.#expiry);
  }
  get data() {
    return this.#sessionData;
  }
  get expiry() {
    return this.#expiry;
  }
  /**
   * Get a value from the session data.
   */
  get(key) {
    return this.#sessionData[key];
  }
  set(key, value) {
    this.#sessionData[key] = value;
    this.changed = true;
  }
  get options() {
    return this.#cookieOptions;
  }
  /**
   * Update the session cookie options.
   */
  setOptions(options) {
    Object.assign(this.#cookieOptions, options);
  }
  /**
   * Check if the session data is empty.
   */
  isEmpty() {
    return Object.keys(this.#sessionData).length === 0;
  }
};

// src/plugin.ts
var DEFAULT_COOKIE_NAME = "Session";
var DEFAULT_COOKIE_PATH = "/";
var plugin = async (fastify, options = {}) => {
  const {
    key,
    secret,
    salt,
    cookieName = DEFAULT_COOKIE_NAME,
    cookie: cookieOptions = {},
    store,
    crypto: crypto2 = HMAC,
    saveUninitialized = true,
    logBindings = { plugin: "fastify-session" }
  } = options;
  if (!key && !secret) {
    throw new Error("key or secret must specified");
  }
  if (!crypto2) {
    throw new Error("invalid crypto specified");
  }
  if (!cookieOptions.path) {
    cookieOptions.path = DEFAULT_COOKIE_PATH;
  }
  const secretKeys = crypto2.deriveSecretKeys(key, secret, salt);
  Session.configure({ cookieOptions, secretKeys, store, crypto: crypto2 });
  fastify.decorateRequest("session", null);
  async function destroySession() {
    if (!this.session) {
      return;
    }
    await this.session.destroy();
  }
  fastify.decorateRequest("destroySession", destroySession);
  fastify.addHook("onRequest", async (request) => {
    const { cookies, log } = request;
    const bindings = { ...logBindings, hook: "onRequest" };
    const cookie = cookies[cookieName];
    if (!cookie) {
      request.session = await Session.create();
      log.debug(
        { ...bindings, sessionId: request.session.id },
        "There was no cookie, created an empty session"
      );
      return;
    }
    try {
      log.debug(bindings, "Found an existing cookie, attempting to decode session ...");
      request.session = await Session.fromCookie(cookie);
      log.debug({ ...bindings, sessionId: request.session.id }, "Session successfully decoded");
      return;
    } catch (err) {
      request.session = await Session.create();
      log.warn(
        { ...bindings, err, sessionId: request.session.id },
        `Failed to decode existing cookie, created an empty session`
      );
      return;
    }
  });
  fastify.addHook("onSend", async (request, reply) => {
    const { session, log } = request;
    const bindings = { ...logBindings, hook: "onSend" };
    if (!session) {
      log.debug(bindings, "There was no session, leaving it as is");
      return;
    } else if (session.deleted) {
      reply.setCookie(cookieName, "", {
        ...session.options,
        expires: /* @__PURE__ */ new Date(0),
        maxAge: 0
      });
      log.debug(
        { ...bindings, sessionId: session.id },
        `Deleted ${session.created ? "newly created" : "existing"} session`
      );
      return;
    } else if (!saveUninitialized && session.isEmpty()) {
      log.debug(
        { ...bindings, sessionId: session.id },
        "Created session is empty and won't be saved, leaving it as is"
      );
      return;
    } else if (!session.changed && !session.created && !session.rotated) {
      log.debug(
        { ...bindings, sessionId: session.id },
        "The existing session was not changed, leaving it as is"
      );
      return;
    } else if (session.skipped) {
      log.debug({ ...bindings, sessionId: session.id }, "Skipped session");
      return;
    }
    if (session.created || session.changed) {
      log.debug(
        { ...bindings, sessionId: session.id },
        `About to save a ${session.created ? "created" : "changed"} session, saving ...`
      );
      await session.save();
      log.debug(
        { ...bindings, sessionId: session.id },
        `${session.created ? "Created" : "Changed"} session successfully saved`
      );
    }
    reply.setCookie(cookieName, await session.toCookie(), session.options);
  });
};

// src/index.ts
var src_default = fastifyPlugin(plugin, {
  fastify: "4.x",
  name: "fastify-session"
});
export {
  CRYPTO_SPLIT_CHAR,
  ErrorWithCode,
  HMAC,
  Hmac,
  MemoryStore,
  Session,
  SessionCrypto,
  SessionStore,
  StatelessStore,
  createError,
  src_default as default
};
//# sourceMappingURL=index.js.map