import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Button from "@/components/_ui/button";
import { Textarea } from "@/components/_ui/form";
import { Empty, PageBody, PageHeader, Section } from "@/components/second-brain/page";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { listJournal, saveJournal } from "@/server/workspace";
import type { JournalEntry, WorkspaceTask } from "@/lib/kanban";
import { parseDateKey, shiftDays, toDateKey, todayKey } from "@/lib/dates";
import BookIcon from "@/assets/icons/book-open.svg?react";
import CheckCircleIcon from "@/assets/icons/check-circle.svg?react";

export const Route = createFileRoute("/_app/journal")({
  ssr: true,
  head: () => ({ meta: [{ title: "Journal - Kanban" }] }),
  loader: () => listJournal({ data: { limit: 60 } }),
  component: Journal,
});

const DAYS = 14;

function dayLabel(day: string) {
  const today = todayKey();
  if (day === today) return "Today";
  if (day === toDateKey(shiftDays(-1))) return "Yesterday";
  return parseDateKey(day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function completedOn(tasks: WorkspaceTask[], day: string) {
  return tasks.filter(
    (task) => task.completedAt?.slice(0, 10) === day || task.completions.includes(day),
  );
}

/** Saves 800ms after typing stops, and on blur. */
function EntryEditor({
  day,
  initial,
  autoFocus,
  onSaved,
}: {
  day: string;
  initial: string;
  autoFocus?: boolean;
  onSaved: (entry: JournalEntry | null) => void;
}) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef(initial);
  const timer = useRef<number | undefined>(undefined);

  const flush = async (value: string) => {
    window.clearTimeout(timer.current);
    if (value === saved.current) return;
    setStatus("saving");
    try {
      const entry = await saveJournal({ data: { day, text: value } });
      saved.current = value;
      setStatus("saved");
      onSaved(entry ?? null);
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        aria-label={`Journal for ${dayLabel(day)}`}
        autoFocus={autoFocus}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          setStatus("idle");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => flush(value), 800);
        }}
        onBlur={() => flush(text)}
        placeholder="How did today go? What's on your mind? One line is enough."
        className="min-h-[120px]"
      />
      <span className="text-subtle h-4 text-[12px]">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && <span className="text-danger">Couldn't save. Keep typing to retry.</span>}
      </span>
    </div>
  );
}

function DoneList({ tasks }: { tasks: WorkspaceTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task.id} className="text-muted-foreground flex items-center gap-2">
          <CheckCircleIcon aria-hidden className="text-success size-3.5 shrink-0" />
          <span className="truncate">{task.title}</span>
        </li>
      ))}
    </ul>
  );
}

function Journal() {
  const loaded = Route.useLoaderData();
  const tasks = useWorkspaceStore((state) => state.tasks);
  const [entries, setEntries] = useState(loaded);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => setEntries(loaded), [loaded]);

  const today = todayKey();
  const byDay = useMemo(() => new Map(entries.map((e) => [e.day, e])), [entries]);
  const past = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => toDateKey(shiftDays(-(i + 1)))),
    [],
  );

  const update = (day: string) => (entry: JournalEntry | null) =>
    setEntries((all) => {
      const rest = all.filter((e) => e.day !== day);
      return entry ? [entry, ...rest].sort((a, b) => b.day.localeCompare(a.day)) : rest;
    });

  const todayDone = completedOn(tasks, today);

  return (
    <>
      <PageHeader icon={BookIcon} title="Journal" />
      <PageBody>
        <Section title={dayLabel(today)} meta={parseDateKey(today).toLocaleDateString("en-US", { month: "short", day: "numeric" })}>
          <EntryEditor day={today} initial={byDay.get(today)?.text ?? ""} onSaved={update(today)} />
          {todayDone.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-[13px]">Done today</span>
              <DoneList tasks={todayDone} />
            </div>
          )}
        </Section>

        <Section title="Past two weeks">
          {past.every((day) => !byDay.has(day) && completedOn(tasks, day).length === 0) ? (
            <Empty>Entries and finished tasks from earlier days will show up here.</Empty>
          ) : (
            <div className="divide-border flex flex-col divide-y">
              {past.map((day) => {
                const entry = byDay.get(day);
                const done = completedOn(tasks, day);
                if (!entry && done.length === 0 && editing !== day) return null;
                return (
                  <article key={day} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3>{dayLabel(day)}</h3>
                      {editing !== day && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(day)}>
                          {entry ? "Edit" : "Write"}
                        </Button>
                      )}
                    </div>
                    {editing === day ? (
                      <EntryEditor
                        day={day}
                        initial={entry?.text ?? ""}
                        autoFocus
                        onSaved={update(day)}
                      />
                    ) : (
                      entry && <p className="leading-[150%] whitespace-pre-line">{entry.text}</p>
                    )}
                    <DoneList tasks={done} />
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
