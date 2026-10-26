import { useEffect, useState } from "react";
import { useRouter, useRouteContext } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import { registerServiceWorker } from "@/lib/pwa";
import {
  drainMutations,
  pendingMutations,
  mutationError,
  offlineKey,
  setOfflineScope,
  storagePrefix,
} from "@/lib/task-mutations";
import { undoChange } from "@/server/productivity";
import { getWorkspace } from "@/server/workspace";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
let undoing = false;
export async function undoLatest() {
  if (undoing) return;
  if (pendingMutations().length) {
    useUiStore
      .getState()
      .toast("Wait for pending changes to save before undoing");
    return;
  }
  undoing = true;
  try {
    await undoChange();
    const workspace = await getWorkspace();
    useWorkspaceStore.getState().load(workspace);
    const board = useKanbanStore.getState();
    useKanbanStore.setState({
      tasks: workspace.tasks
        .filter((t) => t.boardId === board.id)
        .map(({ boardId: _, ...t }) => t),
    });
    useUiStore.getState().toast("Change undone");
  } catch (e) {
    useUiStore
      .getState()
      .toast(e instanceof Error ? e.message : "Could not undo");
  } finally {
    undoing = false;
  }
}
export function ProductivityRuntime() {
  const { userId } = useRouteContext({ from: "/_app" });
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setOfflineScope(userId);
    const cached = localStorage.getItem(offlineKey("workspace"));
    if (pendingMutations().length && cached) {
      try {
        const data = JSON.parse(cached);
        useWorkspaceStore.getState().load(data);
        const currentBoard = useKanbanStore.getState().id;
        useKanbanStore.setState({
          tasks: data.tasks
            .filter((t: { boardId: string }) => t.boardId === currentBoard)
            .map(
              ({ boardId: _, ...t }: import("@/lib/kanban").WorkspaceTask) => t,
            ),
        });
      } catch {}
    }
    void registerServiceWorker().catch(() => {});
    const save = () => {
      const { boards, tasks, goals, progress } = useWorkspaceStore.getState();
      localStorage.setItem(
        offlineKey("workspace"),
        JSON.stringify({ boards, tasks, goals, progress }),
      );
    };
    const unsubscribe = useWorkspaceStore.subscribe(save);
    save();
    const update = () => {
      setPending(pendingMutations().length);
      setOnline(navigator.onLine);
      setError(mutationError());
    };
    const retry = () => {
      update();
      void drainMutations();
    };
    const changed = () => {
      useUiStore
        .getState()
        .toast("Change saved", { label: "Undo", run: () => void undoLatest() });
    };
    window.addEventListener("online", retry);
    window.addEventListener("offline", update);
    window.addEventListener("kanban:outbox", update);
    window.addEventListener("kanban:mutation", changed);
    const timer = window.setInterval(() => void drainMutations(), 15000);
    const syncTimer = window.setInterval(() => {
      if (
        navigator.onLine &&
        !pendingMutations().length &&
        document.visibilityState === "visible" &&
        !useUiStore.getState().dialog
      )
        void router.invalidate();
    }, 60000);
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !pendingMutations().length
      )
        void router.invalidate();
    };
    document.addEventListener("visibilitychange", refresh);
    retry();
    const params = new URLSearchParams(window.location.search),
      share = params.get("text") ?? params.get("url");
    if (params.get("capture") === "true")
      useUiStore.getState().openDialog({ type: "capture" });
    if (share) {
      sessionStorage.setItem("kanban:share", share);
      useUiStore.getState().openDialog({ type: "capture" });
    }
    return () => {
      unsubscribe();
      clearInterval(timer);
      clearInterval(syncTimer);
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", update);
      window.removeEventListener("kanban:outbox", update);
      window.removeEventListener("kanban:mutation", changed);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);
  useEffect(() => {
    if (isLoaded && !user) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(storagePrefix)) localStorage.removeItem(key);
      }
      void navigator.serviceWorker?.controller?.postMessage({
        type: "CLEAR_USER",
      });
    }
  }, [isLoaded, user]);
  if (online && !pending) return null;
  return (
    <button
      onClick={() => void drainMutations()}
      className="bg-card border-border shadow-control fixed top-3 right-4 z-30 max-w-72 rounded-lg border px-3 py-1.5 text-xs"
      title={error || "Changes saved on this device until they sync"}
    >
      {online
        ? `${pending} change${pending === 1 ? "" : "s"} pending${error ? " · tap to retry" : ""}`
        : `Offline${pending ? ` · ${pending} pending` : ""}`}
    </button>
  );
}
