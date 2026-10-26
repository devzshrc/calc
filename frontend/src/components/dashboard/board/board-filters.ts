import { CURRENT_USER_ID, type Column, type Task } from "@/lib/kanban";
import { isOverdue } from "@/lib/dates";
import { isSnoozed } from "@/lib/recurrence";
import type { Filter } from "@/stores/ui-store";

type MatchOptions = {
  search: string;
  filter: Filter;
  mine: boolean;
  columns: Column[];
};

export function taskMatches(task: Task, options: MatchOptions) {
  const { search, filter, mine, columns } = options;
  if (isSnoozed(task)) return false;
  if (mine && !task.assigneeIds.includes(CURRENT_USER_ID)) return false;
  if (filter.priority && task.priority !== filter.priority) return false;
  if (filter.assigneeId && !task.assigneeIds.includes(filter.assigneeId)) {
    return false;
  }
  if (filter.overdue) {
    const column = columns.find((c) => c.id === task.columnId);
    if (!isOverdue(task.dueDate, column?.kind === "done")) return false;
  }
  const query = search.trim().toLowerCase();
  if (
    query &&
    !task.title.toLowerCase().includes(query) &&
    !task.description.toLowerCase().includes(query)
  ) {
    return false;
  }
  return true;
}
