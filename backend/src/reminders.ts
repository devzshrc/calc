import webpush from "web-push";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { createHash, randomBytes } from "node:crypto";
import type { AuthEnv } from "./auth";
import { collections } from "./db";
import { enqueueTask } from "./changes";
import { isTaskDone } from "./google";
const pushReady = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const preferences = z.object({
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  digestEnabled: z.boolean(),
  digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export const DEFAULT_PREFERENCES = {
  timezone: "Asia/Kolkata",
  digestEnabled: false,
  digestTime: "08:00",
  quietStart: "22:00",
  quietEnd: "07:00",
};
export const notifications = new Hono<AuthEnv>()
  .get("/", async (c) => {
    const pref = await collections().preferences.findOne({ _id: c.var.userId });
    return c.json({
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      preferences: pref ?? { _id: c.var.userId, ...DEFAULT_PREFERENCES },
      devices: await collections().push.countDocuments({
        userId: c.var.userId,
      }),
    });
  })
  .put("/preferences", zValidator("json", preferences), async (c) => {
    await collections().preferences.updateOne(
      { _id: c.var.userId },
      { $set: c.req.valid("json") },
      { upsert: true },
    );
    return c.json({ ok: true });
  })
  .post(
    "/subscribe",
    zValidator(
      "json",
      z.object({
        endpoint: z.url().refine((v) => {
          const url = new URL(v);
          return (
            url.protocol === "https:" &&
            [
              "fcm.googleapis.com",
              "updates.push.services.mozilla.com",
              "web.push.apple.com",
              "wns2-db5p.notify.windows.com",
            ].some(
              (host) =>
                url.hostname === host || url.hostname.endsWith(`.${host}`),
            )
          );
        }, "Unsupported push service"),
        keys: z.object({
          p256dh: z.string().min(10).max(300),
          auth: z.string().min(10).max(300),
        }),
      }),
    ),
    async (c) => {
      if (!pushReady())
        throw new HTTPException(503, {
          message: "Push keys are not configured",
        });
      const input = c.req.valid("json");
      const id = createHash("sha256").update(input.endpoint).digest("hex");
      await collections().push.updateOne(
        { _id: id },
        {
          $set: {
            ...input,
            userId: c.var.userId,
            actionToken: randomBytes(32).toString("base64url"),
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      return c.json({ ok: true });
    },
  )
  .post(
    "/unsubscribe",
    zValidator("json", z.object({ endpoint: z.string().max(3000) })),
    async (c) => {
      await collections().push.deleteOne({
        userId: c.var.userId,
        endpoint: c.req.valid("json").endpoint,
      });
      return c.json({ ok: true });
    },
  )
  .post("/test", async (c) => {
    const sent = await sendToUser(c.var.userId, {
      title: "You’re connected",
      body: "Task reminders will reach this device, even when Kanban is closed.",
      url: "/today",
    });
    return c.json({ sent });
  });

// Notification actions use a per-subscription capability, not a Clerk cookie.
export const notificationActions = new Hono().post(
  "/push/action",
  zValidator(
    "json",
    z.object({
      token: z.string().min(20).max(100),
      taskId: z.string().max(64),
      action: z.enum(["done", "snooze"]),
    }),
  ),
  async (c) => {
    const { token, taskId, action } = c.req.valid("json");
    const device = await collections().push.findOne({ actionToken: token });
    if (!device)
      throw new HTTPException(401, { message: "Subscription expired" });
    const task = await collections().tasks.findOne({
      _id: taskId,
      userId: device.userId,
    });
    if (!task) throw new HTTPException(404, { message: "Task not found" });
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (action === "snooze")
      patch.reminderAt = new Date(Date.now() + 3600_000).toISOString();
    else {
      const board = await collections().boards.findOne({
        _id: task.boardId,
        userId: device.userId,
      });
      const done = board?.columns.find((col) => col.kind === "done");
      if (task.recurrence) {
        // Same rolling recurrence behavior as completing inside the app.
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: task.timezone ?? "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const date = new Date(
          `${task.dueDate && task.dueDate > day ? task.dueDate : day}T00:00:00Z`,
        );
        if (task.recurrence === "monthly")
          date.setUTCMonth(date.getUTCMonth() + 1);
        else {
          date.setUTCDate(
            date.getUTCDate() + (task.recurrence === "weekly" ? 7 : 1),
          );
          if (task.recurrence === "weekdays")
            while ([0, 6].includes(date.getUTCDay()))
              date.setUTCDate(date.getUTCDate() + 1);
        }
        patch.dueDate = date.toISOString().slice(0, 10);
        patch.completions = [
          ...new Set([...(task.completions ?? []), day]),
        ].slice(-1000);
        patch.scheduledStart = null;
        patch.scheduledEnd = null;
        patch.reminderAt = null;
        patch.focusOn = null;
        patch.subtasks = (task.subtasks ?? []).map((s) => ({
          ...s,
          done: false,
        }));
      } else {
        if (done) patch.columnId = done.id;
        patch.completedAt = new Date().toISOString();
        patch.reminderAt = null;
      }
    }
    await collections().tasks.updateOne(
      { _id: taskId, userId: device.userId },
      { $set: patch },
    );
    await enqueueTask(device.userId, taskId);
    return c.json({ ok: true });
  },
);

export async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url: string; taskId?: string },
) {
  if (!pushReady()) return 0;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@kanban.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  let sent = 0;
  for (const device of await collections().push.find({ userId }).toArray()) {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: device.keys },
        JSON.stringify({
          ...payload,
          actionToken: device.actionToken,
          actionUrl: `${process.env.PUBLIC_API_URL ?? "http://localhost:3001"}/push/action`,
        }),
        { TTL: 3600 },
      );
      sent++;
    } catch (error) {
      if ([404, 410].includes((error as { statusCode: number }).statusCode))
        await collections().push.deleteOne({ _id: device._id });
      else
        console.error(
          "Push delivery failed",
          (error as { statusCode?: number }).statusCode ?? "network error",
        );
    }
  }
  return sent;
}
function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    day: `${v.year}-${v.month}-${v.day}`,
    time: `${v.hour}:${v.minute}`,
  };
}
export function isQuiet(time: string, start: string, end: string) {
  return start === end
    ? false
    : start < end
      ? time >= start && time < end
      : time >= start || time < end;
}
export async function deliverReminders() {
  if (!pushReady()) return;
  const db = collections();
  const users = [
    ...new Set((await db.push.find().toArray()).map((p) => p.userId)),
  ];
  for (const userId of users) {
    const pref =
      (await db.preferences.findOne({ _id: userId })) ?? DEFAULT_PREFERENCES;
    const clock = localClock(pref.timezone);
    if (isQuiet(clock.time, pref.quietStart, pref.quietEnd)) continue;
    const tasks = await db.tasks.find({ userId }).toArray();
    const open = [];
    for (const task of tasks) if (!(await isTaskDone(task))) open.push(task);
    for (const task of open) {
      if (!task.reminderAt || Date.parse(task.reminderAt) > Date.now())
        continue;
      if (task.snoozedUntil && task.snoozedUntil > clock.day) continue;
      const sent = await sendToUser(userId, {
        title: task.title,
        body: task.scheduledStart
          ? `Your focus block starts ${new Date(task.scheduledStart).toLocaleTimeString("en", { timeZone: task.timezone ?? pref.timezone, hour: "numeric", minute: "2-digit" })}`
          : "A little nudge for your task.",
        url: `/b/${encodeURIComponent(task.boardId)}?task=${encodeURIComponent(task._id)}`,
        taskId: task._id,
      });
      if (sent)
        await db.tasks.updateOne(
          { _id: task._id, userId, reminderAt: task.reminderAt },
          { $set: { reminderAt: null } },
        );
    }
    if (
      pref.digestEnabled &&
      clock.time >= pref.digestTime &&
      ("lastDigest" in pref ? pref.lastDigest : null) !== clock.day
    ) {
      const due = open.filter(
        (t) => (t.dueDate && t.dueDate <= clock.day) || t.focusOn === clock.day,
      );
      const sent = await sendToUser(userId, {
        title: "A fresh start",
        body: due.length
          ? `${due.length} tasks need you today. Take them one at a time.`
          : "Your day is clear. Make room for a goal.",
        url: "/today",
      });
      if (sent)
        await db.preferences.updateOne(
          { _id: userId },
          { $set: { ...pref, lastDigest: clock.day } },
          { upsert: true },
        );
    }
  }
}
