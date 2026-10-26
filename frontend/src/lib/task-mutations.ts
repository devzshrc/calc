import * as server from "@/server/boards";
export type PendingMutation = {
  id: string;
  kind: "updateTask" | "deleteTask" | "createTasks" | "reorderTasks";
  data: unknown;
};
let scope = "";
let draining = false;
let lastError = "";
export const storagePrefix = "kanban:offline:";
export function setOfflineScope(userId: string) {
  scope = userId;
  if (typeof window !== "undefined")
    localStorage.setItem(`${storagePrefix}active`, userId);
}
export function offlineKey(kind: string) {
  return `${storagePrefix}${scope}:${kind}`;
}
export function pendingMutations(): PendingMutation[] {
  if (typeof window === "undefined" || !scope) return [];
  try {
    return JSON.parse(localStorage.getItem(offlineKey("outbox")) ?? "[]");
  } catch {
    return [];
  }
}
export function mutationError() {
  return lastError;
}
function save(items: PendingMutation[]) {
  localStorage.setItem(offlineKey("outbox"), JSON.stringify(items));
  window.dispatchEvent(new Event("kanban:outbox"));
}
export async function drainMutations() {
  if (draining || !scope || !navigator.onLine) return;
  draining = true;
  const owner = scope;
  try {
    for (;;) {
      if (scope !== owner) break;
      const items = pendingMutations(),
        item = items[0];
      if (!item) break;
      try {
        await (
          server[item.kind] as (options: { data: any }) => Promise<unknown>
        )({ data: item.data });
        if (scope !== owner) break;
        save(pendingMutations().filter((i) => i.id !== item.id));
        lastError = "";
        window.dispatchEvent(
          new CustomEvent("kanban:mutation", { detail: { kind: item.kind } }),
        );
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Could not save";
        window.dispatchEvent(new Event("kanban:outbox"));
        break;
      }
    }
  } finally {
    draining = false;
  }
}
function enqueue(kind: PendingMutation["kind"], data: unknown) {
  if (typeof window === "undefined")
    throw new Error("Task mutations must be made from the app");
  save([...pendingMutations(), { id: crypto.randomUUID(), kind, data }]);
  return drainMutations();
}
export const updateTask = (options: Parameters<typeof server.updateTask>[0]) =>
  enqueue("updateTask", options.data);
export const deleteTask = (options: Parameters<typeof server.deleteTask>[0]) =>
  enqueue("deleteTask", options.data);
export const createTasks = (
  options: Parameters<typeof server.createTasks>[0],
) => enqueue("createTasks", options.data);
export const reorderTasks = (
  options: Parameters<typeof server.reorderTasks>[0],
) => enqueue("reorderTasks", options.data);
