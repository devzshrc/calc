import { create } from "@/lib/create-store";
import {
  createId,
  newTask,
  PRIORITY_RANK,
  type Activity,
  type BoardData,
  type BoardSnapshot,
  type BoardSummary,
  type Goal,
  type GoalProgress,
  type Task,
  type TaskFields,
} from "@/lib/kanban";
import { completeTask } from "@/lib/recurrence";
import { formatShort } from "@/lib/dates";
import * as server from "@/server/boards";
import * as mutations from "@/lib/task-mutations";
import { useUiStore } from "@/stores/ui-store";

export type TaskInput = Partial<TaskFields> & { title: string; columnId: string };

type KanbanState = BoardData & {
  hydrated: boolean;
  boards: BoardSummary[];
  goals: Goal[];
  progress: GoalProgress;
  load: (board: BoardSnapshot) => void;
  receiveTasks: (tasks: Task[]) => void;
  completeTask: (id: string) => void;
  setActivity: (activity: Activity[]) => void;
  setBoards: (boards: BoardSummary[]) => void;
  setTitle: (title: string) => void;
  toggleFavorite: () => void;
  addMember: (name: string) => void;
  addTask: (input: TaskInput) => string;
  importTasks: (titles: string[], columnId: string) => number;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, columnId: string, beforeId: string | null) => void;
  sortColumn: (columnId: string, by: "priority" | "due") => void;
  renameColumn: (id: string, name: string) => void;
  setColumnHidden: (id: string, hidden: boolean) => void;
  showAllColumns: () => void;
};

const MAX_ACTIVITY = 60;

const EMPTY_BOARD: BoardData = {
  id: "",
  title: "",
  favorite: false,
  teamName: "Personal",
  githubConnected: false,
  members: [],
  columns: [],
  tasks: [],
  activity: [],
};

function columnKind(state: BoardData, columnId: string) {
  return state.columns.find((c) => c.id === columnId)?.kind;
}

/** Keeps completedAt truthful whenever a task crosses into or out of Done. */
function withCompletion(state: BoardData, task: Task, patch: Partial<Task>) {
  if (!patch.columnId || patch.columnId === task.columnId) return patch;
  const wasDone = columnKind(state, task.columnId) === "done";
  const isDone = columnKind(state, patch.columnId) === "done";
  if (isDone && !wasDone) return { ...patch, completedAt: new Date().toISOString(), focusOn: null };
  if (!isDone && wasDone) return { ...patch, completedAt: null };
  return patch;
}

function rolledOver(task: Task, next: string) {
  useUiStore.getState().toast(`“${task.title}” logged · next ${formatShort(next)}`);
}

// Optimistic updates: state changes locally first, then syncs to the API.
function sync(promise: Promise<unknown>) {
  promise.catch((error: unknown) => {
    console.error(error);
    useUiStore.getState().toast("Couldn't save your change");
  });
}

function withActivity(
  boardId: string,
  activity: BoardData["activity"],
  text: string,
) {
  sync(server.logActivity({ data: { boardId, text } }));
  return [
    { id: createId(), text, at: new Date().toISOString() },
    ...activity,
  ].slice(0, MAX_ACTIVITY);
}

function insertAt(
  tasks: Task[],
  moving: Task,
  columnId: string,
  beforeId: string | null,
) {
  const rest = tasks.filter((task) => task.id !== moving.id);
  const moved = { ...moving, columnId };
  const inColumn = rest.filter((task) => task.columnId === columnId);
  const target = beforeId ? rest.find((task) => task.id === beforeId) : null;
  if (target && target.columnId === columnId) {
    const at = rest.indexOf(target);
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }
  if (inColumn.length === 0) return [...rest, moved];
  const last = inColumn[inColumn.length - 1];
  const at = rest.indexOf(last) + 1;
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

function syncOrder(boardId: string, tasks: Task[]) {
  sync(
    mutations.reorderTasks({
      data: {
        boardId,
        tasks: tasks.map(({ id, columnId }) => ({ id, columnId })),
      },
    }),
  );
}

export const useKanbanStore = create<KanbanState>()((set, get) => {
  const patchBoard = (patch: Parameters<typeof server.updateBoard>[0]["data"]["patch"]) =>
    sync(server.updateBoard({ data: { boardId: get().id, patch } }));

  const patchSummary = (patch: Partial<BoardSummary>) =>
    set((state) => ({
      boards: state.boards.map((board) =>
        board.id === state.id ? { ...board, ...patch } : board,
      ),
    }));

  return {
    ...EMPTY_BOARD,
    hydrated: false,
    boards: [],
    goals: [],
    progress: {},
    load: (board) =>
      set({ ...board, teamName: board.title, activity: [], hydrated: true }),
    receiveTasks: (tasks) =>
      set((state) => ({
        tasks: [
          ...state.tasks,
          ...tasks.filter((task) => !state.tasks.some((t) => t.id === task.id)),
        ],
      })),
    completeTask: (id) => {
      const state = get();
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return;
      const { patch, nextDue } = completeTask(task, state.columns);
      if (nextDue) {
        const tasks = state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
        set({
          tasks,
          activity: withActivity(state.id, state.activity, `You completed “${task.title}”`),
        });
        sync(mutations.updateTask({ data: { boardId: state.id, taskId: id, patch } }));
        rolledOver(task, nextDue);
        return;
      }
      get().updateTask(id, patch);
    },
    setActivity: (activity) => set({ activity }),
    setBoards: (boards) => set({ boards }),
    setTitle: (title) => {
      const next = title.trim();
      if (!next) return;
      set({ title: next, teamName: next });
      patchSummary({ title: next });
      patchBoard({ title: next });
    },
    toggleFavorite: () => {
      const favorite = !get().favorite;
      set({ favorite });
      patchSummary({ favorite });
      patchBoard({ favorite });
    },
    addMember: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((state) => ({
        members: [...state.members, { id: createId(), name: trimmed }],
        activity: withActivity(
          state.id,
          state.activity,
          `${trimmed} joined ${state.title}`,
        ),
      }));
      patchBoard({ members: get().members });
    },
    addTask: (input) => {
      const task = newTask({
        ...input,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
      });
      const id = task.id;
      set((state) => ({
        tasks: [...state.tasks, task],
        activity: withActivity(
          state.id,
          state.activity,
          `You created “${task.title}”`,
        ),
      }));
      sync(mutations.createTasks({ data: { boardId: get().id, tasks: [task] } }));
      return id;
    },
    importTasks: (titles, columnId) => {
      const clean = titles.map((title) => title.trim()).filter(Boolean);
      if (clean.length === 0) return 0;
      const created = clean.map((title) => newTask({ title, columnId }));
      set((state) => ({
        tasks: [...state.tasks, ...created],
        activity: withActivity(
          state.id,
          state.activity,
          `You imported ${clean.length} task${clean.length === 1 ? "" : "s"}`,
        ),
      }));
      sync(mutations.createTasks({ data: { boardId: get().id, tasks: created } }));
      return clean.length;
    },
    updateTask: (id, patch) => {
      const state = get();
      const current = state.tasks.find((task) => task.id === id);
      if (!current) return;
      // Dropping a recurring task on Done logs it and rolls it forward instead.
      if (
        current.recurrence &&
        patch.columnId &&
        patch.columnId !== current.columnId &&
        columnKind(state, patch.columnId) === "done"
      ) {
        return get().completeTask(id);
      }
      patch = withCompletion(state, current, patch);
      const next = { ...current, ...patch };
      const moved = Boolean(patch.columnId && patch.columnId !== current.columnId);
      let activity = state.activity;
      if (moved) {
        const column = state.columns.find((c) => c.id === patch.columnId);
        activity = withActivity(
          state.id,
          activity,
          `You moved “${next.title}” to ${column?.name ?? "another column"}`,
        );
      } else if (patch.priority && patch.priority !== current.priority) {
        activity = withActivity(
          state.id,
          activity,
          `You set “${next.title}” to ${patch.priority} priority`,
        );
      } else {
        activity = withActivity(state.id, activity, `You updated “${next.title}”`);
      }
      const tasks = moved
        ? insertAt(state.tasks, next, patch.columnId as string, null)
        : state.tasks.map((task) => (task.id === id ? next : task));
      set({ tasks, activity });
      const { createdAt: _createdAt, ...fields } = patch;
      sync(
        mutations
          .updateTask({ data: { boardId: state.id, taskId: id, patch: fields } })
          .then(() => moved && syncOrder(state.id, tasks)),
      );
    },
    deleteTask: (id) => {
      const state = get();
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return;
      set({
        tasks: state.tasks.filter((item) => item.id !== id),
        activity: withActivity(state.id, state.activity, `You deleted “${task.title}”`),
      });
      sync(mutations.deleteTask({ data: { boardId: state.id, taskId: id } }));
    },
    moveTask: (id, columnId, beforeId) => {
      const state = get();
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return;
      if (task.recurrence && task.columnId !== columnId && columnKind(state, columnId) === "done") {
        return get().completeTask(id);
      }
      const completion = withCompletion(state, task, { columnId });
      const moved = { ...task, ...completion };
      const tasks = insertAt(state.tasks, moved, columnId, beforeId);
      syncOrder(state.id, tasks);
      if (completion.completedAt !== undefined) {
        const { columnId: _c, ...fields } = completion;
        sync(mutations.updateTask({ data: { boardId: state.id, taskId: id, patch: fields } }));
      }
      if (task.columnId === columnId) return set({ tasks });
      const column = state.columns.find((c) => c.id === columnId);
      set({
        tasks,
        activity: withActivity(
          state.id,
          state.activity,
          `You moved “${task.title}” to ${column?.name ?? columnId}`,
        ),
      });
    },
    sortColumn: (columnId, by) => {
      const state = get();
      const inColumn = state.tasks.filter((t) => t.columnId === columnId);
      const sorted = [...inColumn].sort((a, b) => {
        if (by === "priority") {
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        }
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      let cursor = 0;
      const tasks = state.tasks.map((task) =>
        task.columnId === columnId ? sorted[cursor++] : task,
      );
      set({ tasks });
      syncOrder(state.id, tasks);
    },
    renameColumn: (id, name) => {
      set((state) => ({
        columns: state.columns.map((column) =>
          column.id === id && name.trim()
            ? { ...column, name: name.trim() }
            : column,
        ),
      }));
      patchBoard({ columns: get().columns });
    },
    setColumnHidden: (id, hidden) => {
      set((state) => ({
        columns: state.columns.map((column) =>
          column.id === id ? { ...column, hidden } : column,
        ),
      }));
      patchBoard({ columns: get().columns });
    },
    showAllColumns: () => {
      set((state) => ({
        columns: state.columns.map((column) => ({ ...column, hidden: false })),
      }));
      patchBoard({ columns: get().columns });
    },
  };
});
