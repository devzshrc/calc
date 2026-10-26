
import { useMemo } from "react";
import Button from "@/components/_ui/button";
import StatusBadge from "@/components/_common/status-badge";
import { COLUMN_META, PRIORITY_COLOR } from "@/components/_common/column-meta";
import HabitGrid from "@/components/dashboard/overview/habit-grid";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { PRIORITIES } from "@/lib/kanban";
import { dueInfo, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import BarChartIcon from "@/assets/icons/bar-chart-12.svg?react";
import UserIcon from "@/assets/icons/user-03.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="shadow-card flex flex-col gap-3 rounded-2xl bg-card p-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums",
          tone,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className: string;
}) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
      <span
        className={cn(
          "block h-full origin-left rounded-full transition-transform duration-300 ease-out",
          className,
        )}
        style={{ transform: `scaleX(${width / 100})` }}
      />
    </span>
  );
}

export default function Overview() {
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const members = useKanbanStore((state) => state.members);
  const setTab = useUiStore((state) => state.setTab);
  const openDialog = useUiStore((state) => state.openDialog);

  const stats = useMemo(() => {
    const done = new Set(
      columns.filter((c) => c.kind === "done").map((c) => c.id),
    );
    const overdue = tasks.filter((task) =>
      isOverdue(task.dueDate, done.has(task.columnId)),
    );
    const byColumn = columns.map((column) => ({
      column,
      count: tasks.filter((task) => task.columnId === column.id).length,
    }));
    const byPriority = PRIORITIES.map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority.value).length,
    }));
    const byMember = members.map((member) => ({
      member,
      count: tasks.filter(
        (task) =>
          task.assigneeIds.includes(member.id) && !done.has(task.columnId),
      ).length,
    }));
    const upcoming = tasks
      .filter((task) => task.dueDate && !done.has(task.columnId))
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 5);
    return { overdue, byColumn, byPriority, byMember, upcoming, doneIds: done };
  }, [tasks, columns, members]);

  const total = tasks.length;
  const doneCount = tasks.filter((task) =>
    stats.doneIds.has(task.columnId),
  ).length;
  const inProgress = tasks.filter((task) => {
    const column = columns.find((c) => c.id === task.columnId);
    return column?.kind === "in-progress";
  }).length;

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Tile label="All tasks" value={total} />
          <Tile label="In progress" value={inProgress} tone="text-info" />
          <Tile label="Done" value={doneCount} tone="text-success" />
          <Tile
            label="Overdue"
            value={stats.overdue.length}
            tone={stats.overdue.length ? "text-danger" : undefined}
          />
        </div>
        <div className="grid gap-3.5 md:grid-cols-2">
          <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
            <h2>By status</h2>
            <div className="flex flex-col gap-3">
              {stats.byColumn.map(({ column, count }) => {
                const meta = COLUMN_META[column.kind];
                return (
                  <div key={column.id} className="flex items-center gap-3">
                    <StatusBadge icon={meta.icon} tone={meta.tone} />
                    <span className="w-24 truncate">{column.name}</span>
                    <Bar
                      value={count}
                      max={total}
                      className={
                        meta.tone === "neutral"
                          ? "bg-subtle"
                          : `bg-${meta.tone}`
                      }
                    />
                    <span className="text-muted-foreground w-6 text-right tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
            <h2>By priority</h2>
            <div className="flex flex-col gap-3">
              {stats.byPriority.map(({ priority, count }) => (
                <div key={priority.value} className="flex items-center gap-3">
                  <BarChartIcon
                    aria-hidden
                    className={cn("size-3.5", PRIORITY_COLOR[priority.value])}
                  />
                  <span className="w-24">{priority.label}</span>
                  <Bar
                    value={count}
                    max={total}
                    className={PRIORITY_COLOR[priority.value].replace(
                      "text-",
                      "bg-",
                    )}
                  />
                  <span className="text-muted-foreground w-6 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
            <h2 className="mt-2">Open tasks per member</h2>
            <div className="flex flex-col gap-3">
              {stats.byMember.map(({ member, count }) => (
                <div key={member.id} className="flex items-center gap-3">
                  <UserIcon aria-hidden className="text-icon size-3.5" />
                  <span className="w-24 truncate">{member.name}</span>
                  <Bar
                    value={count}
                    max={Math.max(1, ...stats.byMember.map((m) => m.count))}
                    className="bg-foreground"
                  />
                  <span className="text-muted-foreground w-6 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <HabitGrid />
        <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2>Due soon</h2>
            <Button variant="ghost" size="sm" onClick={() => setTab("issues")}>
              Open board
            </Button>
          </div>
          {stats.upcoming.length === 0 ? (
            <p className="text-subtle">No open tasks have a due date.</p>
          ) : (
            <div className="divide-border flex flex-col divide-y">
              {stats.upcoming.map((task) => {
                const column = columns.find((c) => c.id === task.columnId);
                const due = dueInfo(task.dueDate, column?.kind === "done");
                const meta = COLUMN_META[column?.kind ?? "todo"];
                return (
                  <Button
                    key={task.id}
                    variant="ghost"
                    size="md"
                    onClick={() =>
                      openDialog({ type: "task", taskId: task.id })
                    }
                    className="text-foreground -mx-2 h-auto justify-start motion-safe:active:scale-100 gap-3 rounded-lg px-2 py-2.5"
                  >
                    <meta.icon
                      aria-hidden
                      className={cn("size-3.5 shrink-0", meta.color)}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1",
                        due?.overdue ? "text-danger" : "text-muted-foreground",
                      )}
                    >
                      {!due?.overdue && (
                        <CalendarIcon
                          aria-hidden
                          className="text-subtle size-3.5"
                        />
                      )}
                      {due?.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
