
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import Button, { buttonVariants } from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import Popover from "@/components/_ui/popover";
import { Input } from "@/components/_ui/form";
import { PRIORITY_COLOR } from "@/components/_common/column-meta";
import { useKanbanStore } from "@/stores/kanban-store";
import type { Display } from "@/stores/ui-store";
import {
  CURRENT_USER_ID,
  PRIORITIES,
  memberLabel,
  type Column,
  type Member,
  type Task,
} from "@/lib/kanban";
import { dayKeyFromNow, dueInfo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import BarChartIcon from "@/assets/icons/bar-chart-12.svg?react";
import UserIcon from "@/assets/icons/user-03.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";

type ChipsProps = {
  task: Task;
  column: Column;
  members: Member[];
  display: Display;
  interactive: boolean;
};

const stop = (event: MouseEvent | TouchEvent) => event.stopPropagation();

function priorityLabel(task: Task) {
  return (
    PRIORITIES.find((item) => item.value === task.priority)?.label ?? "Normal"
  );
}

function PriorityChip({ task }: { task: Task }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const updateTask = useKanbanStore((state) => state.updateTask);

  return (
    <>
      <Button
        ref={ref}
        variant="chip"
        size="md"
        aria-label={`Priority: ${priorityLabel(task)}`}
        aria-expanded={open}
        data-active={open}
        onMouseDown={stop}
        onTouchStart={stop}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <BarChartIcon
          aria-hidden
          className={cn("size-3.5", PRIORITY_COLOR[task.priority])}
        />
        {priorityLabel(task)}
      </Button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label="Set priority"
        items={PRIORITIES.map((item) => ({
          id: item.value,
          label: item.label,
          icon: <BarChartIcon className={PRIORITY_COLOR[item.value]} />,
          checked: task.priority === item.value,
          onSelect: () => updateTask(task.id, { priority: item.value }),
        }))}
      />
    </>
  );
}

function AssigneeChip({ task, members }: { task: Task; members: Member[] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const updateTask = useKanbanStore((state) => state.updateTask);
  const assigned = task.assigneeIds.includes(CURRENT_USER_ID);

  const toggle = (id: string) => {
    const next = task.assigneeIds.includes(id)
      ? task.assigneeIds.filter((item) => item !== id)
      : [...task.assigneeIds, id];
    updateTask(task.id, { assigneeIds: next });
  };

  return (
    <>
      <Button
        ref={ref}
        variant="chip"
        size="md"
        aria-label={`Assignees: ${memberLabel(task, members)}`}
        aria-expanded={open}
        data-active={open}
        onMouseDown={stop}
        onTouchStart={stop}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <UserIcon aria-hidden className="text-icon size-3.5" />
        {memberLabel(task, members)}
      </Button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label="Assign"
        items={[
          ...members.map((member) => ({
            id: member.id,
            label: member.name,
            icon: <UserIcon />,
            checked: task.assigneeIds.includes(member.id),
            keepOpen: true,
            onSelect: () => toggle(member.id),
          })),
          { id: "sep", separator: true as const },
          {
            id: "me",
            label: assigned ? "Unassign me" : "Assign to me",
            onSelect: () => toggle(CURRENT_USER_ID),
          },
        ]}
      />
    </>
  );
}

function DueChip({ task, column }: { task: Task; column: Column }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const updateTask = useKanbanStore((state) => state.updateTask);
  const due = dueInfo(task.dueDate, column.kind === "done");
  const quick = [
    { label: "Today", value: dayKeyFromNow(0) },
    { label: "Tomorrow", value: dayKeyFromNow(1) },
    { label: "Next week", value: dayKeyFromNow(7) },
  ];

  return (
    <>
      <Button
        ref={ref}
        variant="chip"
        size="md"
        aria-label={due ? `Due: ${due.label}` : "Set due date"}
        aria-expanded={open}
        data-active={open}
        onMouseDown={stop}
        onTouchStart={stop}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(due?.overdue && "text-danger hover:text-danger")}
      >
        {!due?.overdue && (
          <CalendarIcon aria-hidden className="text-subtle size-3.5" />
        )}
        {due ? due.label : "No date"}
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label="Set due date"
        className="w-[220px]"
      >
        <div className="flex flex-col">
          {quick.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="md"
              onClick={() => {
                updateTask(task.id, { dueDate: item.value });
                setOpen(false);
              }}
              className="text-foreground w-full justify-start gap-2 px-2"
            >
              <CalendarIcon
                className="text-muted-foreground size-3.5"
                aria-hidden
              />
              <span className="flex-1 text-left">{item.label}</span>
              {task.dueDate === item.value && (
                <span
                  aria-hidden
                  className="bg-foreground size-1.5 rounded-full"
                />
              )}
            </Button>
          ))}
          <div className="bg-border my-1 h-px" />
          <div className="p-1">
            <Input
              type="date"
              aria-label="Due date"
              value={task.dueDate ?? ""}
              onChange={(event) =>
                updateTask(task.id, { dueDate: event.target.value || null })
              }
              className="h-[30px]"
            />
          </div>
          {task.dueDate && (
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                updateTask(task.id, { dueDate: null });
                setOpen(false);
              }}
              className="w-full justify-start px-2"
            >
              Remove due date
            </Button>
          )}
        </div>
      </Popover>
    </>
  );
}

export default function TaskChips({
  task,
  column,
  members,
  display,
  interactive,
}: ChipsProps) {
  if (!interactive) {
    const due = dueInfo(task.dueDate, column.kind === "done");
    const chip = buttonVariants({ variant: "chip", size: "md" });
    return (
      <>
        {display.priority && (
          <span className={chip}>
            <BarChartIcon
              aria-hidden
              className={cn("size-3.5", PRIORITY_COLOR[task.priority])}
            />
            {priorityLabel(task)}
          </span>
        )}
        {display.assignees && (
          <span className={chip}>
            <UserIcon aria-hidden className="text-icon size-3.5" />
            {memberLabel(task, members)}
          </span>
        )}
        {display.due && due && (
          <span className={cn(chip, due.overdue && "text-danger")}>
            {!due.overdue && (
              <CalendarIcon aria-hidden className="text-subtle size-3.5" />
            )}
            {due.label}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {display.priority && <PriorityChip task={task} />}
      {display.assignees && <AssigneeChip task={task} members={members} />}
      {display.due && <DueChip task={task} column={column} />}
    </>
  );
}
