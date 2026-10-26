import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { collections } from "./db";
import { enqueueTask } from "./changes";
import type { ConnectionDoc, TaskDoc } from "./types";

export const SCOPES = {
  calendar: [
    "https://www.googleapis.com/auth/calendar.calendars",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  ],
  tasks: ["https://www.googleapis.com/auth/tasks"],
  gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
};
export const redirectUri = () =>
  `${process.env.PUBLIC_API_URL ?? "http://localhost:3001"}/google/callback`;
export const appOrigin = () => process.env.APP_URL ?? "http://localhost:3000";
export const configured = () =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.TOKEN_ENCRYPTION_KEY,
  );
function key() {
  const value = process.env.TOKEN_ENCRYPTION_KEY;
  if (!value || Buffer.from(value, "base64").length !== 32)
    throw new HTTPException(503, {
      message: "Google token encryption is not configured",
    });
  return Buffer.from(value, "base64");
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export async function startConnection(
  userId: string,
  service: ConnectionDoc["service"],
) {
  if (!configured())
    throw new HTTPException(503, {
      message:
        "Google connection needs an OAuth client. See Settings → Connections for setup.",
    });
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  await collections().oauthStates.insertOne({
    _id: state,
    userId,
    service,
    verifier,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ["openid", "email", ...SCOPES[service]].join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function tokenExchange(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!response.ok)
    throw new HTTPException(502, {
      message:
        "Google authorization expired or was revoked. Reconnect this service.",
    });
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    scope: string;
    expires_in: number;
  }>;
}
const tokens = new Map<string, { token: string; until: number }>();
export function clearToken(id: string) {
  tokens.delete(id);
}
export async function accessToken(connection: ConnectionDoc) {
  const cached = tokens.get(connection._id);
  if (cached && cached.until > Date.now()) return cached.token;
  const data = await tokenExchange({
    grant_type: "refresh_token",
    refresh_token: decrypt(connection.refreshToken),
  });
  tokens.set(connection._id, {
    token: data.access_token,
    until: Date.now() + (data.expires_in - 60) * 1000,
  });
  return data.access_token;
}
export class GoogleError extends Error {
  constructor(public status: number) {
    super(
      `Google returned ${status}${status === 401 || status === 403 ? ". Reconnect and grant the requested permission." : ". Sync will retry automatically."}`,
    );
  }
}
export async function google<T = any>(
  connection: ConnectionDoc,
  url: string,
  method = "GET",
  body?: unknown,
  etag?: string,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${await accessToken(connection)}`,
      "content-type": "application/json",
      ...(etag ? { "if-match": etag } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401) clearToken(connection._id);
    throw new GoogleError(response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const CAL = "https://www.googleapis.com/calendar/v3";
export const TASKS = "https://tasks.googleapis.com/tasks/v1";
const enc = encodeURIComponent;
export async function ensureResource(c: ConnectionDoc) {
  if (c.resourceId) return c.resourceId;
  const saved = (await collections().users.findOne({ _id: c.userId }))
    ?.integrations?.[c.service as "calendar" | "tasks"];
  if (saved && saved.googleId === c.googleId) {
    c.resourceId = saved.resourceId;
    await collections().connections.updateOne(
      { _id: c._id },
      { $set: { resourceId: saved.resourceId } },
    );
    return saved.resourceId;
  }
  const resource =
    c.service === "calendar"
      ? await google(c, `${CAL}/calendars`, "POST", {
          summary: "Kanban",
          description: "Tasks and focus blocks from Kanban",
        })
      : await google(c, `${TASKS}/users/@me/lists`, "POST", {
          title: "Kanban",
        });
  await collections().connections.updateOne(
    { _id: c._id },
    { $set: { resourceId: resource.id } },
  );
  await collections().users.updateOne(
    { _id: c.userId },
    {
      $set: {
        [`integrations.${c.service}`]: {
          googleId: c.googleId,
          resourceId: resource.id,
        },
      },
    },
  );
  c.resourceId = resource.id;
  return resource.id as string;
}
function nextDate(day: string) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400_000)
    .toISOString()
    .slice(0, 10);
}
export async function isTaskDone(t: TaskDoc) {
  const board = await collections().boards.findOne({
    _id: t.boardId,
    userId: t.userId,
  });
  return (
    Boolean(t.completedAt) ||
    ["done", "canceled", "duplicated"].includes(
      board?.columns.find((c) => c.id === t.columnId)?.kind ?? "",
    )
  );
}
export async function eventBody(t: TaskDoc) {
  const board = await collections().boards.findOne({
    _id: t.boardId,
    userId: t.userId,
  });
  const url = `${appOrigin()}/b/${enc(t.boardId)}?task=${enc(t._id)}`;
  const timed = Boolean(t.scheduledStart && t.scheduledEnd);
  return {
    summary: t.title,
    description: `${t.description ?? ""}\n\n${board?.title ?? "Kanban"} · ${url}`,
    colorId: /stud/i.test(board?.title ?? "")
      ? "9"
      : /goal/i.test(board?.title ?? "")
        ? "5"
        : "2",
    start: timed
      ? { dateTime: t.scheduledStart, timeZone: t.timezone ?? "Asia/Kolkata" }
      : { date: t.dueDate },
    end: timed
      ? { dateTime: t.scheduledEnd, timeZone: t.timezone ?? "Asia/Kolkata" }
      : { date: nextDate(t.dueDate!) },
    reminders: {
      useDefault: false,
      overrides:
        t.reminderAt && t.scheduledStart
          ? [
              {
                method: "popup",
                minutes: Math.max(
                  0,
                  Math.min(
                    40320,
                    Math.round(
                      (Date.parse(t.scheduledStart) -
                        Date.parse(t.reminderAt)) /
                        60000,
                    ),
                  ),
                ),
              },
            ]
          : [],
    },
    extendedProperties: { private: { kanbanTaskId: t._id } },
  };
}
async function pushTask(c: ConnectionDoc, taskId: string, deleted?: TaskDoc) {
  const { tasks, syncMaps } = collections();
  const task = await tasks.findOne({ _id: taskId, userId: c.userId });
  const mapId = `${c.userId}:${c.service}:${taskId}`;
  let map = await syncMaps.findOne({ _id: mapId });
  if (task && map?.suppressed && map.localUpdated === task.updatedAt) return;
  const resource = await ensureResource(c);
  const root =
    c.service === "calendar"
      ? `${CAL}/calendars/${enc(resource)}/events`
      : `${TASKS}/lists/${enc(resource)}/tasks`;
  const done = task ? await isTaskDone(task) : false;
  const shouldRemove =
    !task ||
    (c.service === "calendar" &&
      (done || (!task.scheduledStart && !task.dueDate)));
  if (shouldRemove) {
    if (map) {
      try {
        await google(c, `${root}/${enc(map.remoteId)}`, "DELETE");
      } catch (e) {
        if (!(e instanceof GoogleError && [404, 410].includes(e.status)))
          throw e;
      }
      await syncMaps.deleteOne({ _id: mapId });
    }
    return;
  }
  const body =
    c.service === "calendar"
      ? await eventBody(task!)
      : {
          title: task!.title,
          notes: `${task!.description ?? ""}\n\n${appOrigin()}/b/${enc(task!.boardId)}?task=${enc(taskId)}`,
          due: task!.dueDate ? `${task!.dueDate}T00:00:00Z` : null,
          status: done ? "completed" : "needsAction",
          completed: done
            ? (task!.completedAt ?? new Date().toISOString())
            : null,
        };
  let remote;
  try {
    remote = await google(
      c,
      map ? `${root}/${enc(map.remoteId)}` : root,
      map ? "PATCH" : "POST",
      body,
      c.service === "calendar" ? map?.remoteEtag : undefined,
    );
  } catch (e) {
    if (!map || !(e instanceof GoogleError) || ![404, 410].includes(e.status))
      throw e;
    remote = await google(c, root, "POST", body);
  }
  await syncMaps.replaceOne(
    { _id: mapId },
    {
      userId: c.userId,
      taskId,
      service: c.service,
      remoteId: remote.id,
      localUpdated: task!.updatedAt,
      remoteUpdated: remote.updated,
      remoteEtag: remote.etag,
      suppressed: false,
    },
    { upsert: true },
  );
}
async function applyRemote(c: ConnectionDoc, remote: any) {
  const { syncMaps, tasks, boards, activity } = collections();
  let map = await syncMaps.findOne({
    userId: c.userId,
    service: c.service,
    remoteId: remote.id,
  });
  if (!map) {
    // Recover an acknowledged remote create whose response was lost before saving the mapping.
    const linkedId =
      remote.extendedProperties?.private?.kanbanTaskId ??
      remote.notes?.match(/[?&]task=([^\s]+)/)?.[1];
    const linked = linkedId
      ? await tasks.findOne({
          _id: decodeURIComponent(linkedId),
          userId: c.userId,
        })
      : null;
    if (!linked) return;
    const id = `${c.userId}:${c.service}:${linked._id}`;
    await syncMaps.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          userId: c.userId,
          taskId: linked._id,
          service: c.service,
          remoteId: remote.id,
          localUpdated: linked.updatedAt,
          remoteUpdated: remote.updated,
          remoteEtag: remote.etag,
        },
      },
      { upsert: true },
    );
    return;
  }
  if (map.remoteUpdated === remote.updated) return;
  const task = await tasks.findOne({ _id: map.taskId, userId: c.userId });
  if (!task) return;
  // Local edits newer than this remote revision win and will be sent by the queue.
  if (task.updatedAt && remote.updated && task.updatedAt > remote.updated)
    return;
  const patch: Partial<TaskDoc> = {};
  if (c.service === "calendar") {
    if (remote.status === "cancelled") {
      patch.scheduledStart = null;
      patch.scheduledEnd = null;
      patch.reminderAt = null;
    } else {
      patch.title = remote.summary || task.title;
      patch.scheduledStart = remote.start?.dateTime
        ? new Date(remote.start.dateTime).toISOString()
        : null;
      patch.scheduledEnd = remote.end?.dateTime
        ? new Date(remote.end.dateTime).toISOString()
        : null;
      if (remote.start?.date) patch.dueDate = remote.start.date;
      // Don't copy our generated footer back into notes.
      if (typeof remote.description === "string")
        patch.description = remote.description
          .split("\n\n")
          .filter((s: string) => !s.includes(`${appOrigin()}/b/`))
          .join("\n\n");
    }
  } else {
    if (remote.deleted) {
      await syncMaps.updateOne(
        { _id: map._id },
        {
          $set: {
            suppressed: true,
            localUpdated: task.updatedAt,
            remoteUpdated: remote.updated,
          },
        },
      );
      return;
    }
    patch.title = remote.title || task.title;
    patch.description = (remote.notes ?? "").split(`\n\n${appOrigin()}/b/`)[0];
    patch.dueDate = remote.due?.slice(0, 10) ?? null;
    const board = await boards.findOne({ _id: task.boardId, userId: c.userId });
    if (remote.status === "completed" && task.recurrence) {
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
      patch.subtasks = (task.subtasks ?? []).map((s) => ({
        ...s,
        done: false,
      }));
      await syncMaps.deleteOne({ _id: map._id }); // new occurrence gets a fresh Google task
    } else {
      const target = board?.columns.find(
        (col) => col.kind === (remote.status === "completed" ? "done" : "todo"),
      );
      const wasDone = await isTaskDone(task);
      if (target && (remote.status === "completed" || wasDone))
        patch.columnId = target.id;
      patch.completedAt =
        remote.status === "completed"
          ? (remote.completed ?? new Date().toISOString())
          : null;
    }
  }
  patch.updatedAt = new Date().toISOString();
  const changed = await tasks.updateOne(
    { _id: task._id, userId: c.userId, updatedAt: task.updatedAt },
    { $set: patch },
  );
  if (!changed.matchedCount) return;
  await syncMaps.updateOne(
    { _id: map._id },
    {
      $set: {
        remoteUpdated: remote.updated,
        remoteEtag: remote.etag,
        localUpdated: patch.updatedAt,
        suppressed: remote.status === "cancelled",
      },
    },
  );
  await activity.insertOne({
    _id: crypto.randomUUID(),
    userId: c.userId,
    boardId: task.boardId,
    text: `Updated “${patch.title ?? task.title}” from Google ${c.service === "calendar" ? "Calendar" : "Tasks"}`,
    at: new Date(),
  });
  // Propagate between Calendar and Tasks, avoiding echo via revision maps.
  await enqueueTask(c.userId, task._id);
}
export async function pullChanges(c: ConnectionDoc) {
  const resource = await ensureResource(c);
  let page: string | undefined;
  const since = c.lastSync;
  do {
    const params = new URLSearchParams(
      c.service === "calendar"
        ? {
            maxResults: "2500",
            showDeleted: "true",
            ...(c.syncToken ? { syncToken: c.syncToken } : {}),
          }
        : {
            maxResults: "100",
            showCompleted: "true",
            showHidden: "true",
            showDeleted: "true",
            ...(since ? { updatedMin: since } : {}),
          },
    );
    if (page) params.set("pageToken", page);
    const url =
      c.service === "calendar"
        ? `${CAL}/calendars/${enc(resource)}/events?${params}`
        : `${TASKS}/lists/${enc(resource)}/tasks?${params}`;
    let result;
    try {
      result = await google(c, url);
    } catch (e) {
      if (e instanceof GoogleError && e.status === 410 && c.syncToken) {
        c.syncToken = undefined;
        await collections().connections.updateOne(
          { _id: c._id },
          { $unset: { syncToken: "" } },
        );
        return pullChanges(c);
      }
      throw e;
    }
    for (const item of result.items ?? []) await applyRemote(c, item);
    page = result.nextPageToken;
    if (result.nextSyncToken)
      await collections().connections.updateOne(
        { _id: c._id },
        { $set: { syncToken: result.nextSyncToken } },
      );
  } while (page);
}
export async function syncConnection(id: string, force = false) {
  const { connections, syncJobs } = collections();
  const now = new Date();
  const c = await connections.findOneAndUpdate(
    {
      _id: id,
      service: { $ne: "gmail" },
      $or: [{ leaseUntil: { $lt: now } }, { leaseUntil: { $exists: false } }],
    },
    { $set: { leaseUntil: new Date(Date.now() + 5 * 60_000) } },
    { returnDocument: "after" },
  );
  if (!c) return;
  try {
    const pulled = force || !c.nextPoll || c.nextPoll <= now;
    if (pulled) {
      await pullChanges(c);
      await ensureWatch(c);
    }
    const jobs = await syncJobs
      .find({
        userId: c.userId,
        _id: { $regex: `:${c.service}:` },
        nextRun: { $lte: now },
      })
      .sort({ at: 1 })
      .limit(100)
      .toArray();
    for (const job of jobs) {
      await connections.updateOne(
        { _id: id },
        { $set: { leaseUntil: new Date(Date.now() + 5 * 60_000) } },
      );
      try {
        await pushTask(c, job.taskId, job.deleted);
        await syncJobs.deleteOne({ _id: job._id, at: job.at });
      } catch (error) {
        await syncJobs.updateOne(
          { _id: job._id, at: job.at },
          {
            $set: {
              nextRun: new Date(
                Date.now() +
                  Math.min(
                    3600_000,
                    1000 * 2 ** Math.min(job.attempts + 1, 12),
                  ),
              ),
              error: error instanceof Error ? error.message : "Sync failed",
            },
            $inc: { attempts: 1 },
          },
        );
        throw error;
      }
    }
    await connections.updateOne(
      { _id: id },
      {
        $set: {
          error: null,
          ...(pulled
            ? {
                lastSync: now.toISOString(),
                nextPoll: new Date(
                  Date.now() + (c.service === "tasks" ? 120_000 : 300_000),
                ),
              }
            : {}),
        },
      },
    );
  } catch (error) {
    await connections.updateOne(
      { _id: id },
      {
        $set: {
          error: error instanceof Error ? error.message : "Sync failed",
          nextPoll: new Date(Date.now() + 60_000),
        },
      },
    );
  } finally {
    await connections.updateOne({ _id: id }, { $unset: { leaseUntil: "" } });
  }
}

async function ensureWatch(c: ConnectionDoc) {
  const url = process.env.GOOGLE_WEBHOOK_URL;
  if (
    c.service !== "calendar" ||
    !url?.startsWith("https://") ||
    (c.watch && c.watch.expires > Date.now() + 86400000)
  )
    return;
  const id = crypto.randomUUID(),
    token = randomBytes(32).toString("base64url");
  const result = await google(
    c,
    `${CAL}/calendars/${encodeURIComponent(await ensureResource(c))}/events/watch`,
    "POST",
    { id, type: "web_hook", address: url, token },
  );
  const watch = {
    id,
    token,
    resourceId: result.resourceId,
    expires: Number(result.expiration),
  };
  const previous = c.watch;
  await collections().connections.updateOne(
    { _id: c._id },
    { $set: { watch } },
  );
  if (previous)
    try {
      await google(c, `${CAL}/channels/stop`, "POST", {
        id: previous.id,
        resourceId: previous.resourceId,
      });
    } catch {}
}
