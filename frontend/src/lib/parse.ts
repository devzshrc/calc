import { shiftDays, toDateKey } from "@/lib/dates";
import type { BoardSummary, Priority, Recurrence } from "@/lib/kanban";

export type ParsedCapture = {
  title: string;
  boardId: string | null;
  priority: Priority | null;
  dueDate: string | null;
  estimate: number | null;
  recurrence: Recurrence | null;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// Strict suffixes so "month" or "money" never read as a weekday.
const DAY = "(sun|mon|tue|wed|thu|fri|sat)(?:day|days|s|sday|nesday|rsday|urday)?";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function nextWeekday(target: number, now: Date, forceNext: boolean) {
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0 || forceNext) diff += diff === 0 ? 7 : 0;
  if (forceNext && diff < 7) diff += 7;
  return toDateKey(shiftDays(diff, now));
}

function futureDate(month: number, day: number, now: Date) {
  const date = new Date(now.getFullYear(), month, day);
  if (toDateKey(date) < toDateKey(now)) date.setFullYear(date.getFullYear() + 1);
  return toDateKey(date);
}

type Rule = {
  pattern: RegExp;
  apply: (match: RegExpMatchArray, result: ParsedCapture, now: Date) => void;
};

const RULES: Rule[] = [
  {
    pattern: /(?:^|\s)(?:every\s*day|daily)(?=\s|$)/i,
    apply: (_, r, now) => {
      r.recurrence = "daily";
      r.dueDate ??= toDateKey(now);
    },
  },
  {
    pattern: /(?:^|\s)(?:every\s*weekday|weekdays)(?=\s|$)/i,
    apply: (_, r, now) => {
      r.recurrence = "weekdays";
      r.dueDate ??= toDateKey(now);
    },
  },
  {
    pattern: new RegExp(`(?:^|\\s)every\\s+${DAY}(?=\\s|$)`, "i"),
    apply: (m, r, now) => {
      r.recurrence = "weekly";
      r.dueDate = nextWeekday(WEEKDAYS.indexOf(m[1].toLowerCase()), now, false);
    },
  },
  {
    pattern: /(?:^|\s)(?:every\s*week|weekly)(?=\s|$)/i,
    apply: (_, r, now) => {
      r.recurrence = "weekly";
      r.dueDate ??= toDateKey(now);
    },
  },
  {
    pattern: /(?:^|\s)(?:every\s*month|monthly)(?=\s|$)/i,
    apply: (_, r, now) => {
      r.recurrence = "monthly";
      r.dueDate ??= toDateKey(now);
    },
  },
  {
    pattern: /(?:^|\s)!(urgent|high|1|low|3|normal|2)(?=\s|$)/i,
    apply: (m, r) => {
      const v = m[1].toLowerCase();
      r.priority = v === "urgent" || v === "high" || v === "1" ? "urgent" : v === "low" || v === "3" ? "low" : "normal";
    },
  },
  {
    pattern: /(?:^|\s)~(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs|hours?)?(?=\s|$)/i,
    apply: (m, r) => {
      const value = Number(m[1]);
      const unit = (m[2] ?? "m").toLowerCase();
      r.estimate = Math.round(unit.startsWith("h") ? value * 60 : value) || null;
    },
  },
  { pattern: /(?:^|\s)(?:today|tonight|tdy)(?=\s|$)/i, apply: (_, r, now) => void (r.dueDate = toDateKey(now)) },
  {
    pattern: /(?:^|\s)(?:tomorrow|tmrw|tmr)(?=\s|$)/i,
    apply: (_, r, now) => void (r.dueDate = toDateKey(shiftDays(1, now))),
  },
  {
    pattern: /(?:^|\s)next\s+week(?=\s|$)/i,
    apply: (_, r, now) => void (r.dueDate = nextWeekday(1, now, false)),
  },
  {
    pattern: /(?:^|\s)in\s+(\d+)\s+(day|days|week|weeks)(?=\s|$)/i,
    apply: (m, r, now) => {
      const n = Number(m[1]) * (m[2].startsWith("week") ? 7 : 1);
      r.dueDate = toDateKey(shiftDays(n, now));
    },
  },
  {
    pattern: new RegExp(`(?:^|\\s)(?:by\\s+|on\\s+)?(next\\s+)?${DAY}(?=\\s|$)`, "i"),
    apply: (m, r, now) => {
      r.dueDate = nextWeekday(WEEKDAYS.indexOf(m[2].toLowerCase()), now, Boolean(m[1]));
    },
  },
  {
    pattern: /(?:^|\s)(?:by\s+|on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s|$)/i,
    apply: (m, r, now) => {
      r.dueDate = futureDate(MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]), now);
    },
  },
  {
    pattern: /(?:^|\s)(?:by\s+|on\s+)?(\d{1,2})\/(\d{1,2})(?=\s|$)/,
    apply: (m, r, now) => {
      r.dueDate = futureDate(Number(m[1]) - 1, Number(m[2]), now);
    },
  },
];

/**
 * Instant, offline parsing for quick capture:
 * "Call grandma tomorrow #life !urgent ~15m", "Run every day #goals".
 */
export function parseCapture(input: string, boards: BoardSummary[], now = new Date()): ParsedCapture {
  const result: ParsedCapture = {
    title: input,
    boardId: null,
    priority: null,
    dueDate: null,
    estimate: null,
    recurrence: null,
  };
  let text = ` ${input} `;

  text = text.replace(/(?:^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/u, (whole, tag: string) => {
    const key = tag.toLowerCase();
    const board =
      boards.find((b) => b.title.toLowerCase() === key) ??
      boards.find((b) => b.title.toLowerCase().startsWith(key));
    if (!board) return whole;
    result.boardId = board.id;
    return " ";
  });

  for (const rule of RULES) {
    // The last mention wins: "Monday notes, due next mon" is due next Monday.
    const global = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
    const match = [...text.matchAll(global)].at(-1);
    if (!match) continue;
    rule.apply(match, result, now);
    const at = match.index ?? 0;
    text = `${text.slice(0, at)} ${text.slice(at + match[0].length)}`;
  }

  result.title = text.replace(/\s+/g, " ").trim();
  return result;
}
