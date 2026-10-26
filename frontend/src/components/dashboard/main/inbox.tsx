
import { useMemo } from "react";
import Button from "@/components/_ui/button";
import { COLUMN_META } from "@/components/_common/column-meta";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { CURRENT_USER_ID } from "@/lib/kanban";
import { dueInfo, isOverdue, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

export default function Inbox() {
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const activity = useKanbanStore((state) => state.activity);
  const openDialog = useUiStore((state) => state.openDialog);
  const setNav = useUiStore((state) => state.setNav);

  const attention = useMemo(
    () =>
      tasks.filter((task) => {
        const column = columns.find((c) => c.id === task.columnId);
        const done = column?.kind === "done";
        return (
          !done &&
          (isOverdue(task.dueDate, done) ||
            (task.priority === "urgent" &&
              task.assigneeIds.includes(CURRENT_USER_ID)))
        );
      }),
    [tasks, columns],
  );

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2>Needs attention</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNav("team-issues")}
            >
              Open board
            </Button>
          </div>
          {attention.length === 0 ? (
            <p className="text-subtle">You&apos;re all caught up.</p>
          ) : (
            <div className="divide-border flex flex-col divide-y">
              {attention.map((task) => {
                const column = columns.find((c) => c.id === task.columnId);
                const meta = COLUMN_META[column?.kind ?? "todo"];
                const due = dueInfo(task.dueDate, false);
                return (
                  <Button
                    key={task.id}
                    variant="ghost"
                    size="md"
                    onClick={() =>
                      openDialog({ type: "task", taskId: task.id })
                    }
                    className="text-foreground -mx-2 h-auto justify-start motion-safe:active:scale-100 gap-3 rounded-lg px-2 py-2.5"
                  >
                    <meta.icon
                      aria-hidden
                      className={cn("size-3.5 shrink-0", meta.color)}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {task.title}
                    </span>
                    {due && (
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1",
                          due.overdue ? "text-danger" : "text-muted-foreground",
                        )}
                      >
                        {!due.overdue && (
                          <CalendarIcon
                            aria-hidden
                            className="text-subtle size-3.5"
                          />
                        )}
                        {due.label}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </section>
        <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
          <h2>Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-subtle">Nothing has happened yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activity.slice(0, 10).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="bg-icon mt-[7px] size-1.5 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p>{item.text}</p>
                    <span className="text-subtle text-[12px]">
                      {timeAgo(item.at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
