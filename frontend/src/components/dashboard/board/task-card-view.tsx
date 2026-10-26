
import TaskChips from "@/components/dashboard/board/task-chips";
import { COLUMN_META } from "@/components/_common/column-meta";
import type { Display } from "@/stores/ui-store";
import { Fragment, type ReactNode } from "react";
import {
  crewLabel,
  formatMinutes,
  RECURRENCES,
  type Column,
  type Member,
  type Task,
} from "@/lib/kanban";
import { formatShort } from "@/lib/dates";
import { streak } from "@/lib/recurrence";
import { useKanbanStore } from "@/stores/kanban-store";
import RefreshIcon from "@/assets/icons/refresh.svg?react";
import CheckSquareIcon from "@/assets/icons/check-square.svg?react";
import ClockIcon from "@/assets/icons/clock.svg?react";
import FlagIcon from "@/assets/icons/flag.svg?react";

function Dot() {
  return <span aria-hidden className="size-[3px] rounded-full bg-border-strong" />;
}
import { cn } from "@/lib/utils";

export type TaskCardViewProps = {
  task: Task;
  column: Column;
  members: Member[];
  teamName: string;
  display: Display;
  interactive?: boolean;
  lifted?: boolean;
  invisible?: boolean;
  className?: string;
};

export default function TaskCardView({
  task,
  column,
  members,
  teamName,
  display,
  interactive = false,
  lifted = false,
  invisible = false,
  className,
}: TaskCardViewProps) {
  const meta = COLUMN_META[column.kind];
  const Icon = meta.icon;
  const showFooter = display.priority || display.assignees || display.due;
  const progress = useKanbanStore((state) => state.progress[task.id]);
  const goal = useKanbanStore((state) =>
    task.goalId ? state.goals.find((g) => g.id === task.goalId) : undefined,
  );
  const doneSteps = task.subtasks.filter((s) => s.done).length;
  const days = streak(task);
  const extras: { key: string; node: ReactNode }[] = [];
  if (task.recurrence) {
    extras.push({
      key: "repeat",
      node: (
        <span className="flex items-center gap-1 whitespace-nowrap">
          <RefreshIcon aria-hidden className="size-3" />
          {RECURRENCES.find((r) => r.value === task.recurrence)?.label}
          {days > 0 && <span className="text-success tabular-nums">· {days}</span>}
        </span>
      ),
    });
  }
  if (task.subtasks.length) {
    extras.push({
      key: "steps",
      node: (
        <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
          <CheckSquareIcon aria-hidden className="size-3" />
          {doneSteps}/{task.subtasks.length}
        </span>
      ),
    });
  }
  if (task.estimate) {
    extras.push({
      key: "estimate",
      node: (
        <span className="flex items-center gap-1 whitespace-nowrap">
          <ClockIcon aria-hidden className="size-3" />
          {formatMinutes(task.estimate)}
        </span>
      ),
    });
  }
  if (goal) {
    extras.push({
      key: "goal",
      node: (
        <span className="flex min-w-0 items-center gap-1">
          <FlagIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{goal.title}</span>
        </span>
      ),
    });
  }

  return (
    <div
      className={cn(
        "group/card shadow-card relative flex w-full flex-col overflow-clip rounded-2xl bg-card",
        lifted &&
          "shadow-card-lift animate-card-lift -rotate-4 motion-reduce:animate-none",
        invisible && "invisible",
        className,
      )}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start gap-1.5">
          <Icon
            aria-hidden
            className={cn("mt-[2px] size-3.5 shrink-0", meta.color)}
          />
          <h3 className="line-clamp-2 min-w-0 flex-1 break-words">
            {task.title}
          </h3>
        </div>
        {display.created && (
          <div className="text-subtle flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap">
              Created {formatShort(task.createdAt)}
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span
                aria-hidden
                className="size-[3px] rounded-full bg-border-strong"
              />
              {crewLabel(task, teamName)}
            </span>
          </div>
        )}
        {extras.length > 0 && (
          <div className="text-subtle flex flex-wrap items-center gap-x-2 gap-y-1">
            {extras.map((extra, index) => (
              <Fragment key={extra.key}>
                {index > 0 && <Dot />}
                {extra.node}
              </Fragment>
            ))}
          </div>
        )}
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2">
            <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <span
                className="bg-success block h-full origin-left rounded-full transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${progress.done / progress.total})` }}
              />
            </span>
            <span className="text-subtle tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
        )}
      </div>
      {showFooter && (
        <div className="border-card-border flex flex-wrap items-center gap-2 border-t p-4">
          <TaskChips
            task={task}
            column={column}
            members={members}
            display={display}
            interactive={interactive}
          />
        </div>
      )}
    </div>
  );
}
