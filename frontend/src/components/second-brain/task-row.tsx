import { startTaskFocus } from "@/components/second-brain/focus-timer";
import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LAYOUT_SPRING } from "@/lib/easings";
import Button from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import MetaChips from "@/components/second-brain/meta-chips";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WorkspaceTask } from "@/lib/kanban";
import { dayKeyFromNow, formatShort, todayKey } from "@/lib/dates";
import { streak } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import CircleIcon from "@/assets/icons/circle.svg?react";
import CheckCircleIcon from "@/assets/icons/check-circle.svg?react";
import TargetIcon from "@/assets/icons/target.svg?react";
import MoonIcon from "@/assets/icons/moon.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

type TaskRowProps = {
  task: WorkspaceTask;
  done?: boolean;
  note?: ReactNode;
  showBoard?: boolean;
  trailing?: ReactNode;
};

export default function TaskRow({ task, done = false, note, showBoard = true, trailing }: TaskRowProps) {
  const boards = useWorkspaceStore((state) => state.boards);
  const patchTask = useWorkspaceStore((state) => state.patchTask);
  const completeTask = useWorkspaceStore((state) => state.completeTask);
  const navigate = useNavigate();
  const snoozeRef = useRef<HTMLButtonElement>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const board = boards.find((b) => b.id === task.boardId);
  const today = todayKey();
  const focused = task.focusOn === today;
  const days = streak(task);

  return (
    <motion.div
      layoutId={`task-row-${task.id}`}
      transition={LAYOUT_SPRING}
      className="group/row hover:bg-foreground/[0.03] -mx-2 flex items-start gap-2 rounded-lg px-2 py-2 transition-colors duration-150 ease-[ease]"
    >
      <Button
        variant="ghost"
        size="xs"
        aria-label={done ? `${task.title} is done` : `Complete ${task.title}`}
        disabled={done}
        onClick={() => completeTask(task.id)}
        className="group/check mt-px shrink-0 disabled:opacity-100"
      >
        {done ? (
          <CheckCircleIcon aria-hidden className="text-success size-3.5" />
        ) : (
          <>
            <CircleIcon aria-hidden className="text-icon size-3.5 group-hover/check:hidden" />
            <CheckCircleIcon aria-hidden className="text-success hidden size-3.5 group-hover/check:block" />
          </>
        )}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/b/$boardId",
              params: { boardId: task.boardId },
              search: { task: task.id },
            })
          }
          className={cn(
            "min-h-6 cursor-pointer truncate text-left leading-6 outline-none hover:underline focus-visible:underline",
            done && "text-subtle line-through",
          )}
        >
          {task.title}
          {days > 1 && (
            <span className="text-success ml-2 tabular-nums no-underline">{days} streak</span>
          )}
        </button>
        {note && <p className="text-muted-foreground">{note}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChips
            board={showBoard ? board : null}
            priority={task.priority}
            dueDate={task.dueDate}
            done={done}
            estimate={task.estimate}
            recurrence={task.recurrence}
          />
          {task.subtasks.length > 0 && (
            <span className="text-subtle tabular-nums">
              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} steps
            </span>
          )}
        </div>
      </div>
      {!done && <button className="text-subtle hover:text-foreground shrink-0 px-2" aria-label={`Focus on ${task.title}`} onClick={() => void startTaskFocus(task.id)}>▶</button>}
      {!done && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover/row:opacity-100 sm:has-[[data-active=true]]:opacity-100 sm:focus-within:opacity-100">
          {trailing}
          <Button
            variant="ghost"
            size="xs"
            aria-label={focused ? "Remove from focus" : "Add to today's focus"}
            title={focused ? "Remove from focus" : "Focus today"}
            aria-pressed={focused}
            data-active={focused}
            onClick={() => patchTask(task.id, { focusOn: focused ? null : today })}
          >
            <TargetIcon aria-hidden className={cn("size-3.5", focused && "text-info")} />
          </Button>
          <Button
            ref={snoozeRef}
            variant="ghost"
            size="xs"
            aria-label="Snooze or reschedule"
            title="Snooze or reschedule"
            aria-expanded={snoozeOpen}
            data-active={snoozeOpen}
            onClick={() => setSnoozeOpen((v) => !v)}
          >
            <MoonIcon aria-hidden className="size-3.5" />
          </Button>
          <Menu
            open={snoozeOpen}
            onClose={() => setSnoozeOpen(false)}
            anchorRef={snoozeRef}
            align="end"
            label="Snooze or reschedule"
            items={[
              { id: "h1", heading: "Move due date" },
              {
                id: "due-tomorrow",
                label: "Tomorrow",
                icon: <CalendarIcon />,
                onSelect: () => patchTask(task.id, { dueDate: dayKeyFromNow(1), focusOn: null }),
              },
              {
                id: "due-week",
                label: "Next week",
                icon: <CalendarIcon />,
                onSelect: () => patchTask(task.id, { dueDate: dayKeyFromNow(7), focusOn: null }),
              },
              { id: "sep", separator: true },
              { id: "h2", heading: "Hide until" },
              {
                id: "snooze-tomorrow",
                label: `Tomorrow · ${formatShort(dayKeyFromNow(1))}`,
                icon: <MoonIcon />,
                onSelect: () => patchTask(task.id, { snoozedUntil: dayKeyFromNow(1), focusOn: null }),
              },
              {
                id: "snooze-week",
                label: `Next week · ${formatShort(dayKeyFromNow(7))}`,
                icon: <MoonIcon />,
                onSelect: () => patchTask(task.id, { snoozedUntil: dayKeyFromNow(7), focusOn: null }),
              },
              ...(task.snoozedUntil
                ? [
                    {
                      id: "wake",
                      label: "Wake up now",
                      onSelect: () => patchTask(task.id, { snoozedUntil: null }),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
    </motion.div>
  );
}

export function TaskList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}
