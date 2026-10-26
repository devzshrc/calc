import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Priority, Recurrence } from "@/lib/kanban";
import { api } from "./api.server";

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type CapturedTask = {
  title: string;
  boardId: string;
  priority: Priority;
  dueDate: string | null;
  estimate: number | null;
  recurrence: Recurrence | null;
  description: string;
};

export type DayPlan = { summary: string; focus: { taskId: string; reason: string }[] };

export type ReviewSuggestion = {
  taskId: string;
  action: "reschedule" | "drop" | "breakdown" | "focus";
  reason: string;
  dueDate: string | null;
};

export const aiCapture = createServerFn({ method: "POST" })
  .validator(
    z.object({ text: z.string().trim().min(1).max(8000), today: dayKey, boardId: z.string().optional() }),
  )
  .handler(({ data }) =>
    api<{ tasks: CapturedTask[] }>("/ai/capture", { method: "POST", body: data }),
  );

export const aiBreakdown = createServerFn({ method: "POST" })
  .validator(z.object({ taskId: z.string().min(1) }))
  .handler(({ data }) =>
    api<{ subtasks: string[] }>("/ai/breakdown", { method: "POST", body: data }),
  );

export const aiPlan = createServerFn({ method: "POST" })
  .validator(z.object({ today: dayKey, minutes: z.number().int().min(15).max(960) }))
  .handler(({ data }) => api<DayPlan>("/ai/plan", { method: "POST", body: data }));

export const aiReview = createServerFn({ method: "POST" })
  .validator(z.object({ today: dayKey }))
  .handler(({ data }) =>
    api<{ summary: string; suggestions: ReviewSuggestion[] }>("/ai/review", {
      method: "POST",
      body: data,
    }),
  );

export const aiAsk = createServerFn({ method: "POST" })
  .validator(
    z.object({
      question: z.string().trim().min(1).max(2000),
      today: dayKey,
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
        .max(20),
      journal: z.array(z.object({ day: dayKey, text: z.string().max(4000) })).max(14),
    }),
  )
  .handler(({ data }) => api<{ answer: string }>("/ai/ask", { method: "POST", body: data }));
