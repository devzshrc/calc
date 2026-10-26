import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { Activity, BoardSnapshot, BoardSummary, Task } from "@/lib/kanban";
import { api, ApiError } from "./api.server";

const priority = z.enum(["urgent", "normal", "low"]);
const id = z.string().min(1).max(64);

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const taskFields = z.object({
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
  recurrence: z.enum(["daily", "weekdays", "weekly", "monthly"]).nullable(),
  completions: z.array(dayKey).max(1000),
  estimate: z.number().int().min(1).max(1440).nullable(),
  subtasks: z
    .array(z.object({ id, title: z.string().trim().min(1).max(300), done: z.boolean() }))
    .max(100),
  goalId: z.string().max(64).nullable(),
  snoozedUntil: dayKey.nullable(),
  focusOn: dayKey.nullable(),
  completedAt: z.string().nullable(),
});

const fullTask = taskFields.extend({ id, createdAt: z.string() });

export const listBoards = createServerFn({ method: "GET" }).handler(() =>
  api<BoardSummary[]>("/boards"),
);

export const getBoard = createServerFn({ method: "GET" })
  .validator(z.object({ boardId: id }))
  .handler(async ({ data }) => {
    try {
      return await api<BoardSnapshot>(`/boards/${data.boardId}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  });

export const getActivity = createServerFn({ method: "GET" })
  .validator(z.object({ boardId: id }))
  .handler(({ data }) => api<Activity[]>(`/boards/${data.boardId}/activity`));

export const createBoard = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().trim().min(1).max(120) }))
  .handler(({ data }) =>
    api<BoardSummary>("/boards", { method: "POST", body: data }),
  );

export const deleteBoard = createServerFn({ method: "POST" })
  .validator(z.object({ boardId: id }))
  .handler(({ data }) =>
    api(`/boards/${data.boardId}`, { method: "DELETE" }),
  );

export const updateBoard = createServerFn({ method: "POST" })
  .validator(
    z.object({
      boardId: id,
      patch: z
        .object({
          title: z.string().trim().min(1).max(120),
          favorite: z.boolean(),
          columns: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              kind: z.enum([
                "todo",
                "in-progress",
                "done",
                "backlog",
                "canceled",
                "duplicated",
              ]),
              hidden: z.boolean(),
            }),
          ),
          members: z.array(z.object({ id: z.string(), name: z.string() })),
        })
        .partial(),
    }),
  )
  .handler(({ data }) =>
    api<BoardSummary>(`/boards/${data.boardId}`, {
      method: "PATCH",
      body: data.patch,
    }),
  );

export const createTasks = createServerFn({ method: "POST" })
  .validator(z.object({ boardId: id, tasks: z.array(fullTask).max(500) }))
  .handler(({ data }) =>
    api<Task[]>(`/boards/${data.boardId}/tasks/bulk`, {
      method: "POST",
      body: { tasks: data.tasks },
    }),
  );

export const updateTask = createServerFn({ method: "POST" })
  .validator(
    z.object({ boardId: id, taskId: id, patch: taskFields.partial() }),
  )
  .handler(({ data }) =>
    api<Task>(`/boards/${data.boardId}/tasks/${data.taskId}`, {
      method: "PATCH",
      body: data.patch,
    }),
  );

export const deleteTask = createServerFn({ method: "POST" })
  .validator(z.object({ boardId: id, taskId: id }))
  .handler(({ data }) =>
    api(`/boards/${data.boardId}/tasks/${data.taskId}`, { method: "DELETE" }),
  );

export const reorderTasks = createServerFn({ method: "POST" })
  .validator(
    z.object({
      boardId: id,
      tasks: z.array(z.object({ id, columnId: z.string() })),
    }),
  )
  .handler(({ data }) =>
    api(`/boards/${data.boardId}/tasks/order`, {
      method: "PUT",
      body: { tasks: data.tasks },
    }),
  );

export const logActivity = createServerFn({ method: "POST" })
  .validator(z.object({ boardId: id, text: z.string().min(1).max(500) }))
  .handler(({ data }) =>
    api<Activity>(`/boards/${data.boardId}/activity`, {
      method: "POST",
      body: { text: data.text },
    }),
  );
