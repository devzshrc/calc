const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function shiftDays(days: number, from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayKeyFromNow(days: number) {
  return toDateKey(shiftDays(days));
}

export function isoFromNow(days: number) {
  return shiftDays(days).toISOString();
}

export function formatShort(value: string) {
  const date = value.length === 10 ? parseDateKey(value) : new Date(value);
  return shortFormat.format(date);
}

export type DueInfo = { label: string; overdue: boolean };

export function dueInfo(due: string | null, done: boolean): DueInfo | null {
  if (!due) return null;
  const today = todayKey();
  if (due === today) return { label: "Today", overdue: false };
  if (due === dayKeyFromNow(1)) return { label: "Tomorrow", overdue: false };
  if (due < today && !done) return { label: "Overdue", overdue: true };
  return { label: formatShort(due), overdue: false };
}

export function isOverdue(due: string | null, done: boolean) {
  return Boolean(due) && !done && (due as string) < todayKey();
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShort(iso);
}
