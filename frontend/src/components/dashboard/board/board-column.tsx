
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { motion } from "motion/react";
import Button from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import { Input } from "@/components/_ui/form";
import StatusBadge from "@/components/_common/status-badge";
import { COLUMN_META } from "@/components/_common/column-meta";
import TaskCard from "@/components/dashboard/board/task-card";
import DropSlot from "@/components/dashboard/board/drop-slot";
import NewTaskComposer from "@/components/dashboard/board/new-task-composer";
import type { Placement } from "@/components/dashboard/board/board-drag";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore, type Display } from "@/stores/ui-store";
import type { Column, Member, Task } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import PlusIcon from "@/assets/icons/plus-solid.svg?react";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";

type BoardColumnProps = {
  column: Column;
  tasks: Task[];
  members: Member[];
  teamName: string;
  display: Display;
  activeId: string | null;
  activeTask: Task | null;
  placement: Placement | null;
  settledId: string | null;
};

export default function BoardColumn({
  column,
  tasks,
  members,
  teamName,
  display,
  activeId,
  activeTask,
  placement,
  settledId,
}: BoardColumnProps) {
  const { setNodeRef: setColumnRef } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
  });
  const { setNodeRef: setTailRef } = useDroppable({
    id: `tail:${column.id}`,
    data: { type: "tail", columnId: column.id },
  });
  const renameColumn = useKanbanStore((state) => state.renameColumn);
  const setColumnHidden = useKanbanStore((state) => state.setColumnHidden);
  const sortColumn = useKanbanStore((state) => state.sortColumn);
  const toast = useUiStore((state) => state.toast);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const meta = COLUMN_META[column.kind];

  const originIndex = tasks.findIndex((task) => task.id === activeId);
  const inColumn =
    placement !== null && !placement.hidden && placement.columnId === column.id;
  const others = tasks.length - (originIndex >= 0 ? 1 : 0);
  const slotIndex = inColumn
    ? Math.min(placement.index, others)
    : originIndex >= 0 && (placement === null || placement.hidden)
      ? originIndex
      : -1;

  const nodes: ReactNode[] = [];
  let visibleIndex = 0;
  const slot = activeTask && (
    <DropSlot
      key="drop-slot"
      task={activeTask}
      column={column}
      members={members}
      teamName={teamName}
      display={display}
    />
  );
  tasks.forEach((task, index) => {
    if (task.id === activeId) {
      nodes.push(
        <div
          key={task.id}
          className={cn("relative h-0", index === 0 ? "-mb-3.5" : "-mt-3.5")}
        >
          <div className="invisible absolute inset-x-0 top-0">
            <TaskCard
              task={task}
              column={column}
              members={members}
              teamName={teamName}
              display={display}
              hidden
            />
          </div>
        </div>,
      );
      return;
    }
    if (visibleIndex === slotIndex) nodes.push(slot);
    nodes.push(
      <TaskCard
        key={task.id}
        task={task}
        column={column}
        members={members}
        teamName={teamName}
        display={display}
        animateLayout={task.id !== settledId}
      />,
    );
    visibleIndex += 1;
  });
  if (slotIndex >= visibleIndex && slotIndex >= 0) nodes.push(slot);

  const commitRename = () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== column.name)
      renameColumn(column.id, draft);
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commitRename();
    if (event.key === "Escape") setRenaming(false);
  };

  return (
    <motion.section
      layoutScroll
      ref={setColumnRef}
      data-column-id={column.id}
      aria-label={column.name}
      className="scroll-thin border-border flex h-full w-[85vw] max-w-[340px] shrink-0 snap-start flex-col overflow-y-auto overscroll-y-contain border-r border-b sm:w-[320px] lg:w-auto lg:max-w-none lg:min-w-[345px] lg:flex-1"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-[linear-gradient(to_bottom,var(--background)_calc(100%-20px),transparent)] px-4 pt-4 pb-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <StatusBadge icon={meta.icon} tone={meta.tone} />
          {renaming ? (
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={onRenameKey}
              aria-label="Column name"
              className="h-7 px-2"
            />
          ) : (
            <h2 className="truncate">{column.name}</h2>
          )}
          <span className="text-subtle tabular-nums">{tasks.length}</span>
        </div>
        <div className="-my-1 -mr-1 flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Add task to ${column.name}`}
            onClick={() => setComposing(true)}
          >
            <PlusIcon className="size-3.5" aria-hidden />
          </Button>
          <Button
            ref={menuRef}
            variant="ghost"
            size="xs"
            aria-label={`${column.name} options`}
            aria-expanded={menuOpen}
            data-active={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <DotsIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuRef}
        align="end"
        label={`${column.name} options`}
        items={[
          { id: "add", label: "Add task", onSelect: () => setComposing(true) },
          {
            id: "rename",
            label: "Rename column",
            onSelect: () => {
              setDraft(column.name);
              setRenaming(true);
            },
          },
          { id: "sep-1", separator: true },
          {
            id: "sort-priority",
            label: "Sort by priority",
            disabled: tasks.length < 2,
            onSelect: () => sortColumn(column.id, "priority"),
          },
          {
            id: "sort-due",
            label: "Sort by due date",
            disabled: tasks.length < 2,
            onSelect: () => sortColumn(column.id, "due"),
          },
          { id: "sep-2", separator: true },
          {
            id: "hide",
            label: "Hide column",
            onSelect: () => {
              setColumnHidden(column.id, true);
              toast(`${column.name} moved to hidden columns`);
            },
          },
        ]}
      />
      <div className="flex flex-col gap-3.5 px-4">
        {composing && (
          <NewTaskComposer
            columnId={column.id}
            onClose={() => setComposing(false)}
          />
        )}
        {nodes}
        {tasks.length === 0 && !composing && slotIndex < 0 && (
          <div className="border-border bg-secondary flex h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed">
            <span className="text-subtle">No tasks here yet</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setComposing(true)}
            >
              <PlusIcon className="size-3.5" aria-hidden />
              Add task
            </Button>
          </div>
        )}
      </div>
      <div ref={setTailRef} className="min-h-14 flex-1" />
    </motion.section>
  );
}
