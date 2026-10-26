import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGroup } from "motion/react";
import { Reveal } from "@/components/_ui/motion";
import Button from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import {
  Empty,
  PageBody,
  PageHeader,
  Section,
  Tile,
} from "@/components/second-brain/page";
import TaskRow, { TaskList } from "@/components/second-brain/task-row";
import { errorMessage } from "@/components/second-brain/capture-dialog";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUiStore } from "@/stores/ui-store";
import { aiPlan, type DayPlan } from "@/server/ai";
import { getGoogleEvents } from "@/server/productivity";
import { scheduleInGaps, dayDate, shiftDate } from "@/lib/scheduling";
import { getCalendarUrl } from "@/server/workspace";
import { enableReminders, notificationsSupported, useReminderSettings } from "@/hooks/use-reminders";
import { formatMinutes } from "@/lib/kanban";
import { dayKeyFromNow, formatShort, todayKey } from "@/lib/dates";
import { isSnoozed } from "@/lib/recurrence";
import { byDueThenPriority, isOpen } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import SunIcon from "@/assets/icons/sun.svg?react";
import StarsIcon from "@/assets/icons/stars.svg?react";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";
import BellIcon from "@/assets/icons/bell-02.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";
import ZapIcon from "@/assets/icons/zap.svg?react";

// Data comes from the _app layout's workspace loader; SSR renders the full list.
export const Route = createFileRoute("/_app/today")({
  ssr: true,
  head: () => ({ meta: [{ title: "Today - Kanban" }] }),
  component: Today,
});

const CAPACITY = [60, 120, 240, 360];

function Today() {
  const boards = useWorkspaceStore((state) => state.boards);
  const tasks = useWorkspaceStore((state) => state.tasks);
  const patchTask = useWorkspaceStore((state) => state.patchTask);
  const openDialog = useUiStore((state) => state.openDialog);
  const toast = useUiStore((state) => state.toast);
  const reminders = useReminderSettings();
  const planRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  const today = todayKey();
  const week = dayKeyFromNow(7);

  const groups = useMemo(() => {
    const workspace = { boards };
    const open = tasks.filter((task) => isOpen(workspace, task));
    const awake = open.filter((task) => !isSnoozed(task, today));
    const focus = awake.filter((task) => task.focusOn === today);
    const inFocus = new Set(focus.map((t) => t.id));
    const rest = awake.filter((task) => !inFocus.has(task.id));
    const habits = rest
      .filter((t) => t.recurrence && t.dueDate && t.dueDate <= today)
      .sort(byDueThenPriority);
    const overdue = rest
      .filter((t) => !t.recurrence && t.dueDate && t.dueDate < today)
      .sort(byDueThenPriority);
    const dueToday = rest.filter((t) => !t.recurrence && t.dueDate === today).sort(byDueThenPriority);
    const upcoming = rest
      .filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= week)
      .sort(byDueThenPriority);
    const snoozed = open
      .filter((task) => isSnoozed(task, today))
      .sort((a, b) => (a.snoozedUntil ?? "").localeCompare(b.snoozedUntil ?? ""));
    const doneToday = tasks.filter(
      (t) => t.completedAt?.slice(0, 10) === today || t.completions.includes(today),
    );
    const planned = [...focus, ...habits, ...overdue, ...dueToday].reduce(
      (sum, t) => sum + (t.estimate ?? 0),
      0,
    );
    return { focus, habits, overdue, dueToday, upcoming, snoozed, doneToday, planned };
  }, [boards, tasks, today, week]);

  const runPlan = async (minutes: number) => {
    setPlanning(true);
    try {
      setPlan(await aiPlan({ data: { today, minutes } }));
    } catch (error) {
      toast(errorMessage(error, "Couldn't plan your day"));
    } finally {
      setPlanning(false);
    }
  };

  const schedulePlan = async () => {
    if (!plan) return;
    try {
      const start = dayDate(today);
      const events = await getGoogleEvents({ data: { start: start.toISOString(), end: shiftDate(start, 1).toISOString() } });
      const candidates = plan.focus.map(item => tasks.find(t => t.id === item.taskId)).filter((t): t is typeof tasks[number] => Boolean(t));
      const blocks = scheduleInGaps(candidates, events, today, tasks.filter(t => !candidates.some(c => c.id === t.id)));
      for (const block of blocks) patchTask(block.task.id, { focusOn: today, scheduledStart: block.start, scheduledEnd: block.end, reminderAt: new Date(Date.parse(block.start) - 5 * 60000).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast(`Scheduled ${blocks.length} of ${candidates.length} tasks`);
      setPlan(null);
    } catch { toast("Could not load your meetings. Check Connections before scheduling."); }
  };

  const pinPlan = () => {
    if (!plan) return;
    for (const item of plan.focus) patchTask(item.taskId, { focusOn: today });
    toast(`Pinned ${plan.focus.length} to focus`);
    setPlan(null);
  };

  const copyCalendar = async () => {
    try {
      const url = await getCalendarUrl();
      await navigator.clipboard.writeText(url);
      toast("Calendar feed link copied");
    } catch {
      toast("Couldn't copy the link");
    }
  };

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const planItems = plan?.focus
    .map((item) => ({ ...item, task: tasks.find((t) => t.id === item.taskId) }))
    .filter((item) => item.task);

  return (
    // Scoped so rows only connect within this page, never across routes.
    <LayoutGroup id="today">
      <PageHeader
        icon={SunIcon}
        title="Today"
        actions={
          <>
            <Button
              ref={planRef}
              variant="secondary"
              size="md"
              aria-expanded={planOpen}
              data-active={planOpen}
              disabled={planning}
              onClick={() => setPlanOpen((v) => !v)}
            >
              <StarsIcon aria-hidden className="size-3.5" />
              {planning ? "Planning…" : "Plan my day"}
            </Button>
            <Menu
              open={planOpen}
              onClose={() => setPlanOpen(false)}
              anchorRef={planRef}
              align="end"
              label="Time available today"
              items={[
                { id: "h", heading: "Time available" },
                ...CAPACITY.map((minutes) => ({
                  id: String(minutes),
                  label: formatMinutes(minutes),
                  onSelect: () => runPlan(minutes),
                })),
              ]}
            />
            <Button
              ref={moreRef}
              variant="secondary"
              size="icon"
              aria-label="Today options"
              aria-expanded={moreOpen}
              data-active={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <DotsIcon aria-hidden className="size-3.5" />
            </Button>
            <Menu
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              anchorRef={moreRef}
              align="end"
              label="Today options"
              items={[
                {
                  id: "reminders",
                  label: reminders.enabled
                    ? `Daily reminder at ${reminders.time}`
                    : "Turn on daily reminder",
                  icon: <BellIcon />,
                  checked: reminders.enabled,
                  disabled: !notificationsSupported(),
                  onSelect: async () => {
                    if (reminders.enabled) {
                      reminders.update({ enabled: false });
                      toast("Daily reminder off");
                    } else {
                      const on = await enableReminders();
                      toast(on ? `You'll get a digest at ${reminders.time}` : "Notifications are blocked in this browser");
                    }
                  },
                },
                ...(reminders.enabled
                  ? [
                      { id: "h", heading: "Reminder time" },
                      ...["07:00", "08:00", "09:00", "18:00"].map((time) => ({
                        id: `t-${time}`,
                        label: time,
                        checked: reminders.time === time,
                        onSelect: () => reminders.update({ time, lastSent: null }),
                      })),
                    ]
                  : []),
                { id: "sep", separator: true as const },
                {
                  id: "calendar",
                  label: "Copy calendar feed link",
                  icon: <CalendarIcon />,
                  onSelect: copyCalendar,
                },
              ]}
            />
          </>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="label-style text-muted-foreground">{dateLabel}</span>
            <p className="lead-style">
              {groups.overdue.length + groups.dueToday.length + groups.habits.length + groups.focus.length === 0
                ? "Nothing pressing. A good day to move a goal forward."
                : "Here's what needs you today."}
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => openDialog({ type: "capture" })}>
            <ZapIcon aria-hidden className="size-3.5" />
            Capture
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Tile label="Focus" value={groups.focus.length} tone="text-info" />
          <Tile label="Due today" value={groups.dueToday.length + groups.habits.length} />
          <Tile
            label="Overdue"
            value={groups.overdue.length}
            tone={groups.overdue.length ? "text-danger" : undefined}
          />
          <Tile label="Planned" value={groups.planned ? formatMinutes(groups.planned) : "–"} />
        </div>

        {plan && (
          <Section
            title="Suggested plan"
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => setPlan(null)}>
                  Dismiss
                </Button>
                {planItems && planItems.length > 0 && <Button variant="secondary" size="sm" onClick={schedulePlan}>Schedule it</Button>}
                {planItems && planItems.length > 0 && (
                  <Button variant="primary" size="sm" onClick={pinPlan}>
                    Pin to focus
                  </Button>
                )}
              </>
            }
          >
            <p className="text-muted-foreground">{plan.summary}</p>
            {planItems && planItems.length > 0 && (
              <ol className="flex flex-col gap-3">
                {planItems.map((item, index) => (
                  <Reveal as="li" index={index + 1} key={item.taskId} className="flex gap-3">
                    <span className="bg-secondary text-muted-foreground shadow-ring flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p>{item.task!.title}</p>
                      <p className="text-subtle">{item.reason}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            )}
          </Section>
        )}

        <Section title="Focus" meta={groups.focus.length || undefined}>
          {groups.focus.length === 0 ? (
            <Empty>Pin up to three things that would make today a win. Hover a task and press the target.</Empty>
          ) : (
            <TaskList>
              {groups.focus.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          )}
        </Section>

        {groups.overdue.length > 0 && (
          <Section title="Overdue" meta={groups.overdue.length}>
            <TaskList>
              {groups.overdue.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          </Section>
        )}

        <Section title="Due today" meta={groups.dueToday.length || undefined}>
          {groups.dueToday.length === 0 ? (
            <Empty>Nothing else is due today.</Empty>
          ) : (
            <TaskList>
              {groups.dueToday.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          )}
        </Section>

        {groups.habits.length > 0 && (
          <Section title="Habits" meta={groups.habits.length}>
            <TaskList>
              {groups.habits.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          </Section>
        )}

        <Section title="Next 7 days" meta={groups.upcoming.length || undefined}>
          {groups.upcoming.length === 0 ? (
            <Empty>Your week is clear.</Empty>
          ) : (
            <TaskList>
              {groups.upcoming.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          )}
        </Section>

        {groups.doneToday.length > 0 && (
          <Section title="Done today" meta={groups.doneToday.length}>
            <TaskList>
              {groups.doneToday.map((task) => (
                <TaskRow key={task.id} task={task} done />
              ))}
            </TaskList>
          </Section>
        )}

        {groups.snoozed.length > 0 && (
          <Section title="Snoozed" meta={groups.snoozed.length}>
            <TaskList>
              {groups.snoozed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  note={<span className={cn("text-subtle")}>Back {formatShort(task.snoozedUntil!)}</span>}
                />
              ))}
            </TaskList>
          </Section>
        )}
      </PageBody>
    </LayoutGroup>
  );
}
