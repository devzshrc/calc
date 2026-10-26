import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { connect } from "./db";
import { boards } from "./routes/boards";
import { workspace } from "./routes/workspace";
import { journal } from "./routes/journal";
import { calendar } from "./routes/calendar";
import { ai } from "./routes/ai";
import { clerk, requireUser, type AuthEnv } from "./auth";

import { history, trackChanges } from './changes';
import { connections, googleCallback } from './routes/connections';
import { notifications, notificationActions } from './reminders';
import { focus } from './routes/focus';
import { startWorker } from './worker';

await connect();
startWorker();

const app = new Hono()
  .use(logger())
  .use(cors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",") }))
  .get("/health", (c) => c.json({ ok: true }))
  // Public: authenticated by the unguessable per-user token in the URL.
  .route("/", calendar)
  .route("/", googleCallback)
  .route("/", notificationActions);

// Everything else requires a signed-in user.
const api = new Hono<AuthEnv>()
  .use(clerk, requireUser)
  .use(trackChanges)
  .route("/history", history)
  .route("/connections", connections)
  .route("/notifications", notifications)
  .route("/focus", focus)
  .route("/boards", boards)
  .route("/workspace", workspace)
  .route("/journal", journal)
  .route("/ai", ai);

app.route("/", api);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export type AppType = typeof app;

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
};
