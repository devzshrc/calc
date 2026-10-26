import { z } from "zod";

export const priority = z.enum(["urgent", "normal", "low"]);
export const columnKind = z.enum([
  "todo",
  "in-progress",
  "done",
  "backlog",
  "canceled",
  "duplicated",
]);

export const column = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  kind: columnKind,
  hidden: z.boolean(),
});

export const member = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
});

export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const recurrence = z.enum(["daily", "weekdays", "weekly", "monthly"]);
export const subtask = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(300),
  done: z.boolean(),
});

export const taskInput = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10_000).default(""),
    columnId: z.string().min(1),
    priority: priority.default("normal"),
    assigneeIds: z.array(z.string()).default([]),
    createdAt: z.iso.datetime().optional(),
    scheduledStart: z.iso.datetime().nullable().default(null),
    scheduledEnd: z.iso.datetime().nullable().default(null),
    reminderAt: z.iso.datetime().nullable().default(null),
    timezone: z.string().max(100).default("Asia/Kolkata"),
    dueDate: dayKey.nullable().default(null),
    recurrence: recurrence.nullable().default(null),
    completions: z.array(dayKey).max(1000).default([]),
    estimate: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .nullable()
      .default(null),
    subtasks: z.array(subtask).max(100).default([]),
    goalId: z.string().max(64).nullable().default(null),
    snoozedUntil: dayKey.nullable().default(null),
    focusOn: dayKey.nullable().default(null),
    completedAt: z.iso.datetime().nullable().default(null),
  })
  .refine(
    (t) =>
      Boolean(t.scheduledStart) === Boolean(t.scheduledEnd) &&
      (!t.scheduledStart ||
        !t.scheduledEnd ||
        t.scheduledEnd > t.scheduledStart),
    {
      message: "Choose a time block with an end after its start",
      path: ["scheduledEnd"],
    },
  );

// No defaults on patches: absent keys must stay untouched.
export const taskPatch = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10_000),
    columnId: z.string().min(1),
    priority,
    assigneeIds: z.array(z.string()),
    scheduledStart: z.iso.datetime().nullable(),
    scheduledEnd: z.iso.datetime().nullable(),
    reminderAt: z.iso.datetime().nullable(),
    timezone: z.string().max(100),
    dueDate: dayKey.nullable(),
    recurrence: recurrence.nullable(),
    completions: z.array(dayKey).max(1000),
    estimate: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .nullable(),
    subtasks: z.array(subtask).max(100),
    goalId: z.string().max(64).nullable(),
    snoozedUntil: dayKey.nullable(),
    focusOn: dayKey.nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .partial();

export const journalInput = z.object({ text: z.string().max(20_000) });

export const boardInput = z.object({
  title: z.string().trim().min(1).max(120),
  teamName: z.string().trim().min(1).max(60).optional(),
});

export const boardPatch = z
  .object({
    title: z.string().trim().min(1).max(120),
    favorite: z.boolean(),
    teamName: z.string().trim().min(1).max(60),
    githubConnected: z.boolean(),
    columns: z.array(column).min(1),
    members: z.array(member),
  })
  .partial();

export const orderInput = z.object({
  tasks: z.array(z.object({ id: z.string(), columnId: z.string() })),
});

export const activityInput = z.object({ text: z.string().min(1).max(500) });

export type Column = z.infer<typeof column>;
export type Member = z.infer<typeof member>;

export type BoardDoc = {
  _id: string;
  userId: string;
  title: string;
  favorite: boolean;
  teamName: string;
  githubConnected: boolean;
  members: Member[];
  columns: Column[];
  position: number;
  createdAt: Date;
};

export type TaskDoc = {
  _id: string;
  userId: string;
  boardId: string;
  title: string;
  description: string;
  columnId: string;
  priority: z.infer<typeof priority>;
  assigneeIds: string[];
  createdAt: Date;
  dueDate: string | null;
  recurrence: z.infer<typeof recurrence> | null;
  completions: string[];
  estimate: number | null;
  subtasks: z.infer<typeof subtask>[];
  goalId: string | null;
  snoozedUntil: string | null;
  focusOn: string | null;
  completedAt: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  reminderAt?: string | null;
  timezone?: string;
  updatedAt?: string;
  position: number;
};

/** _id is `${userId}:${day}`. */
export type JournalDoc = {
  _id: string;
  userId: string;
  day: string;
  text: string;
  updatedAt: Date;
};

export type UserDoc = {
  _id: string;
  calendarToken: string;
  createdAt: Date;
  integrations?: Partial<
    Record<"calendar" | "tasks", { googleId: string; resourceId: string }>
  >;
};

export type ActivityDoc = {
  _id: string;
  userId: string;
  boardId: string;
  text: string;
  at: Date;
};

export type ChangeDoc = {
  _id: string;
  userId: string;
  at: Date;
  undone?: boolean;
  changes: { before: TaskDoc | null; after: TaskDoc | null }[];
};
export type ConnectionDoc = {
  _id: string;
  userId: string;
  service: "calendar" | "tasks" | "gmail";
  refreshToken: string;
  scopes: string[];
  account: string;
  googleId: string;
  resourceId?: string;
  syncToken?: string;
  lastSync?: string;
  error?: string | null;
  leaseUntil?: Date;
  nextPoll?: Date;
  watch?: { id: string; token: string; resourceId: string; expires: number };
};
export type SyncJobDoc = {
  _id: string;
  userId: string;
  taskId: string;
  at: Date;
  attempts: number;
  nextRun: Date;
  deleted?: TaskDoc;
  error?: string;
};
export type SyncMapDoc = {
  _id: string;
  userId: string;
  taskId: string;
  service: string;
  remoteId: string;
  remoteUpdated?: string;
  remoteEtag?: string;
  localUpdated?: string;
  suppressed?: boolean;
};
export type OAuthStateDoc = {
  _id: string;
  userId: string;
  service: ConnectionDoc["service"];
  verifier: string;
  expiresAt: Date;
};
export type PushDoc = {
  _id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  actionToken: string;
  createdAt: Date;
};
export type PreferenceDoc = {
  _id: string;
  timezone: string;
  digestEnabled: boolean;
  digestTime: string;
  quietStart: string;
  quietEnd: string;
  lastDigest?: string;
};
export type FocusDoc = {
  _id: string;
  userId: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
};
