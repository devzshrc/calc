import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth";
import { collections } from "../db";
export const focus = new Hono<AuthEnv>()
  .get("/", async (c) =>
    c.json(
      await collections()
        .focus.find({ userId: c.var.userId })
        .sort({ startedAt: -1 })
        .limit(500)
        .toArray(),
    ),
  )
  .post(
    "/start",
    zValidator("json", z.object({ taskId: z.string().min(1).max(64) })),
    async (c) => {
      const taskId = c.req.valid("json").taskId;
      if (
        !(await collections().tasks.findOne({
          _id: taskId,
          userId: c.var.userId,
        }))
      )
        throw new HTTPException(404, { message: "Task not found" });
      const active = await collections().focus.findOne({
        userId: c.var.userId,
        endedAt: null,
      });
      if (active)
        throw new HTTPException(409, {
          message: "Finish your current focus session first",
        });
      const session = {
        _id: crypto.randomUUID(),
        userId: c.var.userId,
        taskId,
        startedAt: new Date().toISOString(),
        endedAt: null,
        duration: 0,
      };
      try {
        await collections().focus.insertOne(session);
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          throw new HTTPException(409, {
            message: "Finish your current focus session first",
          });
        throw error;
      }
      return c.json(session);
    },
  )
  .post(
    "/stop",
    zValidator("json", z.object({ id: z.string().min(1).max(64) })),
    async (c) => {
      const session = await collections().focus.findOne({
        _id: c.req.valid("json").id,
        userId: c.var.userId,
        endedAt: null,
      });
      if (!session)
        throw new HTTPException(404, { message: "No active session" });
      const endedAt = new Date().toISOString(),
        duration = Math.max(
          0,
          Math.round((Date.now() - Date.parse(session.startedAt)) / 1000),
        );
      await collections().focus.updateOne(
        { _id: session._id, userId: c.var.userId },
        { $set: { endedAt, duration } },
      );
      return c.json({ ...session, endedAt, duration });
    },
  );
