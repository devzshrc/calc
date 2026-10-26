
import Toolbar from "@/components/dashboard/toolbar/toolbar";
import Board from "@/components/dashboard/board/board";
import BoardSkeleton from "@/components/dashboard/board/board-skeleton";
import Overview from "@/components/dashboard/overview/overview";
import Updates from "@/components/dashboard/updates/updates";
import Inbox from "@/components/dashboard/main/inbox";
import EmptyView from "@/components/dashboard/main/empty-view";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";

export default function Main() {
  const hydrated = useKanbanStore((state) => state.hydrated);
  const nav = useUiStore((state) => state.nav);
  const tab = useUiStore((state) => state.tab);
  const boardNav = nav === "team-issues" || nav === "my-issues";

  if (!hydrated) return <BoardSkeleton />;
  if (nav === "inbox") return <Inbox />;
  if (!boardNav) return <EmptyView nav={nav} />;

  return (
    <>
      <Toolbar />
      {tab === "issues" && <Board mine={nav === "my-issues"} />}
      {tab === "overview" && <Overview />}
      {tab === "updates" && <Updates />}
    </>
  );
}
