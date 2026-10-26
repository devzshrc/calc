import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { JournalEntry, Workspace } from "@/lib/kanban";
import { api } from "./api.server";

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getWorkspace = createServerFn({ method: "GET" }).handler(() =>
  api<Workspace>("/workspace"),
);

export const listJournal = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(365).default(60) }))
  .handler(({ data }) => api<JournalEntry[]>(`/journal?limit=${data.limit}`));

export const saveJournal = createServerFn({ method: "POST" })
  .validator(z.object({ day: dayKey, text: z.string().max(20_000) }))
  .handler(({ data }) =>
    api<JournalEntry | undefined>(`/journal/${data.day}`, {
      method: "PUT",
      body: { text: data.text },
    }),
  );

// The feed is served by the API with a per-user secret token in the path.
export const getCalendarUrl = createServerFn({ method: "GET" }).handler(async () => {
  const origin = process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001";
  const { token } = await api<{ token: string }>("/workspace/calendar-token");
  return `${origin}/calendar/${token}.ics`;
});
