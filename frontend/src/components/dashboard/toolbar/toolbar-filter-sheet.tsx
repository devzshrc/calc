
import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import { PRIORITY_COLOR } from "@/components/_common/column-meta";
import { useKanbanStore } from "@/stores/kanban-store";
import { DISPLAY_OPTIONS, useUiStore } from "@/stores/ui-store";
import { PRIORITIES } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import BarChartIcon from "@/assets/icons/bar-chart-12.svg?react";
import UserIcon from "@/assets/icons/user-03.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="label-style text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function ToolbarFilterSheet() {
  const filter = useUiStore((state) => state.filter);
  const setFilter = useUiStore((state) => state.setFilter);
  const display = useUiStore((state) => state.display);
  const setDisplay = useUiStore((state) => state.setDisplay);
  const members = useKanbanStore((state) => state.members);

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Group label="Priority">
        {PRIORITIES.map((priority) => {
          const active = filter.priority === priority.value;
          return (
            <Button
              key={priority.value}
              variant="chip"
              size="lg"
              aria-pressed={active}
              data-active={active}
              onClick={() =>
                setFilter({ priority: active ? null : priority.value })
              }
            >
              <BarChartIcon
                aria-hidden
                className={cn("size-3.5", PRIORITY_COLOR[priority.value])}
              />
              {priority.label}
            </Button>
          );
        })}
      </Group>
      <Group label="Assignee">
        {members.map((member) => {
          const active = filter.assigneeId === member.id;
          return (
            <Button
              key={member.id}
              variant="chip"
              size="lg"
              aria-pressed={active}
              data-active={active}
              onClick={() =>
                setFilter({ assigneeId: active ? null : member.id })
              }
            >
              <UserIcon
                aria-hidden
                className={cn(
                  "size-3.5",
                  active ? "text-foreground" : "text-icon",
                )}
              />
              {member.name}
            </Button>
          );
        })}
      </Group>
      <Group label="Due date">
        <Button
          variant="chip"
          size="lg"
          aria-pressed={filter.overdue}
          data-active={filter.overdue}
          onClick={() => setFilter({ overdue: !filter.overdue })}
        >
          <CalendarIcon aria-hidden className="text-subtle size-3.5" />
          Overdue only
        </Button>
      </Group>
      <Group label="Show on cards">
        {DISPLAY_OPTIONS.map((option) => (
          <Button
            key={option.key}
            variant="chip"
            size="lg"
            aria-pressed={display[option.key]}
            data-active={display[option.key]}
            onClick={() => setDisplay({ [option.key]: !display[option.key] })}
          >
            {option.label}
          </Button>
        ))}
      </Group>
    </div>
  );
}
