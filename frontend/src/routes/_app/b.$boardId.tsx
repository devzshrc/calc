import { pendingMutations } from "@/lib/task-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Suspense, use, useEffect } from "react";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import Header from "@/components/dashboard/header/header";
import Main from "@/components/dashboard/main/main";
import BoardSkeleton from "@/components/dashboard/board/board-skeleton";
import { getActivity, getBoard } from "@/server/boards";
import { useIsoLayoutEffect } from "@/hooks/use-iso-layout-effect";
import { boardSearchSchema, searchToUi, uiToSearch } from "@/lib/search";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import type { Activity } from "@/lib/kanban";

export const Route = createFileRoute("/_app/b/$boardId")({
  // Full-document SSR: the board is the primary content, render it on the server.
  ssr: true,
  validateSearch: boardSearchSchema,
  search: {
    middlewares: [stripSearchParams({ view: "board", tab: "issues", q: "" })],
  },
  loader: async ({ params }) => {
    // Activity is secondary: kick it off but don't block, it streams in later.
    const activity = getActivity({ data: { boardId: params.boardId } });
    const board = await getBoard({ data: { boardId: params.boardId } });
    return { board, activity };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.board.title} - Kanban` : "Kanban" },
    ],
  }),
  pendingComponent: BoardSkeleton,
  component: BoardRoute,
});

function BoardRoute() {
  const { board, activity } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Seed the client stores from loader data before first paint, on server and client.
  useIsoLayoutEffect(() => {
    if (
      useKanbanStore.getState().id === board.id &&
      useKanbanStore.getState().tasks === board.tasks
    )
      return;
    const pending = pendingMutations().length > 0;
    useKanbanStore.getState().load(
      pending
        ? {
            ...board,
            tasks: useWorkspaceStore
              .getState()
              .tasks.filter((t) => t.boardId === board.id)
              .map(({ boardId: _, ...task }) => task),
          }
        : board,
    );
  }, [board]);

  // ?task=<id> deep link (from Today, Review, capture) opens that task once.
  useEffect(() => {
    if (!search.task) return;
    if (board.tasks.some((task) => task.id === search.task)) {
      useUiStore.getState().openDialog({ type: "task", taskId: search.task });
    }
    navigate({
      search: (prev) => ({ ...prev, task: undefined }),
      replace: true,
    });
  }, [search.task, board, navigate]);

  // URL -> UI store
  const ui = searchToUi(search);
  useIsoLayoutEffect(() => {
    const current = useUiStore.getState();
    if (
      current.nav !== ui.nav ||
      current.tab !== ui.tab ||
      current.search !== ui.search ||
      JSON.stringify(current.filter) !== JSON.stringify(ui.filter)
    ) {
      useUiStore.setState(ui);
    }
  }, [search]);

  // UI store -> URL
  useEffect(
    () =>
      useUiStore.subscribe((state, prev) => {
        if (
          state.nav === prev.nav &&
          state.tab === prev.tab &&
          state.search === prev.search &&
          state.filter === prev.filter
        ) {
          return;
        }
        navigate({
          search: (prev) => ({ ...uiToSearch(state), task: prev.task }),
          replace: true,
          resetScroll: false,
        });
      }),
    [navigate],
  );

  return (
    <>
      <Header />
      <Main />
      <Suspense fallback={null}>
        <StreamedActivity promise={activity} boardId={board.id} />
      </Suspense>
    </>
  );
}

function StreamedActivity({
  promise,
  boardId,
}: {
  promise: Promise<Activity[]>;
  boardId: string;
}) {
  const activity = use(promise);
  useEffect(() => {
    if (useKanbanStore.getState().id === boardId) {
      useKanbanStore.getState().setActivity(activity);
    }
  }, [activity, boardId]);
  return null;
}
