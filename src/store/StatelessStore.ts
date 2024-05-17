import type { SessionData, SessionStore } from "./SessionStore";

export type StatelessStoreOptions<T> = {
  serialize?: (session: T) => Promise<Buffer>;
  deserialize?: (session: Buffer) => Promise<T>;
  useId?: boolean;
};

export class StatelessStore<T extends SessionData = SessionData> implements SessionStore {
  public readonly serialize: (session: T) => Promise<Buffer>;
  public readonly deserialize: (session: Buffer) => Promise<T>;
  public readonly useId: boolean;

  constructor({
    serialize = async (session: T): Promise<Buffer> => Buffer.from(JSON.stringify(session)),
    deserialize = async (session: Buffer): Promise<T> => JSON.parse(session.toString()),
    useId = true
  }: StatelessStoreOptions<T> = {}) {
    this.serialize = serialize;
    this.deserialize = deserialize;
    this.useId = useId;
  }

  async get(): Promise<[T, number | null] | null> {
    return null;
  }

  async set(): Promise<void> {}

  async destroy(): Promise<void> {}
}

export const STATELESS_STORE = new StatelessStore();
