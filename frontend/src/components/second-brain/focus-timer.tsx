import { useEffect, useState } from "react";
import { create } from "@/lib/create-store";
import {
  getFocusSessions,
  startFocus,
  stopFocus,
  type FocusSession,
} from "@/server/productivity";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUiStore } from "@/stores/ui-store";
import Button from "@/components/_ui/button";
export const useFocusStore = create<{
  session: FocusSession | null;
  loading: boolean;
}>()(() => ({ session: null, loading: false }));
export async function startTaskFocus(taskId: string) {
  if (useFocusStore.getState().loading) return;
  useFocusStore.setState({ loading: true });
  try {
    useFocusStore.setState({ session: await startFocus({ data: { taskId } }) });
  } catch (e) {
    useUiStore
      .getState()
      .toast(e instanceof Error ? e.message : "Could not start focus");
  } finally {
    useFocusStore.setState({ loading: false });
  }
}
export default function FocusTimer() {
  const { session, loading } = useFocusStore();
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState<string | null>(null);
  const tasks = useWorkspaceStore((s) => s.tasks);
  useEffect(() => {
    void getFocusSessions()
      .then((sessions) =>
        useFocusStore.setState({
          session: sessions.find((s) => !s.endedAt) ?? null,
        }),
      )
      .catch(() => {});
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!session && !finished) return null;
  const task = tasks.find((t) => t.id === (session?.taskId ?? finished));
  const seconds = session
    ? Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
    : 0;
  return (
    <div className="bg-card shadow-popover border-border fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-2xl border p-3">
      <div className="min-w-0">
        <p className="max-w-48 truncate text-xs">
          {task?.title ?? "Focus session"}
        </p>
        {session && (
          <p className="text-info font-mono text-lg tabular-nums">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
        )}
      </div>
      {session ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={async () => {
            useFocusStore.setState({ loading: true });
            try {
              await stopFocus({ data: { id: session._id } });
              setFinished(session.taskId);
              useFocusStore.setState({ session: null });
            } catch {
              useUiStore.getState().toast("Could not save session");
            } finally {
              useFocusStore.setState({ loading: false });
            }
          }}
        >
          Finish
        </Button>
      ) : (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (finished) useWorkspaceStore.getState().completeTask(finished);
              setFinished(null);
            }}
          >
            Mark done
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFinished(null)}>
            Keep open
          </Button>
        </>
      )}
    </div>
  );
}
