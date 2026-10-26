import { useSyncExternalStore } from "react";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";

type Scope = { getStore(): Map<object, unknown> | undefined };

function requestScope() {
  return (globalThis as { __kanbanStoreScope?: Scope }).__kanbanStoreScope?.getStore();
}

/**
 * Like zustand's `create`, with two server-side guarantees:
 * - SSR reads the live state seeded by loaders, not the initial state.
 * - Each request gets its own instance (see server/store-scope.server.ts),
 *   so one user's render can never observe another user's data.
 */
export function create<T>() {
  return (initializer: StateCreator<T, [], []>) => {
    const browserStore = typeof window === "undefined" ? null : createStore<T>()(initializer);
    const key = {};

    const resolve = (): StoreApi<T> => {
      if (browserStore) return browserStore;
      const scope = requestScope();
      if (!scope) throw new Error("Store accessed outside a request scope on the server");
      let store = scope.get(key) as StoreApi<T> | undefined;
      if (!store) {
        store = createStore<T>()(initializer);
        scope.set(key, store);
      }
      return store;
    };

    const api: StoreApi<T> = {
      getState: () => resolve().getState(),
      getInitialState: () => resolve().getInitialState(),
      setState: ((partial, replace) => resolve().setState(partial as T, replace as true)) as StoreApi<T>["setState"],
      subscribe: (listener) => resolve().subscribe(listener),
    };

    function useBoundStore(): T;
    function useBoundStore<U>(selector: (state: T) => U): U;
    function useBoundStore<U>(selector?: (state: T) => U) {
      const select = selector ?? ((state: T) => state as unknown as U);
      const get = () => select(api.getState());
      return useSyncExternalStore(api.subscribe, get, get);
    }
    return Object.assign(useBoundStore, api) as typeof useBoundStore & StoreApi<T>;
  };
}
