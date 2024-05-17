import * as fastify from 'fastify';
import { CookieSerializeOptions } from '@fastify/cookie';
import { BinaryToTextEncoding } from 'crypto';
import { EventEmitter } from 'events';

type SecretKey = Buffer | string | (Buffer | string)[];
declare abstract class SessionCrypto {
    abstract readonly protocol: string;
    abstract readonly stateless: boolean;
    abstract deriveSecretKeys(key?: SecretKey, secret?: Buffer | string, salt?: Buffer | string): Buffer[];
    abstract sealMessage(message: Buffer, secretKey: Buffer): string;
    abstract unsealMessage(message: string, secretKeys: Buffer[]): {
        buffer: Buffer;
        rotated: boolean;
    };
}

declare class Hmac implements SessionCrypto {
    readonly protocol = "/hmac";
    readonly stateless = false;
    private readonly algorithm;
    private readonly encoding;
    constructor(encoding?: BinaryToTextEncoding, algorithm?: string);
    deriveSecretKeys(key?: SecretKey, secret?: Buffer | string): Buffer[];
    sealMessage(message: Buffer, secretKey: Buffer): string;
    unsealMessage(message: string, secretKeys: Buffer[]): {
        buffer: Buffer;
        rotated: boolean;
    };
}
declare const HMAC: Hmac;

type SessionConfiguration = {
    cookieOptions?: CookieSerializeOptions;
    crypto?: SessionCrypto;
    store?: SessionStore | undefined;
    secretKeys: Buffer[];
};
type SessionOptions = CookieSerializeOptions & {
    id?: string;
};
/**
 * The Session class is responsible for managing user session data.
 * It can operate in a stateful or stateless mode depending on the configuration.
 */
declare class Session<T extends SessionData = SessionData> {
    #private;
    readonly id: string | undefined;
    created: boolean;
    rotated: boolean;
    changed: boolean;
    deleted: boolean;
    saved: boolean;
    skipped: boolean;
    /**
     * This method is used to setup the Session class with global options.
     */
    static configure({ secretKeys, crypto, store, cookieOptions }: SessionConfiguration): void;
    /**
     * Private constructor - instances should be created via the static `create` method
     */
    private constructor();
    /**
     * Create a new session instance.
     * Checks if the class is configured before creating a session.
     */
    static create<T extends SessionData = SessionData>(data?: Partial<T>, options?: SessionOptions): Promise<Session>;
    /**
     * Decoding
     */
    /**
     * Create a Session from a serialized cookie.
     * Determines the type of the session (stateful/stateless) and delegates to the appropriate method.
     */
    static fromCookie(cookie: string): Promise<Session>;
    /**
     * Create a Session from a stateless cookie. The session data is all stored in the cookie.
     */
    private static fromStatelessCookie;
    /**
     * Create a Session from a stateful cookie. The cookie only contains the session id.
     * The rest of the session data is retrieved from the session store.
     */
    private static fromStatefulCookie;
    /**
     * Encoding
     */
    /**
     * Serialize the Session into a cookie.
     * The format of the cookie depends on whether the session is stateful or stateless.
     */
    toCookie(): Promise<string>;
    /**
     * Refresh the expiration time of the session. Only applicable for stateful sessions.
     */
    touch(): Promise<void>;
    /**
     * Delete the session.
     */
    destroy(): Promise<void>;
    /**
     * Save the session data to the session store. Only applicable for stateful sessions.
     */
    save(): Promise<void>;
    get data(): SessionData;
    get expiry(): number | null;
    /**
     * Get a value from the session data.
     */
    get<K extends keyof T = keyof T>(key: K): T[K] | undefined;
    set<K extends keyof T = keyof T>(key: K, value: T[K]): void;
    get options(): CookieSerializeOptions;
    /**
     * Update the session cookie options.
     */
    setOptions(options: CookieSerializeOptions): void;
    /**
     * Check if the session data is empty.
     */
    isEmpty(): boolean;
}

declare module "fastify" {
    interface FastifyRequest {
        session: Session;
        destroySession: () => Promise<void>;
    }
}

/**
Matches a JSON object.

This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. Don't use this as a direct return type as the user would have to double-cast it: `jsonObject as unknown as CustomResponse`. Instead, you could extend your CustomResponse type from it to ensure your type only uses JSON-compatible types: `interface CustomResponse extends JsonObject { … }`.

@category JSON
*/
type JsonObject = {
    [Key in string]?: JsonValue | undefined;
};
/**
Matches a JSON array.

@category JSON
*/
type JsonArray = JsonValue[];
/**
Matches any valid JSON primitive value.

@category JSON
*/
type JsonPrimitive = string | number | boolean | null;
/**
Matches any valid JSON value.

@see `Jsonify` if you need to transform a type to one that is assignable to `JsonValue`.

@category JSON
*/
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * This interface allows you to declare additional properties on your session object
 * using [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html).
 *
 * @example
 * declare module '@mgcrea/fastify-session' {
 *     interface SessionData {
 *         views: number;
 *     }
 * }
 *
 */
interface SessionData extends JsonObject {
}

declare abstract class SessionStore {
    abstract get(sid: string): Promise<[SessionData, number | null] | null>;
    abstract set(sid: string, session: SessionData, expiry?: number | null): Promise<void>;
    abstract destroy(sid: string): Promise<void>;
    all?(): Promise<SessionData[] | {
        [sid: string]: SessionData;
    } | null>;
    length?(): Promise<number>;
    clear?(): Promise<void>;
    touch?(sid: string, expiry?: number | null): Promise<void>;
}

type StoredData<T> = [T, number | null];
type MemoryStoreOptions<T> = {
    store?: Map<string, StoredData<T>>;
    prefix?: string;
};
declare class MemoryStore<T extends SessionData = SessionData> extends EventEmitter implements SessionStore {
    private store;
    private readonly prefix;
    constructor({ store, prefix }?: MemoryStoreOptions<T>);
    private getKey;
    set(sessionId: string, session: T, expiry?: number | null): Promise<void>;
    get(sessionId: string): Promise<[T, number | null] | null>;
    destroy(sessionId: string): Promise<void>;
    touch(sessionId: string, expiry?: number | null): Promise<void>;
    all(): Promise<{
        [sid: string]: SessionData;
    }>;
}

type StatelessStoreOptions<T> = {
    serialize?: (session: T) => Promise<Buffer>;
    deserialize?: (session: Buffer) => Promise<T>;
    useId?: boolean;
};
declare class StatelessStore<T extends SessionData = SessionData> implements SessionStore {
    readonly serialize: (session: T) => Promise<Buffer>;
    readonly deserialize: (session: Buffer) => Promise<T>;
    readonly useId: boolean;
    constructor({ serialize, deserialize, useId }?: StatelessStoreOptions<T>);
    get(): Promise<[T, number | null] | null>;
    set(): Promise<void>;
    destroy(): Promise<void>;
}

type FastifySessionOptions = {
    salt?: Buffer | string;
    secret?: Buffer | string;
    key?: SecretKey;
    cookieName?: string;
    cookie?: CookieSerializeOptions;
    store?: SessionStore;
    crypto?: SessionCrypto;
    saveUninitialized?: boolean;
    logBindings?: Record<string, unknown>;
};

declare const CRYPTO_SPLIT_CHAR = ".";

declare class ErrorWithCode extends Error {
    code: string;
    constructor(code: string, message?: string);
}
declare const createError: (code: string, message?: string) => ErrorWithCode;

declare const _default: fastify.FastifyPluginAsync<FastifySessionOptions>;

export { CRYPTO_SPLIT_CHAR, ErrorWithCode, type FastifySessionOptions, HMAC, Hmac, MemoryStore, type SecretKey, Session, SessionCrypto, type SessionData, SessionStore, StatelessStore, createError, _default as default };
