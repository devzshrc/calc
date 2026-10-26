import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutGroup } from "motion/react";
import { Reveal } from "@/components/_ui/motion";
import Button from "@/components/_ui/button";
import { Empty, PageBody, PageHeader, Section, Tile } from "@/components/second-brain/page";
import TaskRow, { TaskList } from "@/components/second-brain/task-row";
import { errorMessage } from "@/components/second-brain/capture-dialog";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUiStore } from "@/stores/ui-store";
import { aiReview, type ReviewSuggestion } from "@/server/ai";
import { dayKeyFromNow, formatShort, todayKey } from "@/lib/dates";
import { firstColumn } from "@/lib/recurrence";
import { byDueThenPriority, columnKindOf, isOpen } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import FocusReview from "@/components/second-brain/focus-review";
import ChartIcon from "@/assets/icons/chart-bars.svg?react";
import StarsIcon from "@/assets/icons/stars.svg?react";
import FlagIcon from "@/assets/icons/flag.svg?react";

export const Route = createFileRoute("/_app/review")({
  ssr: true,
  head: () => ({ meta: [{ title: "Weekly review - Kanban" }] }),
  component: Review,
});

const STALE_DAYS = 14;

const ACTION_LABEL: Record<ReviewSuggestion["action"], string> = {
  reschedule: "Reschedule",
  drop: "Drop",
  breakdown: "Break down",
  focus: "Focus today",
};

function Review() {
  const boards = useWorkspaceStore((state) => state.boards);
  const tasks = useWorkspaceStore((state) => state.tasks);
  const goals = useWorkspaceStore((state) => state.goals);
  const patchTask = useWorkspaceStore((state) => state.patchTask);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const [ai, setAi] = useState<{ summary: string; suggestions: ReviewSuggestion[] } | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const today = todayKey();
  const weekAgo = dayKeyFromNow(-7);
  const staleBefore = dayKeyFromNow(-STALE_DAYS);

  const data = useMemo(() => {
    const workspace = { boards };
    const wins = tasks
      .filter((t) => t.completedAt && t.completedAt.slice(0, 10) > weekAgo)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    const open = tasks.filter((t) => isOpen(workspace, t));
    const slipped = open.filter((t) => !t.recurrence && t.dueDate && t.dueDate < today).sort(byDueThenPriority);
    const stale = open.filter(
      (t) =>
        !t.dueDate &&
        !t.recurrence &&
        t.createdAt.slice(0, 10) < staleBefore &&
        columnKindOf(workspace, t) !== "in-progress",
    );
    const habits = tasks.filter((t) => t.recurrence);
    // Share of the last 7 days each daily habit was done (weekly habits count once).
    let expected = 0;
    let hits = 0;
    for (const habit of habits) {
      const recent = habit.completions.filter((d) => d > weekAgo).length;
      const target = habit.recurrence === "daily" ? 7 : habit.recurrence === "weekdays" ? 5 : 1;
      expected += target;
      hits += Math.min(recent, target);
    }
    const goalRows = goals.map((goal) => {
      const linked = tasks.filter((t) => t.goalId === goal.id);
      const done = linked.filter((t) => !isOpen(workspace, t)).length;
      const recent = linked.some((t) => t.completedAt && t.completedAt.slice(0, 10) > staleBefore);
      return { goal, total: linked.length, done, stalled: linked.length > 0 && !recent };
    });
    const habitDone = habits.reduce(
      (sum, h) => sum + h.completions.filter((d) => d > weekAgo).length,
      0,
    );
    return {
      wins,
      slipped,
      stale,
      consistency: expected ? Math.round((hits / expected) * 100) : null,
      habitDone,
      goalRows,
    };
  }, [boards, tasks, goals, today, weekAgo, staleBefore]);

  const drop = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const board = boards.find((b) => b.id === task?.boardId);
    const canceled = board && firstColumn(board.columns, "canceled");
    if (!task || !canceled) return;
    patchTask(taskId, { columnId: canceled.id, focusOn: null });
    toast(`Dropped “${task.title}”`);
  };

  const apply = (suggestion: ReviewSuggestion) => {
    const { taskId, action } = suggestion;
    if (action === "reschedule") {
      patchTask(taskId, { dueDate: suggestion.dueDate ?? dayKeyFromNow(7) });
      toast("Rescheduled");
    } else if (action === "drop") {
      drop(taskId);
    } else if (action === "focus") {
      patchTask(taskId, { focusOn: today });
      toast("Pinned to today's focus");
    } else {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        navigate({ to: "/b/$boardId", params: { boardId: task.boardId }, search: { task: task.id } });
      }
    }
    setApplied((set) => new Set(set).add(taskId + action));
  };

  const runAi = async () => {
    setLoading(true);
    try {
      setAi(await aiReview({ data: { today } }));
      setApplied(new Set());
    } catch (error) {
      toast(errorMessage(error, "Couldn't run the review"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutGroup id="review">
      <PageHeader
        icon={ChartIcon}
        title="Weekly review"
        actions={
          <Button variant="secondary" size="md" onClick={runAi} disabled={loading}>
            <StarsIcon aria-hidden className="size-3.5" />
            {loading ? "Reviewing…" : "Review with AI"}
          </Button>
        }
      />
      <PageBody width="max-w-[860px]">
        <div className="flex flex-col gap-1">
          <span className="label-style text-muted-foreground">
            {formatShort(dayKeyFromNow(-6))} – {formatShort(today)}
          </span>
          <p className="lead-style">Close the loop on your week.</p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Tile label="Completed" value={data.wins.length} tone="text-success" />
          <Tile
            label="Habit consistency"
            value={data.consistency === null ? "–" : `${data.consistency}%`}
            tone="text-info"
          />
          <Tile
            label="Slipped"
            value={data.slipped.length}
            tone={data.slipped.length ? "text-danger" : undefined}
          />
          <Tile label="Stale" value={data.stale.length} />
        </div>

        {ai && (
          <Section
            title="AI review"
            actions={
              <Button variant="ghost" size="sm" onClick={() => setAi(null)}>
                Dismiss
              </Button>
            }
          >
            <p className="text-muted-foreground leading-[150%] whitespace-pre-line">{ai.summary}</p>
            {ai.suggestions.length > 0 && (
              <div className="divide-border flex flex-col divide-y">
                {ai.suggestions.map((suggestion, index) => {
                  const task = tasks.find((t) => t.id === suggestion.taskId);
                  if (!task) return null;
                  const done = applied.has(suggestion.taskId + suggestion.action);
                  return (
                    <Reveal
                      index={index + 1}
                      key={suggestion.taskId + suggestion.action}
                      className="flex items-start gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p>{task.title}</p>
                        <p className="text-subtle">{suggestion.reason}</p>
                      </div>
                      <Button
                        variant={suggestion.action === "drop" ? "danger" : "secondary"}
                        size="sm"
                        disabled={done}
                        onClick={() => apply(suggestion)}
                        className="shrink-0"
                      >
                        {done
                          ? "Done"
                          : suggestion.action === "reschedule" && suggestion.dueDate
                            ? `Move to ${formatShort(suggestion.dueDate)}`
                            : ACTION_LABEL[suggestion.action]}
                      </Button>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        <Section title="Wins" meta={data.wins.length + data.habitDone || undefined}>
          {data.wins.length === 0 && data.habitDone === 0 ? (
            <Empty>Nothing finished in the last 7 days yet. Small wins count.</Empty>
          ) : (
            <>
              {data.habitDone > 0 && (
                <p className="text-muted-foreground">
                  Plus {data.habitDone} habit check-in{data.habitDone === 1 ? "" : "s"}.
                </p>
              )}
              <TaskList>
                {data.wins.map((task) => (
                  <TaskRow key={task.id} task={task} done />
                ))}
              </TaskList>
            </>
          )}
        </Section>

        <Section title="Slipped" meta={data.slipped.length || undefined}>
          {data.slipped.length === 0 ? (
            <Empty>Nothing overdue. Nicely done.</Empty>
          ) : (
            <TaskList>
              {data.slipped.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </TaskList>
          )}
        </Section>

        <Section title="Goals" meta={data.goalRows.length || undefined}>
          {data.goalRows.length === 0 ? (
            <Empty>Add tasks to a board named “Goals”, then link tasks to them from the task dialog.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {data.goalRows.map(({ goal, total, done, stalled }) => (
                <div key={goal.id} className="flex items-center gap-3">
                  <FlagIcon aria-hidden className="text-icon size-3.5 shrink-0" />
                  <span className="w-48 min-w-0 truncate">{goal.title}</span>
                  <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-success block h-full origin-left rounded-full transition-transform duration-300 ease-out"
                      style={{ transform: `scaleX(${total ? done / total : 0})` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-20 shrink-0 text-right tabular-nums",
                      stalled ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {total === 0 ? "No tasks" : stalled ? "Stalled" : `${done}/${total}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Stale" meta={data.stale.length || undefined}>
          {data.stale.length === 0 ? (
            <Empty>No forgotten tasks older than {STALE_DAYS} days.</Empty>
          ) : (
            <TaskList>
              {data.stale.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  note={<span className="text-subtle">Added {formatShort(task.createdAt)} with no date</span>}
                  trailing={
                    <Button variant="danger" size="sm" onClick={() => drop(task.id)}>
                      Drop
                    </Button>
                  }
                />
              ))}
            </TaskList>
          )}
        </Section>
      </PageBody>
    </LayoutGroup>
  );
}
