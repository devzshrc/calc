import { connect, collections } from "../backend/src/db";
import {
  encrypt,
  syncConnection,
  pullChanges,
  clearToken,
} from "../backend/src/google";
import { enqueueTask } from "../backend/src/changes";
import { taskInput, type ConnectionDoc } from "../backend/src/types";
await connect();
const userId = `sync-test-${crypto.randomUUID()}`,
  boardId = crypto.randomUUID(),
  taskId = crypto.randomUUID();
const originalFetch = globalThis.fetch;
const remote = new Map<string, any>();
let counter = 0;
let revision = 0;
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("oauth2.googleapis.com"))
    return response({ access_token: "test-only", expires_in: 3600 });
  if (url.includes("/events?"))
    return response({
      items: [...remote.values()],
      nextSyncToken: `sync-${revision}`,
    });
  if (url.endsWith("/events") && init?.method === "POST") {
    const item = {
      ...JSON.parse(String(init.body)),
      id: `event-${++counter}`,
      updated: new Date(Date.now() + 1000).toISOString(),
      etag: `v${++revision}`,
    };
    remote.set(item.id, item);
    return response(item);
  }
  const id = url.split("/").pop()!;
  if (init?.method === "DELETE") {
    remote.delete(id);
    return new Response(null, { status: 204 });
  }
  if (init?.method === "PATCH") {
    const item = remote.get(id);
    if (!item) return response({}, 404);
    const etag = (init.headers as Record<string, string>)["if-match"];
    if (etag && etag !== item.etag) return response({}, 412);
    Object.assign(item, JSON.parse(String(init.body)), {
      updated: new Date(Date.now() + 2000).toISOString(),
      etag: `v${++revision}`,
    });
    return response(item);
  }
  throw new Error(`Unexpected mock request ${url}`);
}) as typeof fetch;
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
    columns: [{ id: "todo", name: "To do", kind: "todo", hidden: false }],
    position: 0,
    createdAt: new Date(),
  });
  const { id: _, ...fields } = taskInput.parse({
    id: taskId,
    title: "Study",
    columnId: "todo",
    scheduledStart: "2035-01-01T09:00:00Z",
    scheduledEnd: "2035-01-01T10:00:00Z",
  });
  await collections().tasks.insertOne({
    ...fields,
    _id: taskId,
    userId,
    boardId,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date().toISOString(),
  });
  const c: ConnectionDoc = {
    _id: `${userId}:calendar`,
    userId,
    service: "calendar",
    refreshToken: encrypt("test-only"),
    scopes: [],
    account: "test@example.com",
    googleId: "test",
    resourceId: "test-calendar",
  };
  await collections().connections.insertOne(c);
  await enqueueTask(userId, taskId);
  await syncConnection(c._id, true);
  assert(remote.size === 1, "outbound event created");
  assert(
    (await collections().syncMaps.countDocuments({ userId })) === 1,
    "mapping saved",
  );
  const event = [...remote.values()][0];
  event.start.dateTime = "2035-01-01T12:00:00Z";
  event.end.dateTime = "2035-01-01T13:00:00Z";
  event.updated = "2035-01-01T10:00:00Z";
  event.etag = "external-1";
  await pullChanges(c);
  assert(
    (await collections().tasks.findOne({ _id: taskId }))?.scheduledStart ===
      "2035-01-01T12:00:00.000Z",
    "remote reschedule imported",
  );
  event.status = "cancelled";
  event.updated = "2035-01-02T10:00:00Z";
  event.etag = "external-2";
  await pullChanges(c);
  assert(
    (await collections().tasks.findOne({ _id: taskId }))?.scheduledStart ===
      null,
    "remote deletion clears block",
  );
  assert(
    (await collections().tasks.countDocuments({ _id: taskId })) === 1,
    "task preserved",
  );
  console.log(
    "PASS: encrypted token refresh, outbound Calendar creation, revision mappings, inbound reschedule, deletion preserves task",
  );
} finally {
  globalThis.fetch = originalFetch;
  clearToken(`${userId}:calendar`);
  for (const name of [
    "tasks",
    "boards",
    "history",
    "syncJobs",
    "syncMaps",
    "connections",
    "activity",
  ] as const)
    await collections()[name].deleteMany({ userId });
}
process.exit(0);
