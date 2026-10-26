import type { Workspace, WorkspaceTask } from "@/lib/kanban";

export function columnKindOf(workspace: Pick<Workspace, "boards">, task: WorkspaceTask) {
  return workspace.boards
    .find((b) => b.id === task.boardId)
    ?.columns.find((c) => c.id === task.columnId)?.kind;
}

/** Still on someone's plate: not done, canceled or a duplicate. */
export function isOpen(workspace: Pick<Workspace, "boards">, task: WorkspaceTask) {
  const kind = columnKindOf(workspace, task);
  return kind !== "done" && kind !== "canceled" && kind !== "duplicated";
}

export function byDueThenPriority(a: WorkspaceTask, b: WorkspaceTask) {
  const due = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  if (due !== 0) return due;
  const rank = { urgent: 0, normal: 1, low: 2 };
  return rank[a.priority] - rank[b.priority];
}
