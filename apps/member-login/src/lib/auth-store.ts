export type SessionRecord = {
  accessToken: string;
  absoluteExpiresAt: number;
  expiresAt: number;
  member: {
    firstName: string;
    lastName: string;
    memberId: string;
  };
  refreshToken: string;
  version: number;
};

export type PendingAuth = {
  codeVerifier: string;
  email: string;
  expiresAt: number;
  state: string;
};

export type AuthStoreSnapshot = {
  pendingAuth: Array<[string, PendingAuth]>;
  sessionVersions: Array<[string, number]>;
  sessions: Array<[string, SessionRecord]>;
};

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  get(id: unknown): DurableObjectStubLike;
  idFromName(name: string): unknown;
}

export interface DurableObjectStorageLike {
  delete(key: string): Promise<void>;
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export type AuthRuntimeBindings = {
  MEMBER_LOGIN_AUTH_STATE?: DurableObjectNamespaceLike;
  MEMBER_LOGIN_URL?: string;
  MEMBERS_PORTAL_URL?: string;
  WIX_API_BASE_URL?: string;
  WIX_AUTH_REDIRECT_URI?: string;
  WIX_HEADLESS_CLIENT_ID?: string;
  WIX_PASSWORD_RESET_REDIRECT_URI?: string;
};

export class MemberLoginAuthDurableObjectHandler {
  private readonly storage: DurableObjectStorageLike;

  constructor(storage: DurableObjectStorageLike) {
    this.storage = storage;
  }

  private async handlePending(request: Request, path: string): Promise<Response> {
    if (path === "/pending") {
      const pending = await this.storage.get<PendingAuth>("pending");
      return Response.json({ pendingAuth: pending });
    }
    if (path === "/pending/set" && request.method === "POST") {
      const body = await request.json() as { value?: PendingAuth };
      if (!body.value) return Response.json({ error: "invalid" }, { status: 400 });
      await this.storage.put("pending", body.value);
      return Response.json({ ok: true });
    }
    if (path === "/pending/consume" && request.method === "POST") {
      const body = await request.json() as { now?: number; state?: string };
      const pending = await this.storage.get<PendingAuth>("pending");
      if (!pending || pending.state !== String(body.state ?? "") || pending.expiresAt < Number(body.now ?? 0)) {
        return Response.json({ pendingAuth: undefined });
      }
      await this.storage.delete("pending");
      return Response.json({ pendingAuth: pending });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  private async handleSession(request: Request, path: string): Promise<Response> {
    if (path === "/session/get") {
      const session = await this.storage.get<SessionRecord>("session");
      return Response.json({ session });
    }
    if (path === "/session/version") {
      const version = await this.storage.get<number>("version");
      return Response.json({ version });
    }
    if (path === "/session/create" && request.method === "POST") {
      const body = await request.json() as { record?: SessionRecord };
      if (!body.record) return Response.json({ error: "invalid" }, { status: 400 });
      await this.storage.put("session", body.record);
      await this.storage.put("version", body.record.version);
      return Response.json({ ok: true });
    }
    if (path === "/session/update" && request.method === "POST") {
      const body = await request.json() as { expectedVersion?: number; record?: SessionRecord };
      const expectedVersion = Number(body.expectedVersion ?? 0);
      const currentVersion = Number((await this.storage.get<number>("version")) ?? 0);
      const session = await this.storage.get<SessionRecord>("session");
      if (!body.record || !session || currentVersion !== expectedVersion) {
        return Response.json({ updated: false });
      }
      await this.storage.put("session", body.record);
      await this.storage.put("version", body.record.version);
      return Response.json({ updated: true });
    }
    if (path === "/session/revoke" && request.method === "POST") {
      const currentVersion = Number((await this.storage.get<number>("version")) ?? 0);
      await this.storage.put("version", currentVersion + 1);
      await this.storage.delete("session");
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/pending")) return this.handlePending(request, path);
    if (path.startsWith("/session")) return this.handleSession(request, path);
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}

export interface AuthStore {
  clear(): Promise<void>;
  consumePendingAuth(pendingKey: string, state: string, now: number): Promise<PendingAuth | undefined>;
  createSession(sessionId: string, record: SessionRecord): Promise<void>;
  getPendingAuth(pendingKey: string): Promise<PendingAuth | undefined>;
  getSession(sessionId: string): Promise<SessionRecord | undefined>;
  getSessionVersion(sessionId: string): Promise<number | undefined>;
  revokeSession(sessionId: string): Promise<void>;
  restore(snapshot: AuthStoreSnapshot): Promise<void>;
  setPendingAuth(pendingKey: string, value: PendingAuth): Promise<void>;
  snapshot(): Promise<AuthStoreSnapshot>;
  updateSessionIfCurrent(sessionId: string, expectedVersion: number, record: SessionRecord): Promise<boolean>;
}

class MemoryAuthStore implements AuthStore {
  readonly pendingAuth = new Map<string, PendingAuth>();
  readonly sessionVersions = new Map<string, number>();
  readonly sessions = new Map<string, SessionRecord>();

  async clear(): Promise<void> {
    this.pendingAuth.clear();
    this.sessionVersions.clear();
    this.sessions.clear();
  }

  async consumePendingAuth(pendingKey: string, state: string, now: number): Promise<PendingAuth | undefined> {
    const pending = this.pendingAuth.get(pendingKey);
    if (!pending || pending.state !== state || pending.expiresAt < now) return undefined;
    this.pendingAuth.delete(pendingKey);
    return pending;
  }

  async createSession(sessionId: string, record: SessionRecord): Promise<void> {
    this.sessions.set(sessionId, record);
    this.sessionVersions.set(sessionId, record.version);
  }

  async getPendingAuth(pendingKey: string): Promise<PendingAuth | undefined> {
    return this.pendingAuth.get(pendingKey);
  }

  async getSession(sessionId: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(sessionId);
  }

  async getSessionVersion(sessionId: string): Promise<number | undefined> {
    return this.sessionVersions.get(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const nextVersion = (this.sessionVersions.get(sessionId) ?? this.sessions.get(sessionId)?.version ?? 0) + 1;
    this.sessionVersions.set(sessionId, nextVersion);
    this.sessions.delete(sessionId);
  }

  async restore(snapshot: AuthStoreSnapshot): Promise<void> {
    await this.clear();
    snapshot.pendingAuth.forEach(([key, value]) => {
      this.pendingAuth.set(key, value);
    });
    snapshot.sessionVersions.forEach(([key, value]) => {
      this.sessionVersions.set(key, value);
    });
    snapshot.sessions.forEach(([key, value]) => {
      this.sessions.set(key, value);
    });
  }

  async setPendingAuth(pendingKey: string, value: PendingAuth): Promise<void> {
    this.pendingAuth.set(pendingKey, value);
  }

  async snapshot(): Promise<AuthStoreSnapshot> {
    return {
      pendingAuth: Array.from(this.pendingAuth.entries()),
      sessionVersions: Array.from(this.sessionVersions.entries()),
      sessions: Array.from(this.sessions.entries()),
    };
  }

  async updateSessionIfCurrent(sessionId: string, expectedVersion: number, record: SessionRecord): Promise<boolean> {
    if (this.sessionVersions.get(sessionId) !== expectedVersion) return false;
    this.sessions.set(sessionId, record);
    this.sessionVersions.set(sessionId, record.version);
    return true;
  }
}

class DurableObjectAuthStore implements AuthStore {
  private readonly namespace: DurableObjectNamespaceLike;

  constructor(namespace: DurableObjectNamespaceLike) {
    this.namespace = namespace;
  }

  private stubFor(kind: "pending" | "session", key: string): DurableObjectStubLike {
    return this.namespace.get(this.namespace.idFromName(`${kind}:${key}`));
  }

  private async json<T>(kind: "pending" | "session", key: string, path: string, body?: unknown): Promise<T> {
    const response = await this.stubFor(kind, key).fetch(`https://member-login-auth${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      method: body === undefined ? "GET" : "POST",
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text || "auth-store-error");
    return (text ? JSON.parse(text) : {}) as T;
  }

  async clear(): Promise<void> {
    throw new Error("unsupported");
  }

  async consumePendingAuth(pendingKey: string, state: string, now: number): Promise<PendingAuth | undefined> {
    const payload = await this.json<{ pendingAuth?: PendingAuth }>("pending", pendingKey, "/pending/consume", { now, state });
    return payload.pendingAuth;
  }

  async createSession(sessionId: string, record: SessionRecord): Promise<void> {
    await this.json("session", sessionId, "/session/create", { record });
  }

  async getPendingAuth(pendingKey: string): Promise<PendingAuth | undefined> {
    const payload = await this.json<{ pendingAuth?: PendingAuth }>("pending", pendingKey, "/pending");
    return payload.pendingAuth;
  }

  async getSession(sessionId: string): Promise<SessionRecord | undefined> {
    const payload = await this.json<{ session?: SessionRecord }>("session", sessionId, "/session/get");
    return payload.session;
  }

  async getSessionVersion(sessionId: string): Promise<number | undefined> {
    const payload = await this.json<{ version?: number }>("session", sessionId, "/session/version");
    return payload.version;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.json("session", sessionId, "/session/revoke", {});
  }

  async restore(snapshot: AuthStoreSnapshot): Promise<void> {
    void snapshot;
    throw new Error("unsupported");
  }

  async setPendingAuth(pendingKey: string, value: PendingAuth): Promise<void> {
    await this.json("pending", pendingKey, "/pending/set", { value });
  }

  async snapshot(): Promise<AuthStoreSnapshot> {
    throw new Error("unsupported");
  }

  async updateSessionIfCurrent(sessionId: string, expectedVersion: number, record: SessionRecord): Promise<boolean> {
    const payload = await this.json<{ updated?: boolean }>("session", sessionId, "/session/update", { expectedVersion, record });
    return Boolean(payload.updated);
  }
}

export function createMemoryAuthStore(): AuthStore {
  return new MemoryAuthStore();
}

let fallbackAuthStore = createMemoryAuthStore();

export function setFallbackAuthStore(store: AuthStore): void {
  fallbackAuthStore = store;
}

export function createAuthStore(bindings?: AuthRuntimeBindings): AuthStore {
  if (bindings?.MEMBER_LOGIN_AUTH_STATE) {
    return new DurableObjectAuthStore(bindings.MEMBER_LOGIN_AUTH_STATE);
  }
  return fallbackAuthStore;
}

export function isAuthStoreSnapshot(value: unknown): value is AuthStoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as AuthStoreSnapshot;
  return Array.isArray(snapshot.pendingAuth) && Array.isArray(snapshot.sessionVersions) && Array.isArray(snapshot.sessions);
}

type InMemoryDurableObjectNamespaceOptions = {
  sharedStorage?: Map<string, Map<string, unknown>>;
};

class InMemoryDurableObjectStorage implements DurableObjectStorageLike {
  private readonly data: Map<string, unknown>;

  constructor(data: Map<string, unknown>) {
    this.data = data;
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
}

export function createInMemoryDurableObjectNamespace(options: InMemoryDurableObjectNamespaceOptions = {}): DurableObjectNamespaceLike {
  const storageById = options.sharedStorage ?? new Map<string, Map<string, unknown>>();
  const queues = new Map<string, Promise<void>>();

  return {
    idFromName(name: string): string {
      return name;
    },
    get(id: unknown): DurableObjectStubLike {
      const idString = String(id);
      if (!storageById.has(idString)) storageById.set(idString, new Map<string, unknown>());
      const storage = storageById.get(idString)!;
      return {
        async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          const request = input instanceof Request ? input : new Request(String(input), init);
          const previous = (queues.get(idString) ?? Promise.resolve()).catch(() => undefined);
          let release!: () => void;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          queues.set(idString, previous.then(() => gate).catch(() => undefined));
          await previous;
          try {
            const durableObject = new MemberLoginAuthDurableObjectHandler(new InMemoryDurableObjectStorage(storage));
            return await durableObject.fetch(request);
          } finally {
            release();
          }
        },
      };
    },
  };
}
