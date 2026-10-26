import { buttonVariants } from "@/components/_ui/button";
import StatusBadge from "@/components/_common/status-badge";
import { PRIORITY_COLOR } from "@/components/_common/column-meta";
import {
  PRIORITIES,
  RECURRENCES,
  formatMinutes,
  type Priority,
  type Recurrence,
} from "@/lib/kanban";
import { dueInfo } from "@/lib/dates";
import { boardIcon } from "@/lib/board-icon";
import { cn } from "@/lib/utils";
import BarChartIcon from "@/assets/icons/bar-chart-12.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";
import ClockIcon from "@/assets/icons/clock.svg?react";
import RefreshIcon from "@/assets/icons/refresh.svg?react";

type MetaChipsProps = {
  board?: { title: string } | null;
  priority?: Priority | null;
  dueDate?: string | null;
  done?: boolean;
  estimate?: number | null;
  recurrence?: Recurrence | null;
  size?: "sm" | "md";
};

/** Read-only versions of the card chips, for lists outside the board. */
export default function MetaChips({
  board,
  priority,
  dueDate,
  done = false,
  estimate,
  recurrence,
  size = "sm",
}: MetaChipsProps) {
  const chip = cn(buttonVariants({ variant: "chip", size }), "cursor-default");
  const due = dueInfo(dueDate ?? null, done);
  return (
    <>
      {board && (
        <span className={chip}>
          <StatusBadge icon={boardIcon(board.title)} tone="neutral" />
          {board.title}
        </span>
      )}
      {priority && priority !== "normal" && (
        <span className={chip}>
          <BarChartIcon aria-hidden className={cn("size-3.5", PRIORITY_COLOR[priority])} />
          {PRIORITIES.find((p) => p.value === priority)?.label}
        </span>
      )}
      {due && (
        <span className={cn(chip, due.overdue && "text-danger")}>
          {!due.overdue && <CalendarIcon aria-hidden className="text-subtle size-3.5" />}
          {due.label}
        </span>
      )}
      {estimate ? (
        <span className={chip}>
          <ClockIcon aria-hidden className="text-subtle size-3.5" />
          {formatMinutes(estimate)}
        </span>
      ) : null}
      {recurrence && (
        <span className={chip}>
          <RefreshIcon aria-hidden className="text-subtle size-3.5" />
          {RECURRENCES.find((r) => r.value === recurrence)?.label}
        </span>
      )}
    </>
  );
}
