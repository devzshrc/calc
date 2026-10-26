import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { AuthEnv } from "../auth";
import { collections } from "../db";
import { DEFAULT_COLUMNS, ME } from "../seed";
import {
  activityInput,
  boardInput,
  boardPatch,
  orderInput,
  taskInput,
  taskPatch,
  type TaskDoc,
} from "../types";
import { enqueueTask } from "../changes";
import { goalSummary, loadWorkspace } from "../workspace";
import { boardSummary, serializeActivity, serializeBoard, serializeTask } from "../serialize";

const MAX_ACTIVITY = 60;

// Every lookup is keyed by userId: another user's id simply 404s.
async function requireBoard(userId: string, id: string) {
  const board = await collections().boards.findOne({ _id: id, userId });
  if (!board) throw new HTTPException(404, { message: "Board not found" });
  return board;
}

async function nextPosition(userId: string, boardId: string) {
  const last = await collections()
    .tasks.find({ userId, boardId })
    .sort({ position: -1 })
    .limit(1)
    .next();
  return (last?.position ?? -1) + 1;
}

export const boards = new Hono<AuthEnv>()
  .get("/", async (c) => {
    const list = await collections()
      .boards.find({ userId: c.var.userId })
      .sort({ position: 1 })
      .toArray();
    return c.json(list.map(boardSummary));
  })
  .post("/", zValidator("json", boardInput), async (c) => {
    const userId = c.var.userId;
    const { title, teamName } = c.req.valid("json");
    const { boards } = collections();
    const last = await boards.find({ userId }).sort({ position: -1 }).limit(1).next();
    const doc = {
      _id: crypto.randomUUID(),
      userId,
      title,
      favorite: false,
      teamName: teamName ?? "Personal",
      githubConnected: false,
      members: [ME],
      columns: DEFAULT_COLUMNS,
      position: (last?.position ?? -1) + 1,
      createdAt: new Date(),
    };
    await boards.insertOne(doc);
    return c.json(boardSummary(doc), 201);
  })
  .get("/:id", async (c) => {
    const userId = c.var.userId;
    const board = await requireBoard(userId, c.req.param("id"));
    const [taskDocs, workspace] = await Promise.all([
      collections().tasks.find({ userId, boardId: board._id }).sort({ position: 1 }).toArray(),
      loadWorkspace(userId),
    ]);
    return c.json({ ...serializeBoard(board, taskDocs), ...goalSummary(workspace) });
  })
  .get("/:id/activity", async (c) => {
    const docs = await collections()
      .activity.find({ userId: c.var.userId, boardId: c.req.param("id") })
      .sort({ at: -1 })
      .limit(MAX_ACTIVITY)
      .toArray();
    return c.json(docs.map(serializeActivity));
  })
  .patch("/:id", zValidator("json", boardPatch), async (c) => {
    const result = await collections().boards.findOneAndUpdate(
      { _id: c.req.param("id"), userId: c.var.userId },
      { $set: c.req.valid("json") },
      { returnDocument: "after" },
    );
    if (!result) throw new HTTPException(404, { message: "Board not found" });
    return c.json(boardSummary(result));
  })
  .delete("/:id", async (c) => {
    const userId = c.var.userId;
    const id = c.req.param("id");
    await requireBoard(userId, id);
    const { boards, tasks, activity } = collections();
    const removed = await tasks.find({ boardId: id, userId }).toArray();
    for (const task of removed) await enqueueTask(userId, task._id, task);
    await Promise.all([
      boards.deleteOne({ _id: id, userId }),
      tasks.deleteMany({ boardId: id, userId }),
      activity.deleteMany({ boardId: id, userId }),
    ]);
    return c.body(null, 204);
  })
  .post("/:id/tasks", zValidator("json", taskInput), async (c) => {
    const userId = c.var.userId;
    const board = await requireBoard(userId, c.req.param("id"));
    const { id, createdAt, ...input } = c.req.valid("json");
    const doc: TaskDoc = {
      _id: id,
      userId,
      boardId: board._id,
      ...input,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      position: await nextPosition(userId, board._id),
    };
    await collections().tasks.insertOne(doc);
    return c.json(serializeTask(doc), 201);
  })
  .post(
    "/:id/tasks/bulk",
    zValidator("json", orderInput.extend({ tasks: taskInput.array().max(500) })),
    async (c) => {
      const userId = c.var.userId;
      const board = await requireBoard(userId, c.req.param("id"));
      let position = await nextPosition(userId, board._id);
      const docs: TaskDoc[] = c.req.valid("json").tasks.map(({ id, createdAt, ...input }) => ({
        _id: id,
        userId,
        boardId: board._id,
        ...input,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        position: position++,
      }));
      // Offline replay is idempotent when the response was lost after insertion.
      const existing = await collections().tasks.find({ _id: { $in: docs.map(d => d._id) } }).toArray();
      if (existing.some(d => d.userId !== userId || d.boardId !== board._id)) throw new HTTPException(409, { message: 'Task id already exists' });
      const fresh = docs.filter(d => !existing.some(e => e._id === d._id));
      if (fresh.length) await collections().tasks.insertMany(fresh);
      return c.json(docs.map(serializeTask), 201);
    },
  )
  .put("/:id/tasks/order", zValidator("json", orderInput), async (c) => {
    const userId = c.var.userId;
    const boardId = c.req.param("id");
    const ops = c.req.valid("json").tasks.map((task, position) => ({
      updateOne: {
        filter: { _id: task.id, boardId, userId },
        update: { $set: { columnId: task.columnId, position } },
      },
    }));
    if (ops.length) await collections().tasks.bulkWrite(ops);
    return c.body(null, 204);
  })
  .patch("/:id/tasks/:taskId", zValidator("json", taskPatch), async (c) => {
    const current = await collections().tasks.findOne({ _id: c.req.param("taskId"), boardId: c.req.param("id"), userId: c.var.userId });
    if (!current) throw new HTTPException(404, { message: 'Task not found' });
    const merged = { ...current, ...c.req.valid("json") };
    if (Boolean(merged.scheduledStart) !== Boolean(merged.scheduledEnd) || (merged.scheduledStart && merged.scheduledEnd && merged.scheduledEnd <= merged.scheduledStart)) throw new HTTPException(400, { message: 'Choose a time block with an end after its start' });
    const result = await collections().tasks.findOneAndUpdate(
      { _id: c.req.param("taskId"), boardId: c.req.param("id"), userId: c.var.userId },
      { $set: c.req.valid("json") },
      { returnDocument: "after" },
    );
    if (!result) throw new HTTPException(404, { message: "Task not found" });
    return c.json(serializeTask(result));
  })
  .delete("/:id/tasks/:taskId", async (c) => {
    await collections().tasks.deleteOne({
      _id: c.req.param("taskId"),
      boardId: c.req.param("id"),
      userId: c.var.userId,
    });
    return c.body(null, 204);
  })
  .post("/:id/activity", zValidator("json", activityInput), async (c) => {
    const userId = c.var.userId;
    const boardId = (await requireBoard(userId, c.req.param("id")))._id;
    const doc = {
      _id: crypto.randomUUID(),
      userId,
      boardId,
      text: c.req.valid("json").text,
      at: new Date(),
    };
    const { activity } = collections();
    await activity.insertOne(doc);
    const stale = await activity
      .find({ userId, boardId }, { projection: { _id: 1 } })
      .sort({ at: -1 })
      .skip(MAX_ACTIVITY)
      .toArray();
    if (stale.length) await activity.deleteMany({ _id: { $in: stale.map((d) => d._id) } });
    return c.json(serializeActivity(doc), 201);
  });
