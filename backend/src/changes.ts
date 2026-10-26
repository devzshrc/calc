import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { collections } from "./db";
import type { AuthEnv } from "./auth";
import type { TaskDoc } from "./types";

export async function enqueueTask(
  userId: string,
  taskId: string,
  deleted?: TaskDoc,
) {
  const at = new Date();
  for (const service of ["calendar", "tasks"]) {
    await collections().syncJobs.updateOne(
      { _id: `${userId}:${service}:${taskId}` },
      {
        $set: {
          userId,
          taskId,
          at,
          attempts: 0,
          nextRun: at,
          ...(deleted ? { deleted } : {}),
        },
        ...(!deleted ? { $unset: { deleted: "" } } : {}),
      },
      { upsert: true },
    );
  }
}

// One mutation = one undo group, including bulk creation and drag reorder.
export const trackChanges = createMiddleware<AuthEnv>(async (c, next) => {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method) ||
    !c.req.path.includes("/tasks")
  )
    return next();
  const userId = c.var.userId;
  const match = c.req.path.match(/\/boards\/([^/]+)\/tasks(?:\/([^/]+))?/);
  if (!match) return next();
  const body =
    c.req.method !== "DELETE"
      ? await c.req.raw
          .clone()
          .json()
          .catch(() => ({}))
      : {};
  const ids: string[] =
    match[2] && !["order", "bulk"].includes(match[2])
      ? [match[2]]
      : Array.isArray(body.tasks)
        ? body.tasks.map((t: { id: string }) => t.id)
        : body.id
          ? [body.id]
          : [];
  const filter = {
    userId,
    boardId: decodeURIComponent(match[1]!),
    _id: { $in: ids },
  };
  const before = await collections().tasks.find(filter).toArray();
  await next();
  if (c.res.status >= 400) return;
  const after = await collections().tasks.find(filter).toArray();
  const old = new Map(before.map((t) => [t._id, t]));
  const current = new Map(after.map((t) => [t._id, t]));
  const changes = [];
  for (const id of new Set([...old.keys(), ...current.keys()])) {
    const a = old.get(id) ?? null,
      b = current.get(id) ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (b) {
      b.updatedAt = new Date().toISOString();
      await collections().tasks.updateOne(
        { _id: id, userId },
        { $set: { updatedAt: b.updatedAt } },
      );
    }
    changes.push({ before: a, after: b });
    await enqueueTask(userId, id, b ? undefined : a!);
  }
  if (changes.length)
    await collections().history.insertOne({
      _id: crypto.randomUUID(),
      userId,
      at: new Date(),
      changes,
    });
});

export const history = new Hono<AuthEnv>().post("/undo", async (c) => {
  const userId = c.var.userId;
  const change = await collections().history.findOne(
    { userId, undone: { $ne: true } },
    { sort: { at: -1 } },
  );
  if (!change) throw new HTTPException(404, { message: "Nothing to undo" });
  // Refuse to overwrite edits made after this operation (e.g. from Google).
  for (const item of change.changes) {
    const task = await collections().tasks.findOne({
      _id: (item.after ?? item.before)!._id,
      userId,
    });
    if (comparable(task) !== comparable(item.after)) {
      throw new HTTPException(409, {
        message: "This task changed elsewhere. Refresh before undoing.",
      });
    }
  }
  for (const item of change.changes) {
    const id = (item.before ?? item.after)!._id;
    if (item.before) {
      if (
        !(await collections().boards.findOne({
          _id: item.before.boardId,
          userId,
        }))
      )
        throw new HTTPException(409, { message: "The board no longer exists" });
      await collections().tasks.replaceOne(
        { _id: id, userId },
        { ...item.before, updatedAt: new Date().toISOString() },
        { upsert: true },
      );
    } else await collections().tasks.deleteOne({ _id: id, userId });
    await enqueueTask(userId, id, item.before ? undefined : item.after!);
  }
  await collections().history.updateOne(
    { _id: change._id, userId },
    { $set: { undone: true } },
  );
  return c.json({ ok: true });
});

function comparable(task: TaskDoc | null) {
  if (!task) return "null";
  const { updatedAt: _, ...fields } = task;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
