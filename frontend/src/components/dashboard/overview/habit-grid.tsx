import { useMemo } from "react";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { RECURRENCES } from "@/lib/kanban";
import { formatShort, shiftDays, toDateKey } from "@/lib/dates";
import { streak } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import RefreshIcon from "@/assets/icons/refresh.svg?react";

const DAYS = 28;

export default function HabitGrid() {
  const tasks = useKanbanStore((state) => state.tasks);
  const openDialog = useUiStore((state) => state.openDialog);
  const habits = useMemo(() => tasks.filter((task) => task.recurrence), [tasks]);
  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => toDateKey(shiftDays(i - DAYS + 1))),
    [],
  );

  if (habits.length === 0) return null;

  return (
    <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2>Habits</h2>
        <span className="text-subtle">Last {DAYS} days</span>
      </div>
      <div className="flex flex-col gap-3">
        {habits.map((habit) => {
          const done = new Set(habit.completions);
          const count = streak(habit);
          return (
            <div key={habit.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={() => openDialog({ type: "task", taskId: habit.id })}
                className="flex w-44 min-w-0 cursor-pointer items-center gap-2 text-left outline-none hover:underline focus-visible:underline"
              >
                <RefreshIcon aria-hidden className="text-icon size-3.5 shrink-0" />
                <span className="truncate">{habit.title}</span>
              </button>
              <div
                className="flex flex-1 gap-[3px]"
                role="img"
                aria-label={`${habit.title}: done ${days.filter((d) => done.has(d)).length} of the last ${DAYS} days`}
              >
                {days.map((day, index) => (
                  <span
                    key={day}
                    title={`${formatShort(day)}${done.has(day) ? " · done" : ""}`}
                    className={cn(
                      "h-3.5 min-w-[6px] flex-1 rounded-[3px]",
                      done.has(day) ? "bg-success" : "bg-muted",
                      index === DAYS - 1 && "shadow-[0_0_0_1px_var(--foreground)]",
                    )}
                  />
                ))}
              </div>
              <span className="text-muted-foreground w-24 shrink-0 text-right tabular-nums">
                {count > 0 ? `${count} streak` : RECURRENCES.find((r) => r.value === habit.recurrence)?.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
