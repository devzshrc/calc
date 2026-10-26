import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "./api.server";
export type GoogleEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendar: string;
  url: string;
  busy: boolean;
};
export type Connections = {
  configured: boolean;
  redirectUri: string;
  services: {
    service: "calendar" | "tasks" | "gmail";
    account: string;
    lastSync: string | null;
    error: string | null;
  }[];
};
export type Preferences = {
  timezone: string;
  digestEnabled: boolean;
  digestTime: string;
  quietStart: string;
  quietEnd: string;
};
export type NotificationSettings = {
  publicKey: string | null;
  preferences: Preferences;
  devices: number;
};
export type FocusSession = {
  _id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
};
export const getConnections = createServerFn({ method: "GET" }).handler(() =>
  api<Connections>("/connections"),
);
export const connectGoogle = createServerFn({ method: "POST" })
  .validator(z.object({ service: z.enum(["calendar", "tasks", "gmail"]) }))
  .handler(({ data }) =>
    api<{ url: string }>("/connections/connect", {
      method: "POST",
      body: data,
    }),
  );
export const disconnectGoogle = createServerFn({ method: "POST" })
  .validator(z.object({ service: z.enum(["calendar", "tasks", "gmail"]) }))
  .handler(({ data }) =>
    api("/connections/disconnect", { method: "POST", body: data }),
  );
export const syncGoogle = createServerFn({ method: "POST" }).handler(() =>
  api("/connections/sync", { method: "POST" }),
);
export const getGoogleEvents = createServerFn({ method: "GET" })
  .validator(z.object({ start: z.iso.datetime(), end: z.iso.datetime() }))
  .handler(({ data }) =>
    api<GoogleEvent[]>(`/connections/events?${new URLSearchParams(data)}`),
  );
export const getTaskLists = createServerFn({ method: "GET" }).handler(() =>
  api<{ id: string; title: string }[]>("/connections/task-lists"),
);
export const importGoogleTasks = createServerFn({ method: "POST" })
  .validator(
    z.object({ listId: z.string().max(300), boardId: z.string().max(64) }),
  )
  .handler(({ data }) =>
    api<{ count: number }>("/connections/import", {
      method: "POST",
      body: data,
    }),
  );
export const undoChange = createServerFn({ method: "POST" }).handler(() =>
  api("/history/undo", { method: "POST" }),
);
export const getNotificationSettings = createServerFn({
  method: "GET",
}).handler(() => api<NotificationSettings>("/notifications"));
export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .validator(
    z.object({
      timezone: z.string(),
      digestEnabled: z.boolean(),
      digestTime: z.string(),
      quietStart: z.string(),
      quietEnd: z.string(),
    }),
  )
  .handler(({ data }) =>
    api("/notifications/preferences", { method: "PUT", body: data }),
  );
export const subscribePush = createServerFn({ method: "POST" })
  .validator(
    z.object({
      endpoint: z.string(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    }),
  )
  .handler(({ data }) =>
    api("/notifications/subscribe", { method: "POST", body: data }),
  );
export const unsubscribePush = createServerFn({ method: "POST" })
  .validator(z.object({ endpoint: z.string() }))
  .handler(({ data }) =>
    api("/notifications/unsubscribe", { method: "POST", body: data }),
  );
export const testPush = createServerFn({ method: "POST" }).handler(() =>
  api<{ sent: number }>("/notifications/test", { method: "POST" }),
);
export const getFocusSessions = createServerFn({ method: "GET" }).handler(() =>
  api<FocusSession[]>("/focus"),
);
export const startFocus = createServerFn({ method: "POST" })
  .validator(z.object({ taskId: z.string().max(64) }))
  .handler(({ data }) =>
    api<FocusSession>("/focus/start", { method: "POST", body: data }),
  );
export const stopFocus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().max(64) }))
  .handler(({ data }) =>
    api<FocusSession>("/focus/stop", { method: "POST", body: data }),
  );
