import { create } from "@/lib/create-store";
import type { Task, Workspace, WorkspaceTask } from "@/lib/kanban";
import { completeTask } from "@/lib/recurrence";
import { formatShort } from "@/lib/dates";
import * as server from "@/server/boards";
import * as mutations from "@/lib/task-mutations";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";

type WorkspaceState = Workspace & {
  loaded: boolean;
  load: (workspace: Workspace) => void;
  patchTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string) => void;
  addTasks: (tasks: WorkspaceTask[]) => void;
  deleteTask: (id: string) => void;
};

function fail(error: unknown) {
  console.error(error);
  useUiStore.getState().toast("Couldn't save your change");
}

/** Mirror a change into the open board so both views stay consistent. */
function mirror(boardId: string, update: (tasks: Task[]) => Task[]) {
  const board = useKanbanStore.getState();
  if (board.id === boardId) useKanbanStore.setState({ tasks: update(board.tasks) });
}

function strip({ boardId: _boardId, ...task }: WorkspaceTask): Task {
  return task;
}

// Cross-board view of everything: Today, Review, Journal and capture write here.
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  boards: [],
  tasks: [],
  goals: [],
  progress: {},
  loaded: false,
  load: (workspace) => set({ ...workspace, loaded: true }),
  patchTask: (id, patch) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    mirror(task.boardId, (tasks) => tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { createdAt: _createdAt, ...fields } = patch;
    mutations
      .updateTask({ data: { boardId: task.boardId, taskId: id, patch: fields } })
      .catch(fail);
  },
  completeTask: (id) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === id);
    const board = state.boards.find((b) => b.id === task?.boardId);
    if (!task || !board) return;
    const { patch, nextDue } = completeTask(task, board.columns);
    get().patchTask(id, patch);
    server
      .logActivity({ data: { boardId: board.id, text: `You completed “${task.title}”` } })
      .catch(fail);
    useUiStore
      .getState()
      .toast(nextDue ? `“${task.title}” logged · next ${formatShort(nextDue)}` : `“${task.title}” done`);
  },
  addTasks: (tasks) => {
    if (tasks.length === 0) return;
    set((state) => ({ tasks: [...state.tasks, ...tasks] }));
    const byBoard = new Map<string, WorkspaceTask[]>();
    for (const task of tasks) {
      byBoard.set(task.boardId, [...(byBoard.get(task.boardId) ?? []), task]);
    }
    for (const [boardId, group] of byBoard) {
      const plain = group.map(strip);
      if (useKanbanStore.getState().id === boardId) {
        useKanbanStore.getState().receiveTasks(plain);
      }
      mutations.createTasks({ data: { boardId, tasks: plain } }).catch(fail);
    }
  },
  deleteTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    mirror(task.boardId, (tasks) => tasks.filter((t) => t.id !== id));
    mutations.deleteTask({ data: { boardId: task.boardId, taskId: id } }).catch(fail);
  },
}));

// Board edits land in the kanban store; fold them back into the workspace.
if (typeof window !== "undefined") {
  useKanbanStore.subscribe((state, prev) => {
    if (!state.id || state.tasks === prev.tasks) return;
    const workspace = useWorkspaceStore.getState();
    if (!workspace.loaded) return;
    useWorkspaceStore.setState({
      tasks: [
        ...workspace.tasks.filter((task) => task.boardId !== state.id),
        ...state.tasks.map((task) => ({ ...task, boardId: state.id })),
      ],
    });
  });
}
