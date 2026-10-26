import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { isDone, loadWorkspace } from "../workspace";
import { userByCalendarToken } from "../users";

function escape(text: string) {
  return text.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

function nextDay(key: string) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

const RRULE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
};

// Subscribable iCal feed of open tasks with due dates (all-day events).
// Calendar apps can't sign in, so the URL carries a per-user secret token.
export const calendar = new Hono().get("/calendar/:token{[A-Za-z0-9_-]+\\.ics}", async (c) => {
  const token = c.req.param("token").replace(/\.ics$/, "");
  const user = await userByCalendarToken(token);
  if (!user) throw new HTTPException(404, { message: "Not found" });
  const workspace = await loadWorkspace(user._id);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = workspace.tasks
    .filter((task) => task.dueDate && !isDone(workspace, task))
    .map((task) => {
      const board = workspace.boards.find((b) => b.id === task.boardId);
      const lines = [
        "BEGIN:VEVENT",
        `UID:${task.id}@kanban`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${task.dueDate!.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${nextDay(task.dueDate!)}`,
        `SUMMARY:${escape(task.title)}`,
        `CATEGORIES:${escape(board?.title ?? "Kanban")}`,
      ];
      if (task.description) lines.push(`DESCRIPTION:${escape(task.description)}`);
      if (task.recurrence) lines.push(`RRULE:${RRULE[task.recurrence]}`);
      lines.push("END:VEVENT");
      return lines.join("\r\n");
    });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kanban//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Kanban",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
  return c.body(body, 200, { "content-type": "text/calendar; charset=utf-8" });
});
