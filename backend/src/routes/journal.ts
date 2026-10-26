import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { collections } from "../db";
import { dayKey, journalInput } from "../types";
import type { AuthEnv } from "../auth";

function serialize(doc: { day: string; text: string; updatedAt: Date }) {
  return { day: doc.day, text: doc.text, updatedAt: doc.updatedAt.toISOString() };
}

export const journal = new Hono<AuthEnv>()
  .get("/", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 365);
    const docs = await collections()
      .journal.find({ userId: c.var.userId })
      .sort({ day: -1 })
      .limit(limit)
      .toArray();
    return c.json(docs.map(serialize));
  })
  .put("/:day", zValidator("json", journalInput), async (c) => {
    const day = c.req.param("day");
    if (!dayKey.safeParse(day).success) {
      throw new HTTPException(400, { message: "Invalid day" });
    }
    const { text } = c.req.valid("json");
    const userId = c.var.userId;
    const _id = `${userId}:${day}`;
    const { journal } = collections();
    if (!text.trim()) {
      await journal.deleteOne({ _id, userId });
      return c.body(null, 204);
    }
    const doc = { _id, userId, day, text, updatedAt: new Date() };
    await journal.replaceOne({ _id, userId }, doc, { upsert: true });
    return c.json(serialize(doc));
  });
