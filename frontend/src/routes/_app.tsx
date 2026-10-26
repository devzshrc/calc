import { setOfflineScope, pendingMutations } from "@/lib/task-mutations";
import { useRef } from "react";
import { createFileRoute, redirect, useMatch } from "@tanstack/react-router";
import AppShell from "@/components/dashboard/dashboard";
import { getWorkspace } from "@/server/workspace";
import { getSession } from "@/server/session";
import { useKanbanStore } from "@/stores/kanban-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUiStore } from "@/stores/ui-store";
import { searchToUi } from "@/lib/search";
import { useIsoLayoutEffect } from "@/hooks/use-iso-layout-effect";

// Pathless layout: sidebar, dialogs, capture and shortcuts shared by every page.
export const Route = createFileRoute("/_app")({
  ssr: true,
  // The auth boundary: nothing under /_app renders or loads without a session.
  beforeLoad: async ({ location }) => {
    const { userId } = await getSession();
    if (!userId) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    return { userId };
  },
  // One cross-board snapshot feeds the sidebar, Today count, capture and goals.
  loader: () => getWorkspace(),
  component: AppLayout,
});

function AppLayout() {
  const workspace = Route.useLoaderData();
  const { userId } = Route.useRouteContext();
  if (typeof window !== "undefined") setOfflineScope(userId);
  const board = useMatch({ from: "/_app/b/$boardId", shouldThrow: false });
  const seeded = useRef(false);
  const boards = workspace.boards.map(({ id, title, favorite }) => ({
    id,
    title,
    favorite,
  }));

  // Seed every store before any subscriber renders: on the server for each
  // request, on the client once so hydration sees the same state.
  if (typeof window === "undefined" || !seeded.current) {
    seeded.current = true;
    useKanbanStore.setState({ boards });
    useWorkspaceStore.getState().load(workspace);
    if (board?.loaderData) {
      useKanbanStore.getState().load(board.loaderData.board);
      useUiStore.setState(searchToUi(board.search));
    }
  }
  useIsoLayoutEffect(() => {
    useKanbanStore.getState().setBoards(boards);
    if (!pendingMutations().length)
      useWorkspaceStore.getState().load(workspace);
  }, [workspace]);
  return <AppShell />;
}
