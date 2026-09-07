import { MemberLoginAuthDurableObjectHandler, type DurableObjectStorageLike } from "./auth-store.ts";

type DurableObjectBaseConstructor = new (...args: any[]) => object;

const DurableObjectBase = (globalThis as typeof globalThis & {
  DurableObject?: DurableObjectBaseConstructor;
}).DurableObject ?? class {};

type MemberLoginAuthDurableObjectState = { storage: DurableObjectStorageLike };

export class MemberLoginAuthDurableObject extends DurableObjectBase {
  private readonly durableObjectState: MemberLoginAuthDurableObjectState;

  constructor(state: MemberLoginAuthDurableObjectState, env?: unknown) {
    super(state, env);
    this.durableObjectState = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new MemberLoginAuthDurableObjectHandler(this.durableObjectState.storage).fetch(request);
  }
}
