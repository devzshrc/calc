import { z } from "zod";
import type { Filter, NavId, Tab } from "@/stores/ui-store";

export const boardSearchSchema = z.object({
  view: z.enum(["board", "mine", "inbox"]).catch("board").default("board"),
  tab: z.enum(["overview", "updates", "issues"]).catch("issues").default("issues"),
  q: z.string().max(200).catch("").default(""),
  priority: z.enum(["urgent", "normal", "low"]).optional().catch(undefined),
  assignee: z.string().max(64).optional().catch(undefined),
  overdue: z.boolean().optional().catch(undefined),
  task: z.string().max(64).optional().catch(undefined),
});

export type BoardSearch = z.infer<typeof boardSearchSchema>;

const VIEW_TO_NAV: Record<BoardSearch["view"], NavId> = {
  board: "team-issues",
  mine: "my-issues",
  inbox: "inbox",
};

export function searchToUi(search: BoardSearch) {
  return {
    nav: VIEW_TO_NAV[search.view],
    tab: search.tab as Tab,
    search: search.q,
    filter: {
      priority: search.priority ?? null,
      assigneeId: search.assignee ?? null,
      overdue: search.overdue ?? false,
    } satisfies Filter,
  };
}

export function uiToSearch(ui: ReturnType<typeof searchToUi>): Omit<BoardSearch, "task"> {
  const view =
    ui.nav === "my-issues" ? "mine" : ui.nav === "inbox" ? "inbox" : "board";
  return {
    view,
    tab: ui.tab,
    q: ui.search,
    priority: ui.filter.priority ?? undefined,
    assignee: ui.filter.assigneeId ?? undefined,
    overdue: ui.filter.overdue || undefined,
  };
}
