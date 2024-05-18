# fastify-sessions

<!-- markdownlint-disable MD033 -->
<p align="center">
  <a href="https://www.npmjs.com/package/fastify-sessions">
    <img src="https://img.shields.io/npm/v/fastify-sessions.svg?style=for-the-badge" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/fastify-sessions">
    <img src="https://img.shields.io/npm/dt/fastify-sessions.svg?style=for-the-badge" alt="npm total downloads" />
  </a>
  <a href="https://www.npmjs.com/package/fastify-sessions">
    <img src="https://img.shields.io/npm/dm/fastify-sessions.svg?style=for-the-badge" alt="npm monthly downloads" />
  </a>
  <a href="https://www.npmjs.com/package/fastify-sessions">
    <img src="https://img.shields.io/npm/l/fastify-sessions.svg?style=for-the-badge" alt="npm license" />
  </a>
  <br />
  <a href="https://github.com/dmkng/fastify-sessions/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/dmkng/fastify-sessions/main.yml?style=for-the-badge&branch=master" alt="build status" />
  </a>
  <a href="https://depfu.com/github/dmkng/fastify-sessions">
    <img src="https://img.shields.io/depfu/dependencies/github/dmkng/fastify-sessions?style=for-the-badge" alt="dependencies status" />
  </a>
</p>
<!-- markdownlint-enable MD037 -->

## Features

Session plugin for [fastify](https://npm.im/fastify) supporting both stateless and stateful sessions, fork of [@mgcrea/fastify-session](https://npm.im/@mgcrea/fastify-session) adding a lot of features while keeping compatibility.

- Requires [@fastify/cookie](https://npm.im/@fastify/cookie) to handle cookies.

- Works with [fastify](https://npm.im/fastify) `^4.0.0` starting from `>=0.16.0`.

- Can leverage crypto addons like
  [@mgcrea/fastify-session-sodium-crypto](https://npm.im/@mgcrea/fastify-session-sodium-crypto) to perform crypto.

- Can leverage store addons like:

  - [@mgcrea/fastify-session-redis-store](https://npm.im/@mgcrea/fastify-session-redis-store)
  - [@mgcrea/fastify-session-prisma-store](https://npm.im/@mgcrea/fastify-session-prisma-store)
  - [fastify-session-sqlite-store](https://npm.im/fastify-session-sqlite-store)

- Built with [TypeScript](https://www.typescriptlang.org/) for static type checking with exported types along the
  library.

## Install

```bash
npm install fastify-sessions @fastify/cookie
# or
pnpm add fastify-sessions @fastify/cookie
```

## Quickstart

### Basic example (signed session with hmac stored in a volatile in-memory store)

Defaults to a volatile in-memory store for sessions (great for tests), with
[HMAC](https://nodejs.org/api/crypto.html#crypto_crypto_createhmac_algorithm_key_options) for signature.

```ts
import createFastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySessions from "fastify-sessions";

const SESSION_SECRET = "a secret with minimum length of 32 characters";
const SESSION_TTL = 86400; // 1 day in seconds

export const buildFastify = (options?: FastifyServerOptions): FastifyInstance => {
  const fastify = createFastify(options);

  fastify.register(fastifyCookie);
  fastify.register(fastifySessions, {
    secret: SESSION_SECRET,
    cookie: { maxAge: SESSION_TTL },
  });

  return fastify;
};
```

### Production example (signed session with sodium stored in redis)

For better performance/security, you can use the
[@mgcrea/fastify-session-sodium-crypto](https://npm.im/@mgcrea/fastify-session-sodium-crypto) addon:

Leveraging an external redis store, the session id (generated with [nanoid](https://npm.im/nanoid)) is signed
using a secret-key with
[libsodium's crypto_auth](https://libsodium.gitbook.io/doc/secret-key_cryptography/secret-key_authentication)

```ts
import createFastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySessions from "fastify-sessions";
import { SODIUM_AUTH } from "@mgcrea/fastify-session-sodium-crypto";

const SESSION_KEY = "Egb/g4RUumlD2YhWYfeDlm5MddajSjGEBhm0OW+yo9s=";
const SESSION_TTL = 86400; // 1 day in seconds
const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379/1";

export const buildFastify = (options?: FastifyServerOptions): FastifyInstance => {
  const fastify = createFastify(options);

  fastify.register(fastifyCookie);
  fastify.register(fastifySessions, {
    key: Buffer.from(SESSION_KEY, "base64"),
    crypto: SODIUM_AUTH,
    store: new RedisStore({ client: new Redis(REDIS_URI), ttl: SESSION_TTL }),
    cookie: { maxAge: SESSION_TTL },
  });

  return fastify;
};
```

### Stateless example (encrypted session with sodium not using a store)

No external store required, the entire session data is encrypted using a secret-key with
[libsodium's crypto_secretbox_easy](https://libsodium.gitbook.io/doc/secret-key_cryptography/secretbox)

Here we used a `secret` instead of providing a `key`, key derivation will happen automatically on startup.

```ts
import createFastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySessions from "fastify-sessions";
import { SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto";

const SESSION_TTL = 86400; // 1 day in seconds

export const buildFastify = (options?: FastifyServerOptions): FastifyInstance => {
  const fastify = createFastify(options);

  fastify.register(fastifyCookie);
  fastify.register(fastifySessions, {
    secret: "a secret with minimum length of 32 characters",
    crypto: SODIUM_SECRETBOX,
    cookie: { maxAge: SESSION_TTL },
  });

  return fastify;
};
```

### Stateless example with custom data serialization

Here we used [msgpackr](https://npm.im/msgpackr) to serialize the data instead of the default JSON and also disabled generating/saving the session ID.

```ts
import createFastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySessions, { SessionData, StatelessStore } from "fastify-sessions";
import { SODIUM_SECRETBOX } from "@mgcrea/fastify-session-sodium-crypto";
import { pack, unpack } from "msgpackr";

const SESSION_KEY = 'Egb/g4RUumlD2YhWYfeDlm5MddajSjGEBhm0OW+yo9s=';
const SESSION_TTL = 86400; // 1 day in seconds

export const buildFastify = (options?: FastifyServerOptions): FastifyInstance => {
  const fastify = createFastify(options);

  fastify.register(fastifyCookie);
  fastify.register(fastifySessions, {
    key: Buffer.from(SESSION_KEY, 'base64'),
    crypto: SODIUM_SECRETBOX,
    store: new StatelessStore({
      serialize: async (session: SessionData): Promise<Buffer> => pack(session),
      deserialize: async (session: Buffer): Promise<SessionData> => unpack(session),
      useId: false
    }),
    cookie: { maxAge: SESSION_TTL },
  });

  return fastify;
};
```

## Benchmarks

### Session crypto sealing

```sh
npm run benchmark:cryptoSeal
```

```txt
SODIUM_SECRETBOX#sealMsgpack x 653,658 ops/sec ±0.25% (90 runs sampled)
SODIUM_SECRETBOX#sealJson x 647,044 ops/sec ±0.25% (93 runs sampled)
SODIUM_AUTH#sealJson x 421,055 ops/sec ±0.18% (95 runs sampled)
HMAC#sealJson x 195,364 ops/sec ±0.35% (92 runs sampled)
Fastest is SODIUM_SECRETBOX#sealMsgpack
```

### Session crypto unsealing

```sh
npm run benchmark:cryptoUnseal
```

```txt
SODIUM_SECRETBOX#unsealMsgpack x 527,228 ops/sec ±0.36% (89 runs sampled)
SODIUM_SECRETBOX#unsealJson x 507,172 ops/sec ±0.29% (92 runs sampled)
SODIUM_AUTH#unsealJson x 347,371 ops/sec ±0.24% (93 runs sampled)
HMAC#unsealJson x 108,809 ops/sec ±0.76% (92 runs sampled)
Fastest is SODIUM_SECRETBOX#unsealMsgpack
```

### Session crypto serializing

```sh
npm run benchmark:cryptoSerialize
```

```txt
SODIUM_SECRETBOX#serializeMsgpack x 473,983 ops/sec ±0.31% (93 runs sampled)
SODIUM_SECRETBOX#serializeJson x 327,130 ops/sec ±0.26% (92 runs sampled)
Fastest is SODIUM_SECRETBOX#serializeMsgpack
```

### Session crypto deserializing

```sh
npm run benchmark:cryptoDeserialize
```

```txt
SODIUM_SECRETBOX#deserializeMsgpack x 372,287 ops/sec ±0.24% (91 runs sampled)
SODIUM_SECRETBOX#deserializeJson x 318,034 ops/sec ±0.24% (89 runs sampled)
Fastest is SODIUM_SECRETBOX#deserializeMsgpack
```

## Authors

- [dmkng](https://github.com/dmkng) <<susan@themaking.party>>

### Credits

Heavily inspired from

- [@mgcrea/fastify-session](https://github.com/mgcrea/fastify-session) by
  [Olivier Louvignes](https://github.com/mgcrea)
- [fastify-secure-session](https://github.com/fastify/fastify-secure-session) by
  [Matteo Collina](https://github.com/mcollina)
- [fastify-session](https://github.com/SerayaEryn/fastify-session) by [Denis Fäcke](https://github.com/SerayaEryn)
- [express-session](https://github.com/expressjs/session) by [Douglas Wilson](https://github.com/dougwilson)
- [cookie-signature](https://github.com/tj/node-cookie-signature) by [TJ Holowaychuk](https://github.com/tj)
