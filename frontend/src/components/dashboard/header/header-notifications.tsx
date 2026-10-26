
import { useMemo, useRef, useState } from "react";
import Button from "@/components/_ui/button";
import Popover from "@/components/_ui/popover";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { isOverdue, timeAgo } from "@/lib/dates";
import BellIcon from "@/assets/icons/bell-02.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

export default function HeaderNotifications() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const activity = useKanbanStore((state) => state.activity);
  const seenAt = useUiStore((state) => state.notificationsSeenAt);
  const markSeen = useUiStore((state) => state.markNotificationsSeen);
  const openDialog = useUiStore((state) => state.openDialog);

  const overdue = useMemo(
    () =>
      tasks.filter((task) => {
        const column = columns.find((c) => c.id === task.columnId);
        return isOverdue(task.dueDate, column?.kind === "done");
      }),
    [tasks, columns],
  );
  const unseen = activity.some((item) => !seenAt || item.at > seenAt);

  const toggle = () => {
    if (!open) markSeen();
    setOpen((value) => !value);
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="secondary"
        size="icon"
        aria-label="Notifications"
        aria-expanded={open}
        data-active={open}
        onClick={toggle}
        className="relative"
      >
        <BellIcon className="size-3.5" aria-hidden />
        {unseen && (
          <span
            aria-hidden
            className="bg-danger absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2 ring-white"
          />
        )}
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        align="end"
        label="Notifications"
        className="w-[320px] max-w-[calc(100vw-16px)] p-0"
      >
        <div className="border-border border-b px-3 py-2.5">
          <h3>Notifications</h3>
        </div>
        <div className="scroll-thin max-h-[380px] overflow-y-auto p-1">
          {overdue.length > 0 && (
            <div className="flex flex-col">
              <span className="label-style text-muted-foreground px-2 pt-2 pb-1.5">
                Overdue
              </span>
              {overdue.map((task) => (
                <Button
                  key={task.id}
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setOpen(false);
                    openDialog({ type: "task", taskId: task.id });
                  }}
                  className="text-foreground h-auto w-full justify-start gap-2 px-2 py-1.5"
                >
                  <CalendarIcon
                    className="text-danger size-3.5 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {task.title}
                  </span>
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            <span className="label-style text-muted-foreground px-2 pt-2 pb-1.5">
              Recent activity
            </span>
            {activity.length === 0 && (
              <p className="text-subtle px-2 py-2">Nothing has happened yet.</p>
            )}
            {activity.slice(0, 8).map((item) => (
              <div key={item.id} className="flex gap-2 px-2 py-1.5">
                <span
                  aria-hidden
                  className="bg-icon mt-[7px] size-1.5 shrink-0 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{item.text}</p>
                  <span className="text-subtle text-[12px]">
                    {timeAgo(item.at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Popover>
    </>
  );
}
