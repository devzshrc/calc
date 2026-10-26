import { collections } from "./db";
import { serializeTask } from "./serialize";

export const GOAL_BOARD = /goal/i;

// Every board with its tasks; the basis for cross-board views and AI context.
export async function loadWorkspace(userId: string) {
  const { boards, tasks } = collections();
  const [boardDocs, taskDocs] = await Promise.all([
    boards.find({ userId }).sort({ position: 1 }).toArray(),
    tasks.find({ userId }).sort({ position: 1 }).toArray(),
  ]);
  return {
    boards: boardDocs.map((board) => ({
      id: board._id,
      title: board.title,
      favorite: board.favorite,
      columns: board.columns,
    })),
    tasks: taskDocs.map((task) => ({ ...serializeTask(task), boardId: task.boardId })),
  };
}

export type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;

export function isDone(workspace: Workspace, task: Workspace["tasks"][number]) {
  const board = workspace.boards.find((b) => b.id === task.boardId);
  return board?.columns.find((c) => c.id === task.columnId)?.kind === "done";
}

// Goals are tasks on a board named like "Goals"; progress comes from linked tasks.
export function goalSummary(workspace: Workspace) {
  const goalBoards = new Set(
    workspace.boards.filter((b) => GOAL_BOARD.test(b.title)).map((b) => b.id),
  );
  const goals = workspace.tasks
    .filter((task) => goalBoards.has(task.boardId))
    .map((task) => ({ id: task.id, title: task.title }));
  const progress: Record<string, { done: number; total: number }> = {};
  for (const task of workspace.tasks) {
    if (!task.goalId) continue;
    const entry = (progress[task.goalId] ??= { done: 0, total: 0 });
    entry.total += 1;
    if (isDone(workspace, task)) entry.done += 1;
  }
  return { goals, progress };
}
