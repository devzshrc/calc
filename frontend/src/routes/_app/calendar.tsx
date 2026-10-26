import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { motion } from "motion/react";
import Button from "@/components/_ui/button";
import Dialog from "@/components/_ui/dialog";
import { PageHeader, PageToolbar } from "@/components/second-brain/page";
import ScheduleFields, {
  scheduleDraft,
  schedulePayload,
} from "@/components/second-brain/schedule-fields";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUiStore } from "@/stores/ui-store";
import { getGoogleEvents, type GoogleEvent } from "@/server/productivity";
import { dateKey, dayDate, shiftDate, scheduleInGaps } from "@/lib/scheduling";
import { isOpen } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { WorkspaceTask } from "@/lib/kanban";
import CalendarIcon from "@/assets/icons/calendar.svg?react";
import { startTaskFocus } from "@/components/second-brain/focus-timer";
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => Number.isFinite(dayDate(v).getTime()) && dateKey(dayDate(v)) === v,
  );
export const Route = createFileRoute("/_app/calendar")({
  ssr: true,
  validateSearch: z.object({
    view: z.enum(["month", "week", "day"]).catch("week").default("week"),
    date: dateSchema
      .catch(() => dateKey(new Date()))
      .default(() => dateKey(new Date())),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const first = dayDate(deps.date);
    first.setDate(1);
    const end = new Date(first);
    end.setMonth(end.getMonth() + 1);
    end.setDate(8);
    const start = shiftDate(first, -7);
    try {
      return {
        events: await getGoogleEvents({
          data: { start: start.toISOString(), end: end.toISOString() },
        }),
        error: null,
      };
    } catch {
      return {
        events: [] as GoogleEvent[],
        error: "Google events could not load. Check your connection and retry.",
      };
    }
  },
  head: () => ({ meta: [{ title: "Calendar - Kanban" }] }),
  component: Calendar,
});
const HOUR_HEIGHT = 64;
function Calendar() {
  const { date, view } = Route.useSearch();
  const { events, error } = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });
  const tasks = useWorkspaceStore((s) => s.tasks);
  const boards = useWorkspaceStore((s) => s.boards);
  const patchTask = useWorkspaceStore((s) => s.patchTask);
  const toast = useUiStore((s) => s.toast);
  const [editing, setEditing] = useState<WorkspaceTask | null>(null);
  const [draft, setDraft] = useState(() => scheduleDraft());
  const anchor = dayDate(date);
  let days: Date[];
  if (view === "month") {
    const first = new Date(anchor);
    first.setDate(1);
    const start = shiftDate(first, -(first.getDay() + 6) % 7);
    days = Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
  } else {
    const start =
      view === "day" ? anchor : shiftDate(anchor, -(anchor.getDay() + 6) % 7);
    days = Array.from({ length: view === "day" ? 1 : 7 }, (_, i) =>
      shiftDate(start, i),
    );
  }
  const open = tasks.filter((t) => isOpen({ boards }, t));
  const unscheduled = open
    .filter((t) => !t.scheduledStart)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const go = (step: number) => {
    const next = new Date(anchor);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + step);
    } else next.setDate(next.getDate() + step * (view === "week" ? 7 : 1));
    void navigate({ search: { date: dateKey(next), view } });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        ) ||
        e.metaKey ||
        e.ctrlKey ||
        editing
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key.toLowerCase() === "t")
        void navigate({ search: { view, date: dateKey(new Date()) } });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [date, view, editing]);
  const edit = (task: WorkspaceTask) => {
    setEditing(task);
    setDraft(scheduleDraft(task));
  };
  const save = () => {
    if (!editing) return;
    try {
      patchTask(editing.id, schedulePayload(draft));
      setEditing(null);
      toast("Schedule updated");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const drop = (e: React.DragEvent, day: Date, minutes?: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/kanban-task");
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (minutes === undefined) {
      patchTask(id, { dueDate: dateKey(day) });
      toast("Due date updated");
      return;
    }
    const start = new Date(day);
    start.setMinutes(minutes);
    const duration =
      task.scheduledStart && task.scheduledEnd
        ? Date.parse(task.scheduledEnd) - Date.parse(task.scheduledStart)
        : (task.estimate ?? 30) * 60000;
    const reminderOffset =
      task.reminderAt && task.scheduledStart
        ? Date.parse(task.scheduledStart) - Date.parse(task.reminderAt)
        : null;
    patchTask(id, {
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + duration).toISOString(),
      reminderAt:
        reminderOffset === null
          ? null
          : new Date(start.getTime() - reminderOffset).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    toast("Time block moved");
  };
  const plan = () => {
    const candidates = unscheduled
      .filter((t) => t.focusOn === date || (t.dueDate && t.dueDate <= date))
      .slice(0, 10);
    const result = scheduleInGaps(candidates, events, date, open);
    for (const item of result)
      patchTask(item.task.id, {
        scheduledStart: item.start,
        scheduledEnd: item.end,
        reminderAt: new Date(Date.parse(item.start) - 5 * 60000).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    toast(
      result.length
        ? `Scheduled ${result.length} tasks around your meetings`
        : "No free gaps from 9am–6pm for these tasks",
    );
  };
  const taskChip = (task: WorkspaceTask) => (
    <button
      key={task.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/kanban-task", task.id)}
      onClick={() => edit(task)}
      className="bg-secondary hover:bg-background shadow-ring block min-h-7 w-full shrink-0 cursor-pointer truncate rounded-md px-2 py-1 text-left text-xs"
      title={task.title}
    >
      {task.scheduledStart
        ? new Date(task.scheduledStart).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }) + " "
        : ""}
      {task.title}
    </button>
  );
  return (
    <>
      <PageHeader
        icon={CalendarIcon}
        title="Calendar"
        actions={
          <Button variant="secondary" size="md" onClick={plan}>
            Schedule my day
          </Button>
        }
      />
      <PageToolbar>
        <Button
          variant="secondary"
          size="md"
          onClick={() =>
            navigate({ search: { view, date: dateKey(new Date()) } })
          }
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="md"
          aria-label="Previous period"
          onClick={() => go(-1)}
        >
          ←
        </Button>
        <Button
          variant="ghost"
          size="md"
          aria-label="Next period"
          onClick={() => go(1)}
        >
          →
        </Button>
        <h2 className="min-w-0 flex-1 truncate">
          {anchor.toLocaleDateString("en", {
            month: "long",
            year: "numeric",
            ...(view === "day" ? { day: "numeric" } : {}),
          })}
        </h2>
        <div className="flex gap-1">
          {(["month", "week", "day"] as const).map((v) => (
            <Button
              key={v}
              variant="chip"
              size="sm"
              data-active={v === view}
              onClick={() => navigate({ search: { view: v, date } })}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </PageToolbar>
      {error && (
        <p role="status" className="text-danger px-4 pt-3">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto xl:flex-row">
        <aside className="border-border flex shrink-0 flex-col gap-2 border-b p-4 xl:w-60 xl:overflow-y-auto xl:border-r xl:border-b-0">
          <h2>
            Unscheduled{" "}
            <span className="text-subtle">{unscheduled.length}</span>
          </h2>
          <p className="text-subtle text-xs">
            Drag a task onto a time slot, or select it to set exact times.
          </p>
          <div className="flex max-h-44 flex-col gap-2 overflow-y-auto xl:max-h-none">
            {unscheduled.length ? (
              unscheduled.map(taskChip)
            ) : (
              <p className="text-subtle">Everything has a place.</p>
            )}
          </div>
          <p className="text-subtle mt-2 text-xs">
            Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. ←
            → to navigate · T for today.
          </p>
        </aside>
        <motion.div
          key={`${date}-${view}`}
          initial={{ opacity: 0.5, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
          className="min-w-0 flex-1"
        >
          {view === "month" ? (
            <div className="grid min-w-[620px] grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div
                  key={day}
                  className="border-border text-subtle border-b p-3 text-xs"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = dateKey(day);
                return (
                  <div
                    key={key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, day)}
                    className={cn(
                      "border-border min-h-32 space-y-1 border-r border-b p-2",
                      day.getMonth() !== anchor.getMonth() && "opacity-40",
                    )}
                  >
                    <button
                      className={cn(
                        "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                        key === dateKey(new Date()) &&
                          "bg-primary text-primary-foreground",
                      )}
                      onClick={() =>
                        navigate({ search: { view: "day", date: key } })
                      }
                    >
                      {day.getDate()}
                    </button>
                    {open
                      .filter((t) =>
                        t.scheduledStart
                          ? dateKey(new Date(t.scheduledStart)) === key
                          : t.dueDate === key,
                      )
                      .map(taskChip)}
                    {events
                      .filter(
                        (e) =>
                          dateKey(
                            e.allDay ? dayDate(e.start) : new Date(e.start),
                          ) <= key &&
                          (e.allDay
                            ? e.end > key
                            : dateKey(new Date(e.end)) >= key),
                      )
                      .map((e) => (
                        <a
                          key={e.id}
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-subtle block truncate rounded bg-secondary/50 px-1 text-xs"
                          title={`${e.calendar}: ${e.title}`}
                        >
                          {e.title}
                        </a>
                      ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={cn("min-w-[680px]", view === "day" && "min-w-[320px]")}
            >
              <div
                className="border-border sticky top-0 z-20 grid border-b bg-background"
                style={{
                  gridTemplateColumns: `48px repeat(${days.length},minmax(0,1fr))`,
                }}
              >
                <div />
                {days.map((day) => {
                  const key = dateKey(day);
                  return (
                    <div
                      key={key}
                      className="border-border border-l p-2 text-center"
                    >
                      <span className="text-subtle text-xs">
                        {day.toLocaleDateString("en", { weekday: "short" })}
                      </span>
                      <button
                        onClick={() =>
                          navigate({ search: { view: "day", date: key } })
                        }
                        className={cn(
                          "mx-auto mt-1 flex size-7 items-center justify-center rounded-full",
                          key === dateKey(new Date()) &&
                            "bg-primary text-primary-foreground",
                        )}
                      >
                        {day.getDate()}
                      </button>
                      <div className="mt-2 space-y-1 text-left">
                        {open
                          .filter((t) => !t.scheduledStart && t.dueDate === key)
                          .map(taskChip)}
                        {events
                          .filter(
                            (e) => e.allDay && e.start <= key && e.end > key,
                          )
                          .map((e) => (
                            <div
                              key={e.id}
                              className="text-subtle truncate text-xs"
                              title={e.title}
                            >
                              {e.title}
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `48px repeat(${days.length},minmax(0,1fr))`,
                }}
              >
                <div style={{ height: 24 * HOUR_HEIGHT }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="text-subtle pt-1 text-center text-[10px]"
                      style={{ height: HOUR_HEIGHT }}
                    >
                      {h === 0
                        ? "12am"
                        : h < 12
                          ? `${h}am`
                          : h === 12
                            ? "12pm"
                            : `${h - 12}pm`}
                    </div>
                  ))}
                </div>
                {days.map((day) => {
                  const key = dateKey(day),
                    midnight = day.getTime(),
                    next = shiftDate(day, 1).getTime();
                  const timed = open.filter(
                    (t) =>
                      t.scheduledStart &&
                      t.scheduledEnd &&
                      Date.parse(t.scheduledStart) < next &&
                      Date.parse(t.scheduledEnd) > midnight,
                  );
                  const meetings = events.filter(
                    (e) =>
                      !e.allDay &&
                      Date.parse(e.start) < next &&
                      Date.parse(e.end) > midnight,
                  );
                  const position = (start: string, end: string) => ({
                    top:
                      ((Math.max(midnight, Date.parse(start)) - midnight) /
                        3600000) *
                      HOUR_HEIGHT,
                    height: Math.max(
                      20,
                      ((Math.min(next, Date.parse(end)) -
                        Math.max(midnight, Date.parse(start))) /
                        3600000) *
                        HOUR_HEIGHT,
                    ),
                  });
                  return (
                    <div
                      key={key}
                      className="border-border relative border-l"
                      style={{ height: 24 * HOUR_HEIGHT }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        drop(
                          e,
                          day,
                          Math.max(
                            0,
                            Math.min(
                              1425,
                              Math.round(
                                ((e.clientY - rect.top) / HOUR_HEIGHT) * 4,
                              ) * 15,
                            ),
                          ),
                        );
                      }}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          key={h}
                          className="border-border border-b"
                          style={{ height: HOUR_HEIGHT }}
                        />
                      ))}
                      {meetings.map((e) => (
                        <a
                          key={e.id}
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="border-border text-subtle absolute inset-x-1 overflow-hidden rounded-lg border bg-secondary/80 p-1.5 text-xs"
                          style={position(e.start, e.end)}
                          title={`${e.calendar}: ${e.title}`}
                        >
                          {e.title}
                        </a>
                      ))}
                      {timed.map((task) => (
                        <motion.div
                          layout
                          key={task.id}
                          draggable
                          onDragStart={(e) =>
                            (
                              e as unknown as React.DragEvent
                            ).dataTransfer?.setData("text/kanban-task", task.id)
                          }
                          className="border-info/20 bg-card shadow-card absolute inset-x-2 z-10 overflow-hidden rounded-lg border-l-2 p-1.5"
                          style={position(
                            task.scheduledStart!,
                            task.scheduledEnd!,
                          )}
                        >
                          <button
                            className="block w-full truncate text-left text-xs"
                            onClick={() => edit(task)}
                            title={task.title}
                          >
                            {task.title}
                          </button>
                          <span className="text-subtle text-[10px]">
                            {new Date(task.scheduledStart!).toLocaleTimeString(
                              [],
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </span>
                          <button
                            className="float-right px-1 text-xs"
                            aria-label={`Focus on ${task.title}`}
                            onClick={() => startTaskFocus(task.id)}
                          >
                            ▶
                          </button>
                          <div
                            role="slider"
                            tabIndex={0}
                            aria-label={`Resize ${task.title}`}
                            aria-valuemin={15}
                            aria-valuemax={1440}
                            aria-valuenow={Math.round(
                              (Date.parse(task.scheduledEnd!) -
                                Date.parse(task.scheduledStart!)) /
                                60000,
                            )}
                            onKeyDown={(e) => {
                              if (["ArrowDown", "ArrowUp"].includes(e.key)) {
                                e.preventDefault();
                                const end =
                                  Date.parse(task.scheduledEnd!) +
                                  (e.key === "ArrowDown" ? 15 : -15) * 60000;
                                if (end > Date.parse(task.scheduledStart!))
                                  patchTask(task.id, {
                                    scheduledEnd: new Date(end).toISOString(),
                                  });
                              }
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const y = e.clientY;
                              const node = e.currentTarget;
                              node.setPointerCapture(e.pointerId);
                              const up = (event: PointerEvent) => {
                                const delta =
                                  Math.round(
                                    ((event.clientY - y) / HOUR_HEIGHT) * 4,
                                  ) * 15;
                                const end = Math.max(
                                  Date.parse(task.scheduledStart!) + 15 * 60000,
                                  Date.parse(task.scheduledEnd!) +
                                    delta * 60000,
                                );
                                patchTask(task.id, {
                                  scheduledEnd: new Date(end).toISOString(),
                                });
                                node.removeEventListener("pointerup", up);
                              };
                              node.addEventListener("pointerup", up);
                            }}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize bg-secondary/60"
                          />
                        </motion.div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.title ?? "Schedule task"}
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                if (editing) {
                  patchTask(editing.id, {
                    scheduledStart: null,
                    scheduledEnd: null,
                    reminderAt: null,
                  });
                  setEditing(null);
                  toast("Time block removed");
                }
              }}
            >
              Clear block
            </Button>
            <Button variant="primary" size="md" onClick={save}>
              Save schedule
            </Button>
          </>
        }
      >
        <ScheduleFields
          value={draft}
          onChange={(patch) => setDraft((s) => ({ ...s, ...patch }))}
        />
      </Dialog>
    </>
  );
}
