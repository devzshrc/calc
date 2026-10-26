import type { WorkspaceTask } from "./kanban";
import type { GoogleEvent } from "@/server/productivity";
export function localDateTime(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function dateKey(date: Date) {
  return localDateTime(date.toISOString()).slice(0, 10);
}
export function dayDate(day: string) {
  return new Date(`${day}T00:00:00`);
}
export function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
export function scheduleInGaps(
  tasks: WorkspaceTask[],
  events: GoogleEvent[],
  day: string,
  occupied: WorkspaceTask[] = [],
) {
  const start = dayDate(day);
  start.setHours(9);
  const end = dayDate(day);
  end.setHours(18);
  const now = Date.now();
  let cursor = Math.ceil(Math.max(start.getTime(), now) / 900000) * 900000;
  const busy = [
    ...events
      .filter((e) => e.busy)
      .map((e) => [dayDateOrTime(e.start), dayDateOrTime(e.end)]),
    ...occupied
      .filter((t) => t.scheduledStart && t.scheduledEnd)
      .map((t) => [Date.parse(t.scheduledStart!), Date.parse(t.scheduledEnd!)]),
  ].sort((a, b) => a[0] - b[0]);
  const result: { task: WorkspaceTask; start: string; end: string }[] = [];
  for (const task of tasks) {
    const duration = (task.estimate ?? 30) * 60000;
    for (const [a, b] of busy) {
      if (cursor + duration <= a) break;
      if (cursor < b && cursor + duration > a)
        cursor = Math.ceil(b / 900000) * 900000;
    }
    if (cursor + duration > end.getTime()) continue;
    result.push({
      task,
      start: new Date(cursor).toISOString(),
      end: new Date(cursor + duration).toISOString(),
    });
    cursor += duration;
  }
  return result;
}
function dayDateOrTime(value: string) {
  return value.length === 10 ? dayDate(value).getTime() : Date.parse(value);
}
