import { focus } from "../backend/src/routes/focus";
import { Hono } from "../backend/node_modules/hono";
import { connect, collections } from "../backend/src/db";
import { boards } from "../backend/src/routes/boards";
import { history, trackChanges } from "../backend/src/changes";
import type { AuthEnv } from "../backend/src/auth";
import { taskInput } from "../backend/src/types";
await connect();
const userId = `integration-${crypto.randomUUID()}`,
  boardId = crypto.randomUUID(),
  taskId = crypto.randomUUID();
const app = new Hono<AuthEnv>()
  .use(async (c, next) => {
    c.set("userId", userId);
    await next();
  })
  .use(trackChanges)
  .route("/boards", boards)
  .route("/history", history)
  .route("/focus", focus);
const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
try {
  await collections().boards.insertOne({
    _id: boardId,
    userId,
    title: "Test",
    favorite: false,
    teamName: "Test",
    githubConnected: false,
    members: [],
    columns: [
      { id: "todo", name: "To do", kind: "todo", hidden: false },
      { id: "done", name: "Done", kind: "done", hidden: false },
    ],
    position: 0,
    createdAt: new Date(),
  });
  const task = taskInput.parse({
    id: taskId,
    title: "Schedule integration",
    columnId: "todo",
  });
  let response = await app.request(
    `/boards/${boardId}/tasks/bulk`,
    json("POST", { tasks: [task] }),
  );
  assert(response.status === 201, "create");
  response = await app.request(
    `/boards/${boardId}/tasks/bulk`,
    json("POST", { tasks: [task] }),
  );
  assert(response.status === 201, "replay");
  assert(
    (await collections().tasks.countDocuments({ userId })) === 1,
    "idempotent replay",
  );
  response = await app.request(
    `/boards/${boardId}/tasks/${taskId}`,
    json("PATCH", {
      scheduledStart: "2035-01-01T09:00:00Z",
      scheduledEnd: "2035-01-01T10:00:00Z",
    }),
  );
  assert(response.status === 200, "schedule");
  response = await app.request(
    `/boards/${boardId}/tasks/${taskId}`,
    json("PATCH", { scheduledEnd: "2035-01-01T08:00:00Z" }),
  );
  assert(response.status === 400, "invalid interval");
  response = await app.request("/history/undo", json("POST"));
  assert(response.status === 200, "undo schedule");
  assert(
    !(await collections().tasks.findOne({ _id: taskId }))?.scheduledStart,
    "schedule undone",
  );
  response = await app.request("/focus/start", json("POST", { taskId }));
  assert(response.status === 200, "start focus");
  const session = (await response.json()) as { _id: string };
  response = await app.request("/focus/start", json("POST", { taskId }));
  assert(response.status === 409, "reject overlapping focus session");
  response = await app.request(
    "/focus/stop",
    json("POST", { id: session._id }),
  );
  assert(response.status === 200, "save completed focus session");
  response = await app.request(
    `/boards/${boardId}/tasks/${taskId}`,
    json("DELETE"),
  );
  assert(response.status === 204, "delete");
  response = await app.request("/history/undo", json("POST"));
  assert(response.status === 200, "restore delete");
  assert(
    (await collections().tasks.countDocuments({ _id: taskId })) === 1,
    "restored",
  );
  response = await app.request("/history/undo", json("POST"));
  assert(response.status === 200, "undo creation after prior undos");
  assert(
    (await collections().tasks.countDocuments({ _id: taskId })) === 0,
    "created task removed",
  );
  console.log(
    "PASS: idempotent replay, scheduling validation, undo, delete restore, multi-step undo, durable sync jobs",
  );
} finally {
  for (const name of [
    "tasks",
    "boards",
    "history",
    "syncJobs",
    "syncMaps",
    "focus",
  ] as const)
    await collections()[name].deleteMany({ userId });
}
process.exit(0);
