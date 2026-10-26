import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../auth";
import { collections } from "../db";
import {
  SCOPES,
  configured,
  redirectUri,
  startConnection,
  tokenExchange,
  encrypt,
  appOrigin,
  google,
  CAL,
  TASKS,
  accessToken,
  clearToken,
  syncConnection,
} from "../google";
import { enqueueTask } from "../changes";
import { taskInput } from "../types";
const service = z.enum(["calendar", "tasks", "gmail"]);
const enc = encodeURIComponent;

// Public callback: the random, expiring, one-use state binds it to the signed-in user.
export const googleCallback = new Hono()
  .post("/google/webhook", async (c) => {
    const id = c.req.header("x-goog-channel-id"),
      token = c.req.header("x-goog-channel-token"),
      resource = c.req.header("x-goog-resource-id");
    if (!id || !token || !resource) return c.body(null, 404);
    const connection = await collections().connections.findOne({
      "watch.id": id,
      "watch.token": token,
      "watch.resourceId": resource,
    });
    if (!connection) return c.body(null, 404);
    await collections().connections.updateOne(
      { _id: connection._id },
      { $set: { nextPoll: new Date(0) } },
    );
    return c.body(null, 204);
  })
  .get("/google/callback", async (c) => {
    const state = c.req.query("state");
    const attempt = state
      ? await collections().oauthStates.findOneAndDelete({
          _id: state,
          expiresAt: { $gt: new Date() },
        })
      : null;
    if (!attempt)
      return c.text(
        "This connection link expired. Return to Connections and try again.",
        400,
      );
    const back = new URL("/connections", appOrigin());
    if (c.req.query("error")) {
      back.searchParams.set("error", "Google connection was cancelled");
      return c.redirect(back.toString());
    }
    try {
      const code = c.req.query("code");
      if (!code) throw new Error("Google did not return an authorization code");
      const token = await tokenExchange({
        grant_type: "authorization_code",
        code,
        code_verifier: attempt.verifier,
        redirect_uri: redirectUri(),
      });
      const scopes = token.scope.split(" ");
      if (!SCOPES[attempt.service].every((scope) => scopes.includes(scope)))
        throw new Error(
          "Required permissions were not granted. Try connecting again.",
        );
      const response = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { authorization: `Bearer ${token.access_token}` } },
      );
      if (!response.ok)
        throw new Error("Unable to identify the connected Google account");
      const profile = (await response.json()) as { sub: string; email: string };
      const other = await collections().connections.findOne({
        userId: attempt.userId,
        googleId: { $ne: profile.sub },
      });
      if (other)
        throw new Error(
          "Connect the same Google account for each service, or disconnect your existing services first.",
        );
      const id = `${attempt.userId}:${attempt.service}`;
      const previous = await collections().connections.findOne({ _id: id });
      const savedResource =
        attempt.service !== "gmail"
          ? (await collections().users.findOne({ _id: attempt.userId }))
              ?.integrations?.[attempt.service]
          : null;
      if (savedResource && savedResource.googleId !== profile.sub)
        await collections().syncMaps.deleteMany({
          userId: attempt.userId,
          service: attempt.service,
        });
      const refreshToken = token.refresh_token
        ? encrypt(token.refresh_token)
        : previous?.refreshToken;
      if (!refreshToken)
        throw new Error(
          "Google did not grant offline access. Reconnect and approve access.",
        );
      await collections().connections.updateOne(
        { _id: id },
        {
          $set: {
            userId: attempt.userId,
            service: attempt.service,
            refreshToken,
            scopes,
            account: profile.email,
            googleId: profile.sub,
            error: null,
          },
        },
        { upsert: true },
      );
      clearToken(id);
      if (attempt.service !== "gmail") {
        for (const task of await collections()
          .tasks.find({ userId: attempt.userId })
          .toArray())
          await enqueueTask(attempt.userId, task._id);
      }
      back.searchParams.set("connected", attempt.service);
    } catch (error) {
      back.searchParams.set(
        "error",
        error instanceof Error ? error.message : "Google connection failed",
      );
    }
    return c.redirect(back.toString());
  });

export const connections = new Hono<AuthEnv>()
  .get("/", async (c) => {
    const list = await collections()
      .connections.find({ userId: c.var.userId })
      .toArray();
    return c.json({
      configured: configured(),
      redirectUri: redirectUri(),
      services: list.map(({ service, account, lastSync, error }) => ({
        service,
        account,
        lastSync: lastSync ?? null,
        error: error ?? null,
      })),
    });
  })
  .post("/connect", zValidator("json", z.object({ service })), async (c) =>
    c.json({
      url: await startConnection(c.var.userId, c.req.valid("json").service),
    }),
  )
  .post("/disconnect", zValidator("json", z.object({ service })), async (c) => {
    const name = c.req.valid("json").service;
    const id = `${c.var.userId}:${name}`;
    await collections().connections.deleteOne({ _id: id });
    clearToken(id);

    return c.json({ ok: true });
  })
  .post("/sync", async (c) => {
    const list = await collections()
      .connections.find({ userId: c.var.userId })
      .toArray();
    for (const item of list) {
      if (item.service === "gmail") {
        try {
          await google(
            item,
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
          );
          await collections().connections.updateOne(
            { _id: item._id },
            { $set: { lastSync: new Date().toISOString(), error: null } },
          );
        } catch {
          await collections().connections.updateOne(
            { _id: item._id },
            { $set: { error: "Gmail permission needs reconnecting" } },
          );
        }
      } else await syncConnection(item._id, true);
    }
    return c.json({ ok: true });
  })
  .get(
    "/events",
    zValidator(
      "query",
      z.object({ start: z.iso.datetime(), end: z.iso.datetime() }),
    ),
    async (c) => {
      const { start, end } = c.req.valid("query");
      if (Date.parse(end) - Date.parse(start) > 45 * 86400_000 || end <= start)
        throw new HTTPException(400, {
          message: "Choose a range of up to 45 days",
        });
      const connection = await collections().connections.findOne({
        _id: `${c.var.userId}:calendar`,
      });
      if (!connection) return c.json([]);
      const events: any[] = [];
      let page: string | undefined;
      do {
        const calendars = await google(
          connection,
          `${CAL}/users/me/calendarList?${new URLSearchParams({ maxResults: "250", ...(page ? { pageToken: page } : {}) })}`,
        );
        for (const calendar of calendars.items ?? []) {
          if (
            calendar.id === connection.resourceId ||
            calendar.selected === false
          )
            continue;
          let eventPage: string | undefined;
          do {
            const result = await google(
              connection,
              `${CAL}/calendars/${enc(calendar.id)}/events?${new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: "true", maxResults: "2500", ...(eventPage ? { pageToken: eventPage } : {}) })}`,
            );
            events.push(
              ...(result.items ?? [])
                .filter((e: any) => e.status !== "cancelled")
                .map((e: any) => ({
                  id: `${calendar.id}:${e.id}`,
                  title: e.summary ?? "Busy",
                  start: e.start?.dateTime ?? e.start?.date,
                  end: e.end?.dateTime ?? e.end?.date,
                  allDay: Boolean(e.start?.date),
                  calendar: calendar.summary,
                  url: e.htmlLink,
                  busy: e.transparency !== "transparent",
                })),
            );
            eventPage = result.nextPageToken;
          } while (eventPage);
        }
        page = calendars.nextPageToken;
      } while (page);
      return c.json(events);
    },
  )
  .get("/task-lists", async (c) => {
    const connection = await collections().connections.findOne({
      _id: `${c.var.userId}:tasks`,
    });
    if (!connection)
      throw new HTTPException(409, { message: "Connect Google Tasks first" });
    const items: { id: string; title: string }[] = [];
    let page: string | undefined;
    do {
      const result = await google(
        connection,
        `${TASKS}/users/@me/lists?${new URLSearchParams({ maxResults: "100", ...(page ? { pageToken: page } : {}) })}`,
      );
      items.push(
        ...(result.items ?? [])
          .filter((l: any) => l.id !== connection.resourceId)
          .map((l: any) => ({ id: l.id, title: l.title })),
      );
      page = result.nextPageToken;
    } while (page);
    return c.json(items);
  })
  .post(
    "/import",
    zValidator(
      "json",
      z.object({
        listId: z.string().min(1).max(300),
        boardId: z.string().min(1).max(64),
      }),
    ),
    async (c) => {
      const { listId, boardId } = c.req.valid("json");
      const connection = await collections().connections.findOne({
        _id: `${c.var.userId}:tasks`,
      });
      const board = await collections().boards.findOne({
        _id: boardId,
        userId: c.var.userId,
      });
      if (!connection || !board)
        throw new HTTPException(404, {
          message: "Connection or board not found",
        });
      let page: string | undefined;
      let count = 0;
      do {
        const result = await google(
          connection,
          `${TASKS}/lists/${enc(listId)}/tasks?${new URLSearchParams({ maxResults: "100", showCompleted: "false", ...(page ? { pageToken: page } : {}) })}`,
        );
        for (const item of result.items ?? []) {
          const id = `import-${createImportId(c.var.userId, listId, item.id)}`;
          if (
            await collections().tasks.findOne({ _id: id, userId: c.var.userId })
          )
            continue;
          const input = taskInput.parse({
            id,
            title: item.title || "Untitled task",
            description: item.notes ?? "",
            dueDate: item.due?.slice(0, 10) ?? null,
            columnId:
              board.columns.find((col) => col.kind === "todo")?.id ??
              board.columns[0]!.id,
          });
          const { id: _, ...fields } = input;
          await collections().tasks.insertOne({
            ...fields,
            _id: id,
            boardId,
            userId: c.var.userId,
            createdAt: new Date(),
            updatedAt: new Date().toISOString(),
            position: Date.now() + count++,
          });
          await enqueueTask(c.var.userId, id);
        }
        page = result.nextPageToken;
      } while (page);
      return c.json({ count });
    },
  );
import { createHash } from "node:crypto";
function createImportId(...values: string[]) {
  return createHash("sha256")
    .update(values.join(":"))
    .digest("hex")
    .slice(0, 40);
}
