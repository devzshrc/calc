import { useEffect, useState } from "react";
import { getFocusSessions, type FocusSession } from "@/server/productivity";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Section } from "./page";
import { formatMinutes } from "@/lib/kanban";
export default function FocusReview() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const tasks = useWorkspaceStore((s) => s.tasks);
  useEffect(() => {
    void getFocusSessions()
      .then(setSessions)
      .catch(() => {});
  }, []);
  const recent = sessions.filter(
    (s) => s.endedAt && Date.parse(s.startedAt) >= Date.now() - 7 * 86400000,
  );
  const totals = new Map<string, number>();
  for (const s of recent)
    totals.set(s.taskId, (totals.get(s.taskId) ?? 0) + s.duration);
  const rows = [...totals].map(([id, seconds]) => ({
    task: tasks.find((t) => t.id === id),
    minutes: Math.round(seconds / 60),
  }));
  return (
    <Section
      title="Time in focus"
      meta={formatMinutes(
        Math.round(recent.reduce((sum, s) => sum + s.duration, 0) / 60),
      )}
    >
      {rows.length ? (
        <div className="flex flex-col gap-3">
          {rows.map(({ task, minutes }, i) => (
            <div key={task?.id ?? i} className="flex justify-between gap-3">
              <span className="truncate">{task?.title ?? "Deleted task"}</span>
              <span className="text-subtle shrink-0">
                {formatMinutes(minutes)}
                {task?.estimate
                  ? ` / ${formatMinutes(task.estimate)} estimated`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-subtle">
          Start a focus session from a task to see your time here.
        </p>
      )}
    </Section>
  );
}
