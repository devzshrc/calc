import type { ActivityDoc, BoardDoc, TaskDoc } from "./types";

export function boardSummary(board: BoardDoc) {
  return { id: board._id, title: board.title, favorite: board.favorite };
}

// Older documents predate some fields; fill them so clients see one shape.
export function serializeTask({ _id, boardId: _b, userId: _u, position: _p, createdAt, ...task }: TaskDoc) {
  return {
    id: _id,
    title: task.title,
    description: task.description ?? "",
    columnId: task.columnId,
    priority: task.priority,
    assigneeIds: task.assigneeIds ?? [],
    scheduledStart: task.scheduledStart ?? null,
    scheduledEnd: task.scheduledEnd ?? null,
    reminderAt: task.reminderAt ?? null,
    timezone: task.timezone ?? "Asia/Kolkata",
    dueDate: task.dueDate ?? null,
    recurrence: task.recurrence ?? null,
    completions: task.completions ?? [],
    estimate: task.estimate ?? null,
    subtasks: task.subtasks ?? [],
    goalId: task.goalId ?? null,
    snoozedUntil: task.snoozedUntil ?? null,
    focusOn: task.focusOn ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: createdAt.toISOString(),
  };
}

export type SerializedTask = ReturnType<typeof serializeTask>;

export function serializeActivity({ _id, text, at }: ActivityDoc) {
  return { id: _id, text, at: at.toISOString() };
}

export function serializeBoard(board: BoardDoc, tasks: TaskDoc[]) {
  return {
    id: board._id,
    title: board.title,
    favorite: board.favorite,
    teamName: board.teamName,
    githubConnected: board.githubConnected,
    members: board.members,
    columns: board.columns,
    tasks: tasks.map(serializeTask),
  };
}
