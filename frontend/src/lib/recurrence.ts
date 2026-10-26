import { parseDateKey, shiftDays, toDateKey, todayKey } from "@/lib/dates";
import type { Column, Recurrence, Task } from "@/lib/kanban";

export function nextDue(from: string, recurrence: Recurrence) {
  const date = parseDateKey(from);
  if (recurrence === "daily") return toDateKey(shiftDays(1, date));
  if (recurrence === "weekly") return toDateKey(shiftDays(7, date));
  if (recurrence === "monthly") {
    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    return toDateKey(next);
  }
  let next = shiftDays(1, date);
  while (next.getDay() === 0 || next.getDay() === 6) next = shiftDays(1, next);
  return toDateKey(next);
}

/** Days a recurrence expects a completion on, used for streak gaps. */
function expected(day: Date, recurrence: Recurrence) {
  return recurrence !== "weekdays" || (day.getDay() !== 0 && day.getDay() !== 6);
}

/**
 * Consecutive completed periods ending today (or yesterday, so an
 * unfinished today doesn't break the streak until it's over).
 */
export function streak(task: Pick<Task, "completions" | "recurrence">) {
  if (!task.recurrence || task.completions.length === 0) return 0;
  const done = new Set(task.completions);
  if (task.recurrence === "weekly" || task.recurrence === "monthly") {
    const span = task.recurrence === "weekly" ? 7 : 31;
    let count = 0;
    let cursor = new Date();
    for (;;) {
      let hit = false;
      for (let i = 0; i < span; i++) {
        if (done.has(toDateKey(shiftDays(-i, cursor)))) hit = true;
      }
      if (!hit) break;
      count++;
      cursor = shiftDays(-span, cursor);
    }
    return count;
  }
  let count = 0;
  let cursor = new Date();
  if (!done.has(toDateKey(cursor))) cursor = shiftDays(-1, cursor);
  for (let guard = 0; guard < 2000; guard++) {
    if (!expected(cursor, task.recurrence)) {
      cursor = shiftDays(-1, cursor);
      continue;
    }
    if (!done.has(toDateKey(cursor))) break;
    count++;
    cursor = shiftDays(-1, cursor);
  }
  return count;
}

export function firstColumn(columns: Column[], kind: Column["kind"]) {
  return (
    columns.find((c) => c.kind === kind && !c.hidden) ??
    columns.find((c) => c.kind === kind)
  );
}

export type Completion = {
  patch: Partial<Task>;
  /** Set when a recurring task rolled over instead of finishing. */
  nextDue: string | null;
};

/**
 * Completing a recurring task logs today and rolls it to the next due date,
 * keeping it in its open column; anything else moves to Done.
 */
export function completeTask(task: Task, columns: Column[]): Completion {
  const today = todayKey();
  if (task.recurrence) {
    const completions = task.completions.includes(today)
      ? task.completions
      : [...task.completions, today].slice(-1000);
    const base = task.dueDate && task.dueDate > today ? task.dueDate : today;
    const due = nextDue(base, task.recurrence);
    const current = columns.find((c) => c.id === task.columnId);
    const open =
      current && current.kind !== "done"
        ? current
        : (firstColumn(columns, "todo") ?? current);
    return {
      patch: {
        scheduledStart: null,
        scheduledEnd: null,
        reminderAt: null,
        completions,
        dueDate: due,
        focusOn: null,
        subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
        columnId: open?.id ?? task.columnId,
      },
      nextDue: due,
    };
  }
  const done = firstColumn(columns, "done");
  return {
    patch: {
      columnId: done?.id ?? task.columnId,
      completedAt: new Date().toISOString(),
      focusOn: null,
    },
    nextDue: null,
  };
}

export function isSnoozed(task: Pick<Task, "snoozedUntil">, today = todayKey()) {
  return Boolean(task.snoozedUntil && task.snoozedUntil > today);
}
