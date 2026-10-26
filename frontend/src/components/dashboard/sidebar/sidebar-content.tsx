import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import SidebarItem, {
  sidebarFade,
} from "@/components/dashboard/sidebar/sidebar-item";
import StatusBadge from "@/components/_common/status-badge";
import SidebarUser from "@/components/dashboard/sidebar/sidebar-user";
import Button from "@/components/_ui/button";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { boardIcon } from "@/lib/board-icon";
import { todayKey } from "@/lib/dates";
import { isSnoozed } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import Logo from "@/assets/logo.svg?react";
import AlignLeftIcon from "@/assets/icons/align-left-01.svg?react";
import InboxIcon from "@/assets/icons/inbox-01.svg?react";
import GridIcon from "@/assets/icons/grid-03.svg?react";
import SunIcon from "@/assets/icons/sun.svg?react";
import ZapIcon from "@/assets/icons/zap.svg?react";
import ChartIcon from "@/assets/icons/chart-bars.svg?react";
import BookIcon from "@/assets/icons/book-open.svg?react";
import StarsIcon from "@/assets/icons/stars.svg?react";
import ShareIcon from "@/assets/icons/share-01.svg?react";
import StarIcon from "@/assets/icons/star-01.svg?react";
import CalendarIcon from "@/assets/icons/calendar.svg?react";
import SettingsIcon from "@/assets/icons/settings-04.svg?react";
import PlusIcon from "@/assets/icons/plus.svg?react";

type SidebarContentProps = {
  collapsed: boolean;
  onToggle: () => void;
  toggleLabel: string;
};

function SidebarLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: string;
}) {
  return (
    <span
      data-collapsed={collapsed}
      className={cn(
        "label-style text-muted-foreground px-2 py-1 whitespace-nowrap",
        sidebarFade,
      )}
    >
      {children}
    </span>
  );
}

function Count({ value }: { value: number }) {
  if (!value) return null;
  return <span className="text-subtle tabular-nums">{value}</span>;
}

/** Open tasks due today or earlier, across every board. */
function useDueCount() {
  const boards = useWorkspaceStore((state) => state.boards);
  const tasks = useWorkspaceStore((state) => state.tasks);
  return useMemo(() => {
    const today = todayKey();
    return tasks.filter((task) => {
      const board = boards.find((b) => b.id === task.boardId);
      const kind = board?.columns.find((c) => c.id === task.columnId)?.kind;
      if (kind === "done" || kind === "canceled" || kind === "duplicated") return false;
      if (isSnoozed(task, today)) return false;
      return (task.dueDate && task.dueDate <= today) || task.focusOn === today;
    }).length;
  }, [boards, tasks]);
}

export default function SidebarContent({
  collapsed,
  onToggle,
  toggleLabel,
}: SidebarContentProps) {
  const nav = useUiStore((state) => state.nav);
  const openDialog = useUiStore((state) => state.openDialog);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const boards = useKanbanStore((state) => state.boards);
  const boardId = useKanbanStore((state) => state.id);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const dueCount = useDueCount();
  const onBoard = pathname.startsWith("/b/");
  const homeBoard = boardId || boards.find((b) => b.favorite)?.id || boards[0]?.id;

  const go = (to: "/today" | "/review" | "/journal" | "/ask" | "/calendar" | "/connections") => {
    setSidebarOpen(false);
    navigate({ to });
  };

  const boardView = (view: "inbox" | "mine") => {
    setSidebarOpen(false);
    if (!homeBoard) return;
    navigate({ to: "/b/$boardId", params: { boardId: homeBoard }, search: { view } });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "border-border ease-in-out relative shrink-0 border-b transition-[height] duration-200",
          collapsed ? "h-[100px]" : "h-[62px]",
        )}
      >
        <Logo
          role="img"
          aria-label="Kanban"
          className="absolute top-4 left-4 size-[30px]"
        />
        <span
          data-collapsed={collapsed}
          className={cn(
            "lead-style absolute top-4 left-[54px] flex h-[30px] items-center whitespace-nowrap",
            sidebarFade,
          )}
        >
          Kanban
        </span>
        <Button
          variant="secondary"
          size="icon"
          aria-label={toggleLabel}
          onClick={onToggle}
          className={cn(
            "shadow-ring ease-in-out absolute transition-[top,left] duration-200",
            collapsed ? "top-[54px] left-[15px]" : "top-4 left-[214px]",
          )}
        >
          <AlignLeftIcon
            aria-hidden
            className={cn(
              "text-icon ease-in-out size-3.5 transition-transform duration-200",
              collapsed && "rotate-180",
            )}
          />
        </Button>
      </div>

      <nav
        aria-label="Personal"
        className="border-border flex flex-col gap-1 border-b p-4"
      >
        <button
          type="button"
          title={collapsed ? "Quick capture (⌘K)" : undefined}
          onClick={() => {
            setSidebarOpen(false);
            openDialog({ type: "capture" });
          }}
          className={cn(
            "shadow-control ease-out hover:bg-secondary focus-visible:shadow-focus mb-2 flex h-[30px] w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-[10px] bg-card px-2 text-left outline-none transition-[background-color,box-shadow] duration-150",
          )}
        >
          <ZapIcon aria-hidden className="text-icon size-3.5 shrink-0" />
          <span
            data-collapsed={collapsed}
            className={cn(
              "text-subtle min-w-0 flex-1 px-0.5 whitespace-nowrap",
              sidebarFade,
            )}
          >
            Quick capture
          </span>
          <kbd
            data-collapsed={collapsed}
            className={cn(
              "bg-secondary text-muted-foreground shadow-ring inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[11px]",
              sidebarFade,
            )}
          >
            ⌘K
          </kbd>
        </button>
        <SidebarItem
          icon={SunIcon}
          label="Today"
          collapsed={collapsed}
          active={pathname === "/today"}
          onClick={() => go("/today")}
          trailing={<Count value={dueCount} />}
        />
        <SidebarItem icon={CalendarIcon} label="Calendar" collapsed={collapsed} active={pathname === "/calendar"} onClick={() => go("/calendar")} />
        <SidebarItem
          icon={InboxIcon}
          label="Inbox"
          collapsed={collapsed}
          active={onBoard && nav === "inbox"}
          onClick={() => boardView("inbox")}
        />
        <SidebarItem
          icon={GridIcon}
          label="My tasks"
          collapsed={collapsed}
          active={onBoard && nav === "my-issues"}
          onClick={() => boardView("mine")}
        />
      </nav>

      <nav
        aria-label="Second brain"
        className="border-border flex flex-col gap-1 border-b p-4"
      >
        <SidebarLabel collapsed={collapsed}>Second brain</SidebarLabel>
        <SidebarItem
          icon={ChartIcon}
          label="Weekly review"
          collapsed={collapsed}
          active={pathname === "/review"}
          onClick={() => go("/review")}
        />
        <SidebarItem
          icon={BookIcon}
          label="Journal"
          collapsed={collapsed}
          active={pathname === "/journal"}
          onClick={() => go("/journal")}
        />
        <SidebarItem
          icon={StarsIcon}
          label="Ask"
          collapsed={collapsed}
          active={pathname === "/ask"}
          onClick={() => go("/ask")}
        />
      </nav>

      <nav
        aria-label="Boards"
        className="scroll-thin border-border flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto border-b p-4"
      >
        <SidebarLabel collapsed={collapsed}>Boards</SidebarLabel>
        {boards.map((board) => {
          const active = onBoard && board.id === boardId;
          return (
            <SidebarItem
              key={board.id}
              label={board.title}
              collapsed={collapsed}
              active={active && nav !== "inbox" && nav !== "my-issues"}
              onClick={() => {
                setSidebarOpen(false);
                navigate({ to: "/b/$boardId", params: { boardId: board.id } });
              }}
              leading={
                <StatusBadge
                  icon={boardIcon(board.title)}
                  tone={active ? "info" : "neutral"}
                />
              }
              trailing={
                board.favorite ? (
                  <StarIcon
                    aria-hidden
                    className="text-warning size-3 fill-current"
                  />
                ) : undefined
              }
            />
          );
        })}
        <SidebarItem
          icon={PlusIcon}
          label="New board"
          collapsed={collapsed}
          onClick={() => openDialog({ type: "new-board" })}
        />
      </nav>

      <div className="flex flex-col gap-1 p-4">
        <SidebarItem
          icon={ShareIcon}
          label="Import tasks"
          collapsed={collapsed}
          onClick={() => openDialog({ type: "capture", mode: "dump" })}
        />
        <SidebarItem icon={SettingsIcon} label="Connections" collapsed={collapsed} active={pathname === "/connections"} onClick={() => go("/connections")} />
        <SidebarUser collapsed={collapsed} />
      </div>
    </div>
  );
}
