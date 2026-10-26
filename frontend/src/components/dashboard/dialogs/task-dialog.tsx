
import { useState } from "react";
import Button from "@/components/_ui/button";
import Dialog from "@/components/_ui/dialog";
import { Field, Input, Textarea } from "@/components/_ui/form";
import { COLUMN_META, PRIORITY_COLOR } from "@/components/_common/column-meta";
import StatusBadge from "@/components/_common/status-badge";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import {
  CURRENT_USER_ID,
  ESTIMATES,
  PRIORITIES,
  RECURRENCES,
  createId,
  formatMinutes,
  type Priority,
  type Recurrence,
  type Subtask,
} from "@/lib/kanban";
import { dayKeyFromNow, formatShort } from "@/lib/dates";
import { streak } from "@/lib/recurrence";
import { aiBreakdown } from "@/server/ai";
import { errorMessage } from "@/components/second-brain/capture-dialog";
import { Select } from "@/components/_ui/form";
import StarsIcon from "@/assets/icons/stars.svg?react";
import RefreshIcon from "@/assets/icons/refresh.svg?react";
import ClockIcon from "@/assets/icons/clock.svg?react";
import MoonIcon from "@/assets/icons/moon.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";
import { cn } from "@/lib/utils";
import BarChartIcon from "@/assets/icons/bar-chart-12.svg?react";
import UserIcon from "@/assets/icons/user-03.svg?react";

import ScheduleFields, { scheduleDraft, schedulePayload } from "@/components/second-brain/schedule-fields";

type TaskDialogProps = {
  open: boolean;
  taskId: string | null;
  columnId: string | null;
};

type Draft = {
  title: string;
  description: string;
  columnId: string;
  priority: Priority;
  assigneeIds: string[];
  dueDate: string;
  recurrence: Recurrence | null;
  estimate: number | null;
  subtasks: Subtask[];
  goalId: string | null;
  snoozedUntil: string | null;
};

export default function TaskDialog({
  open,
  taskId,
  columnId,
}: TaskDialogProps) {
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const members = useKanbanStore((state) => state.members);
  const addTask = useKanbanStore((state) => state.addTask);
  const updateTask = useKanbanStore((state) => state.updateTask);
  const deleteTask = useKanbanStore((state) => state.deleteTask);
  const goals = useKanbanStore((state) => state.goals);
  const progress = useKanbanStore((state) => state.progress);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const toast = useUiStore((state) => state.toast);
  const [task] = useState(() =>
    taskId ? tasks.find((item) => item.id === taskId) : undefined,
  );
  const editing = Boolean(task);
  const [schedule, setSchedule] = useState(() => scheduleDraft(task));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          columnId: task.columnId,
          priority: task.priority,
          assigneeIds: task.assigneeIds,
          dueDate: task.dueDate ?? "",
          recurrence: task.recurrence,
          estimate: task.estimate,
          subtasks: task.subtasks,
          goalId: task.goalId,
          snoozedUntil: task.snoozedUntil,
        }
      : {
          title: "",
          description: "",
          columnId:
            columnId ??
            columns.find((c) => !c.hidden)?.id ??
            columns[0]?.id ??
            "",
          priority: "normal",
          assigneeIds: [CURRENT_USER_ID],
          dueDate: "",
          recurrence: null,
          estimate: null,
          subtasks: [],
          goalId: null,
          snoozedUntil: null,
        },
  );

  const patch = (next: Partial<Draft>) =>
    setDraft((current) => (current ? { ...current, ...next } : current));

  const toggleAssignee = (id: string) => {
    if (!draft) return;
    patch({
      assigneeIds: draft.assigneeIds.includes(id)
        ? draft.assigneeIds.filter((item) => item !== id)
        : [...draft.assigneeIds, id],
    });
  };

  const [newStep, setNewStep] = useState("");
  const [breaking, setBreaking] = useState(false);

  const addSteps = (titles: string[]) => {
    if (!draft) return;
    const steps = titles
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({ id: createId(), title, done: false }));
    if (steps.length) patch({ subtasks: [...draft.subtasks, ...steps] });
  };

  const breakDown = async () => {
    if (!task || breaking) return;
    setBreaking(true);
    try {
      const result = await aiBreakdown({ data: { taskId: task.id } });
      addSteps(result.subtasks);
    } catch (error) {
      toast(errorMessage(error, "Couldn't break it down"));
    } finally {
      setBreaking(false);
    }
  };

  const save = () => {
    if (!draft || !draft.title.trim()) return;
    let timing;
    try { timing = schedulePayload(schedule); } catch (error) { toast((error as Error).message); return; }
    const payload = {
      ...timing,
      title: draft.title.trim(),
      description: draft.description.trim(),
      columnId: draft.columnId,
      priority: draft.priority,
      assigneeIds: draft.assigneeIds,
      // A repeating task always needs a next date to land on.
      dueDate: draft.dueDate || (draft.recurrence ? dayKeyFromNow(0) : null),
      recurrence: draft.recurrence,
      estimate: draft.estimate,
      subtasks: draft.subtasks,
      goalId: draft.goalId,
      snoozedUntil: draft.snoozedUntil,
    };
    if (task) {
      updateTask(task.id, payload);
      toast("Task updated");
    } else {
      addTask(payload);
      toast("Task created");
    }
    closeDialog();
  };

  const remove = () => {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTask(task.id);
    toast("Task deleted");
    closeDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title={editing ? "Edit task" : "New task"}
      description={
        task
          ? [
              `Created ${formatShort(task.createdAt)}`,
              task.recurrence && streak(task) > 0 ? `${streak(task)} streak` : null,
              progress[task.id]
                ? `${progress[task.id].done}/${progress[task.id].total} linked tasks done`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              size="md"
              data-active={confirmDelete}
              onClick={remove}
              onBlur={() => setConfirmDelete(false)}
              className="mr-auto"
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={save}
            disabled={!draft?.title.trim()}
          >
            {editing ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      {draft && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="Column">
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Column"
            >
              {columns.map((column) => {
                const meta = COLUMN_META[column.kind];
                const active = draft.columnId === column.id;
                return (
                  <Button
                    key={column.id}
                    role="radio"
                    aria-checked={active}
                    variant="chip"
                    size="md"
                    data-active={active}
                    title={
                      column.hidden
                        ? `${column.name} (hidden column)`
                        : undefined
                    }
                    onClick={() => patch({ columnId: column.id })}
                    className={cn(column.hidden && !active && "text-subtle")}
                  >
                    <StatusBadge icon={meta.icon} tone={meta.tone} />
                    {column.name}
                  </Button>
                );
              })}
            </div>
          </Field>
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              data-autofocus
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="What needs to be done?"
            />
          </Field>
          <Field label="Notes" htmlFor="task-description">
            <Textarea
              id="task-description"
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="Context, links, anything you want to remember"
            />
          </Field>
          <Field label={`Steps${draft.subtasks.length ? ` · ${draft.subtasks.filter((s) => s.done).length}/${draft.subtasks.length}` : ""}`}>
            <div className="flex flex-col gap-1">
              {draft.subtasks.map((step) => (
                <div key={step.id} className="group/step flex items-center gap-2 rounded-lg px-1 py-1">
                  <input
                    type="checkbox"
                    aria-label={`Done: ${step.title}`}
                    checked={step.done}
                    onChange={() =>
                      patch({
                        subtasks: draft.subtasks.map((s) =>
                          s.id === step.id ? { ...s, done: !s.done } : s,
                        ),
                      })
                    }
                    className="accent-foreground size-3.5 shrink-0 cursor-pointer"
                  />
                  <span className={cn("min-w-0 flex-1 truncate", step.done && "text-subtle line-through")}>
                    {step.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove ${step.title}`}
                    onClick={() =>
                      patch({ subtasks: draft.subtasks.filter((s) => s.id !== step.id) })
                    }
                    className="opacity-0 group-hover/step:opacity-100 focus-visible:opacity-100"
                  >
                    <XCloseIcon aria-hidden className="size-3" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  aria-label="New step"
                  value={newStep}
                  onChange={(event) => setNewStep(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSteps([newStep]);
                      setNewStep("");
                    }
                  }}
                  placeholder="Add a step and press Enter"
                  className="h-[30px]"
                />
                {editing && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={breakDown}
                    disabled={breaking}
                    title="Split this into small steps with AI"
                  >
                    <StarsIcon aria-hidden className="size-3.5" />
                    {breaking ? "Thinking…" : "Break down"}
                  </Button>
                )}
              </div>
            </div>
          </Field>
          <Field label="Priority">
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Priority"
            >
              {PRIORITIES.map((priority) => (
                <Button
                  key={priority.value}
                  role="radio"
                  aria-checked={draft.priority === priority.value}
                  variant="chip"
                  size="md"
                  data-active={draft.priority === priority.value}
                  onClick={() => patch({ priority: priority.value })}
                >
                  <BarChartIcon
                    aria-hidden
                    className={cn("size-3.5", PRIORITY_COLOR[priority.value])}
                  />
                  {priority.label}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Assignees">
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const active = draft.assigneeIds.includes(member.id);
                return (
                  <Button
                    key={member.id}
                    variant="chip"
                    size="md"
                    aria-pressed={active}
                    data-active={active}
                    onClick={() => toggleAssignee(member.id)}
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
            </div>
          </Field>
          <ScheduleFields value={schedule} onChange={patch => setSchedule(s => ({ ...s, ...patch }))} />
          <Field label="Due date" htmlFor="task-due">
            <Input
              id="task-due"
              type="date"
              value={draft.dueDate}
              onChange={(event) => patch({ dueDate: event.target.value })}
            />
          </Field>
          <Field
            label="Repeat"
            hint={draft.recurrence ? "Finishing it logs today and moves it to the next date." : undefined}
          >
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repeat">
              {[{ value: null, label: "Never" }, ...RECURRENCES].map((item) => {
                const active = draft.recurrence === item.value;
                return (
                  <Button
                    key={item.label}
                    role="radio"
                    aria-checked={active}
                    variant="chip"
                    size="md"
                    data-active={active}
                    onClick={() => patch({ recurrence: item.value })}
                  >
                    {item.value && (
                      <RefreshIcon
                        aria-hidden
                        className={cn("size-3.5", active ? "text-foreground" : "text-icon")}
                      />
                    )}
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </Field>
          <Field label="Time estimate">
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Time estimate">
              {[null, ...ESTIMATES].map((minutes) => {
                const active = draft.estimate === minutes;
                return (
                  <Button
                    key={minutes ?? "none"}
                    role="radio"
                    aria-checked={active}
                    variant="chip"
                    size="md"
                    data-active={active}
                    onClick={() => patch({ estimate: minutes })}
                  >
                    {minutes && (
                      <ClockIcon
                        aria-hidden
                        className={cn("size-3.5", active ? "text-foreground" : "text-icon")}
                      />
                    )}
                    {minutes ? formatMinutes(minutes) : "None"}
                  </Button>
                );
              })}
              <Input
                type="number"
                min={1}
                max={1440}
                aria-label="Custom estimate in minutes"
                placeholder="min"
                value={draft.estimate && !ESTIMATES.includes(draft.estimate) ? draft.estimate : ""}
                onChange={(event) => {
                  const value = Math.round(Number(event.target.value));
                  patch({ estimate: value > 0 ? Math.min(value, 1440) : null });
                }}
                className="h-[30px] w-[72px]"
              />
            </div>
          </Field>
          {goals.some((goal) => goal.id !== task?.id) && (
            <Field label="Goal" htmlFor="task-goal" hint="Progress on the goal counts this task.">
              <Select
                id="task-goal"
                value={draft.goalId ?? ""}
                onChange={(event) => patch({ goalId: event.target.value || null })}
              >
                <option value="">No goal</option>
                {goals
                  .filter((goal) => goal.id !== task?.id)
                  .map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="Snooze" hint={draft.snoozedUntil ? `Hidden from the board until ${formatShort(draft.snoozedUntil)}.` : "Hide it from the board until later."}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Snooze">
              {[
                { label: "Off", value: null },
                { label: "Tomorrow", value: dayKeyFromNow(1) },
                { label: "Next week", value: dayKeyFromNow(7) },
                { label: "Next month", value: dayKeyFromNow(30) },
              ].map((item) => {
                const active = draft.snoozedUntil === item.value;
                return (
                  <Button
                    key={item.label}
                    role="radio"
                    aria-checked={active}
                    variant="chip"
                    size="md"
                    data-active={active}
                    onClick={() => patch({ snoozedUntil: item.value })}
                  >
                    {item.value && (
                      <MoonIcon
                        aria-hidden
                        className={cn("size-3.5", active ? "text-foreground" : "text-icon")}
                      />
                    )}
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </Field>
        </form>
      )}
    </Dialog>
  );
}
