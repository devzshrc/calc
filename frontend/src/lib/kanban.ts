export type Priority = "urgent" | "normal" | "low";

export type ColumnKind =
  | "todo"
  | "in-progress"
  | "done"
  | "backlog"
  | "canceled"
  | "duplicated";

export type Member = { id: string; name: string };

export type Column = {
  id: string;
  name: string;
  kind: ColumnKind;
  hidden: boolean;
};

export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly";

export type Subtask = { id: string; title: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  description: string;
  columnId: string;
  priority: Priority;
  assigneeIds: string[];
  createdAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  reminderAt: string | null;
  timezone: string;
  dueDate: string | null;
  recurrence: Recurrence | null;
  /** Day keys a recurring task was completed on; drives streaks and the habit grid. */
  completions: string[];
  /** Minutes. */
  estimate: number | null;
  subtasks: Subtask[];
  goalId: string | null;
  snoozedUntil: string | null;
  /** Day key the task is pinned to Today's focus for. */
  focusOn: string | null;
  completedAt: string | null;
};

export type TaskFields = Omit<Task, "id" | "createdAt">;

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const ESTIMATES = [15, 30, 60, 120];

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function newTask(fields: Partial<TaskFields> & { title: string; columnId: string }): Task {
  return {
    id: createId(),
    description: "",
    priority: "normal",
    assigneeIds: [],
    scheduledStart: null,
    scheduledEnd: null,
    reminderAt: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dueDate: null,
    recurrence: null,
    completions: [],
    estimate: null,
    subtasks: [],
    goalId: null,
    snoozedUntil: null,
    focusOn: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

export type Activity = { id: string; text: string; at: string };

export type BoardSummary = { id: string; title: string; favorite: boolean };

export type BoardData = {
  id: string;
  title: string;
  favorite: boolean;
  teamName: string;
  githubConnected: boolean;
  members: Member[];
  columns: Column[];
  tasks: Task[];
  activity: Activity[];
};

export type Goal = { id: string; title: string };
export type GoalProgress = Record<string, { done: number; total: number }>;

export type BoardSnapshot = Omit<BoardData, "activity"> & {
  goals: Goal[];
  progress: GoalProgress;
};

export type WorkspaceBoard = BoardSummary & { columns: Column[] };
export type WorkspaceTask = Task & { boardId: string };
export type Workspace = {
  boards: WorkspaceBoard[];
  tasks: WorkspaceTask[];
  goals: Goal[];
  progress: GoalProgress;
};

export type JournalEntry = { day: string; text: string; updatedAt: string };

export const CURRENT_USER_ID = "me";

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function memberLabel(task: Task, members: Member[]) {
  const names = task.assigneeIds
    .map((id) => members.find((member) => member.id === id)?.name)
    .filter(Boolean) as string[];
  if (names.length === 0) return "Unassigned";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export function crewLabel(_task: Task, teamName: string) {
  return teamName;
}

