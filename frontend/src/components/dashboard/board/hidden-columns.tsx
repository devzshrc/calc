
import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import Button from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import { COLUMN_META } from "@/components/_common/column-meta";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import type { Column } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";

type HiddenColumnsProps = {
  columns: Column[];
  counts: Record<string, number>;
  className?: string;
  onClose?: () => void;
};

function HiddenColumnRow({ column, count }: { column: Column; count: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hidden:${column.id}`,
    data: { type: "hidden", columnId: column.id },
  });
  const setColumnHidden = useKanbanStore((state) => state.setColumnHidden);
  const toast = useUiStore((state) => state.toast);
  const Icon = COLUMN_META[column.kind].icon;

  return (
    <div
      ref={setNodeRef}
      data-hidden-column={column.id}
      className={cn(
        "-mx-2 rounded-lg transition-colors duration-150",
        isOver && "bg-info/[0.08]",
      )}
    >
      <Button
        variant="ghost"
        size="md"
        title={`Show ${column.name}`}
        onClick={() => {
          setColumnHidden(column.id, false);
          toast(`${column.name} is now visible`);
        }}
        className="w-full justify-start gap-1.5 px-2"
      >
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            isOver ? "text-info" : "text-icon",
          )}
        />
        <span className="min-w-0 flex-1 truncate px-0.5 text-left">
          {column.name}
        </span>
        <span className="text-subtle tabular-nums">{count}</span>
      </Button>
    </div>
  );
}

export default function HiddenColumns({
  columns,
  counts,
  className,
  onClose,
}: HiddenColumnsProps) {
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const showAllColumns = useKanbanStore((state) => state.showAllColumns);
  const toast = useUiStore((state) => state.toast);

  return (
    <aside
      aria-label="Hidden columns"
      className={cn("flex w-[184px] shrink-0 flex-col gap-5 p-4", className)}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="truncate">Hidden column</h2>
        <div className="-my-1 -mr-1 flex items-center gap-1">
          <Button
            ref={menuRef}
            variant="ghost"
            size="xs"
            aria-label="Hidden columns options"
            aria-expanded={menuOpen}
            data-active={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <DotsIcon className="size-3.5" aria-hidden />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="xs"
              aria-label="Close panel"
              onClick={onClose}
            >
              <XCloseIcon className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </header>
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuRef}
        align="end"
        label="Hidden columns options"
        items={[
          {
            id: "show-all",
            label: "Show all columns",
            disabled: columns.length === 0,
            onSelect: () => {
              showAllColumns();
              toast("All columns are visible");
            },
          },
        ]}
      />
      <div className="bg-border h-px" />
      {columns.length === 0 ? (
        <p className="text-subtle">Every column is on the board.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {columns.map((column) => (
            <HiddenColumnRow
              key={column.id}
              column={column}
              count={counts[column.id] ?? 0}
            />
          ))}
        </div>
      )}
      <p className="text-subtle mt-auto text-[12px] leading-[140%]">
        Drop a task on a column to move it there, or click a column to bring
        it back to the board.
      </p>
    </aside>
  );
}
