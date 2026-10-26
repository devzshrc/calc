import { Hono } from "hono";
import type { AuthEnv } from "../auth";
import { calendarToken } from "../users";
import { loadWorkspace, goalSummary } from "../workspace";

export const workspace = new Hono<AuthEnv>()
  .get("/", async (c) => {
    const data = await loadWorkspace(c.var.userId);
    return c.json({ ...data, ...goalSummary(data) });
  })
  .get("/calendar-token", async (c) => c.json({ token: await calendarToken(c.var.userId) }));
