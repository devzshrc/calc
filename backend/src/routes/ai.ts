import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { chatJson, chatText, describeWorkspace } from "../ai";
import { isDone, loadWorkspace } from "../workspace";
import { dayKey, priority, recurrence } from "../types";
import type { AuthEnv } from "../auth";

const today = z.object({ today: dayKey });

const SYSTEM =
  "You are the planning assistant inside a personal kanban app the user treats as their second brain. " +
  "Be concrete, brief and kind. Never invent tasks that are not in the data unless asked to create them.";

const captured = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        boardId: z.string(),
        priority: priority.catch("normal"),
        dueDate: dayKey.nullable().catch(null),
        estimate: z.number().int().min(5).max(600).nullable().catch(null),
        recurrence: recurrence.nullable().catch(null),
        description: z.string().max(2000).catch(""),
      }),
    )
    .max(50),
});

export const ai = new Hono<AuthEnv>()
  .post(
    "/capture",
    zValidator(
      "json",
      today.extend({ text: z.string().trim().min(1).max(8000), boardId: z.string().optional() }),
    ),
    async (c) => {
      const { text, today, boardId } = c.req.valid("json");
      const workspace = await loadWorkspace(c.var.userId);
      const boards = workspace.boards.map((b) => `- ${b.id}: ${b.title}`).join("\n");
      const fallback = boardId ?? workspace.boards[0]?.id ?? "";
      const result = await chatJson(
        [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Today is ${today} (${new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}).
Turn this brain dump into separate, actionable tasks. Each title starts with a verb and is short.
Pick the best board for each from:
${boards}
Default board if unclear: ${fallback}.
Only set dueDate (YYYY-MM-DD) when a time is stated or clearly implied. priority is urgent|normal|low.
estimate is minutes, only when inferable. recurrence is daily|weekdays|weekly|monthly or null.
Put extra context in description.
Reply as json: {"tasks":[{"title","boardId","priority","dueDate","estimate","recurrence","description"}]}

Brain dump:
"""${text}"""`,
          },
        ],
        captured,
      );
      const ids = new Set(workspace.boards.map((b) => b.id));
      return c.json({
        tasks: result.tasks.map((task) => ({
          ...task,
          boardId: ids.has(task.boardId) ? task.boardId : fallback,
        })),
      });
    },
  )
  .post(
    "/breakdown",
    zValidator("json", z.object({ taskId: z.string() })),
    async (c) => {
      const workspace = await loadWorkspace(c.var.userId);
      const task = workspace.tasks.find((t) => t.id === c.req.valid("json").taskId);
      if (!task) throw new HTTPException(404, { message: "Task not found" });
      const result = await chatJson(
        [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Break this into 3-8 small, concrete next steps, in order. Each under 70 characters, starting with a verb.
Task: ${task.title}
${task.description ? `Notes: ${task.description}` : ""}
${task.subtasks.length ? `Existing steps (do not repeat): ${task.subtasks.map((s) => s.title).join("; ")}` : ""}
Reply as json: {"subtasks":["..."]}`,
          },
        ],
        z.object({ subtasks: z.array(z.string().trim().min(1).max(200)).min(1).max(12) }),
      );
      return c.json(result);
    },
  )
  .post(
    "/plan",
    zValidator("json", today.extend({ minutes: z.number().int().min(15).max(960).default(240) })),
    async (c) => {
      const { today, minutes } = c.req.valid("json");
      const workspace = await loadWorkspace(c.var.userId);
      const open = new Set(
        workspace.tasks
          .filter((t) => !isDone(workspace, t) && !(t.snoozedUntil && t.snoozedUntil > today))
          .map((t) => t.id),
      );
      if (open.size === 0) return c.json({ summary: "Nothing open. Enjoy the day.", focus: [] });
      const result = await chatJson(
        [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Today is ${today}. The user has about ${minutes} minutes of focused time.
Pick at most 5 open tasks to focus on today, in the order to do them. Prefer overdue and due-today work,
urgent priority, recurring habits due today, and goals that have stalled. Respect estimates; untimed tasks count as 30m.
Skip snoozed tasks. Give a one-line reason for each and a two-sentence summary of the day.
Reply as json: {"summary":"...","focus":[{"taskId":"...","reason":"..."}]}

${describeWorkspace(workspace, { openOnly: true })}`,
          },
        ],
        z.object({
          summary: z.string().max(600),
          focus: z.array(z.object({ taskId: z.string(), reason: z.string().max(300) })).max(8),
        }),
      );
      return c.json({
        summary: result.summary,
        focus: result.focus.filter((item) => open.has(item.taskId)).slice(0, 5),
      });
    },
  )
  .post("/review", zValidator("json", today), async (c) => {
    const { today } = c.req.valid("json");
    const workspace = await loadWorkspace(c.var.userId);
    const known = new Set(workspace.tasks.map((t) => t.id));
    const result = await chatJson(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Today is ${today}. Run the user's weekly review over the last 7 days.
Write a short, encouraging summary (3-4 sentences) naming real wins and what slipped.
Then suggest up to 6 concrete actions on existing open tasks:
- "reschedule" with a new dueDate (YYYY-MM-DD) for overdue work that still matters
- "drop" for stale work that no longer matters (old, untouched, low priority)
- "breakdown" for big vague tasks that keep slipping
- "focus" for one or two things that deserve attention this week
Reply as json: {"summary":"...","suggestions":[{"taskId":"...","action":"reschedule|drop|breakdown|focus","reason":"...","dueDate":null}]}

${describeWorkspace(workspace)}`,
        },
      ],
      z.object({
        summary: z.string().max(1500),
        suggestions: z
          .array(
            z.object({
              taskId: z.string(),
              action: z.enum(["reschedule", "drop", "breakdown", "focus"]),
              reason: z.string().max(300),
              dueDate: dayKey.nullable().catch(null),
            }),
          )
          .max(10),
      }),
    );
    return c.json({
      summary: result.summary,
      suggestions: result.suggestions.filter((s) => known.has(s.taskId)),
    });
  })
  .post(
    "/ask",
    zValidator(
      "json",
      today.extend({
        question: z.string().trim().min(1).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(20)
          .default([]),
        journal: z.array(z.object({ day: dayKey, text: z.string().max(4000) })).max(14).default([]),
      }),
    ),
    async (c) => {
      const { question, history, today, journal } = c.req.valid("json");
      const workspace = await loadWorkspace(c.var.userId);
      const context = `Today is ${today}. Here is everything in the user's boards:\n${describeWorkspace(workspace)}${
        journal.length
          ? `\n\nRecent journal entries:\n${journal.map((j) => `- ${j.day}: ${j.text.slice(0, 600)}`).join("\n")}`
          : ""
      }`;
      const answer = await chatText([
        {
          role: "system",
          content: `${SYSTEM} Answer questions about the user's tasks, goals, habits and journal using only the data below. Refer to tasks by title, never by id. Use short paragraphs or a short list. Plain text, no markdown headings.\n\n${context}`,
        },
        ...history,
        { role: "user", content: question },
      ]);
      return c.json({ answer });
    },
  );
