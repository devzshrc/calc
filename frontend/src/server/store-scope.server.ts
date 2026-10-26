import { AsyncLocalStorage } from "node:async_hooks";

// One Map of store instances per request, so concurrent SSR renders for
// different users never share client-store state.
export const storeScope = new AsyncLocalStorage<Map<object, unknown>>();
(globalThis as { __kanbanStoreScope?: typeof storeScope }).__kanbanStoreScope = storeScope;
