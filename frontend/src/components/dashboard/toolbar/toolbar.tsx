
import Button from "@/components/_ui/button";
import ToolbarTabs from "@/components/dashboard/toolbar/toolbar-tabs";
import ToolbarSearch from "@/components/dashboard/toolbar/toolbar-search";
import ToolbarFilter from "@/components/dashboard/toolbar/toolbar-filter";
import ToolbarDisplay from "@/components/dashboard/toolbar/toolbar-display";
import { useUiStore } from "@/stores/ui-store";
import { useMobileBreakpoints } from "@/hooks/use-mobile-breakpoints";
import PlusIcon from "@/assets/icons/plus.svg?react";
import PanelIcon from "@/assets/icons/flex-align-right.svg?react";

export default function Toolbar() {
  const openDialog = useUiStore((state) => state.openDialog);
  const panelOpen = useUiStore((state) => state.panelOpen);
  const togglePanel = useUiStore((state) => state.togglePanel);
  const panelSheetOpen = useUiStore((state) => state.panelSheetOpen);
  const setPanelSheetOpen = useUiStore((state) => state.setPanelSheetOpen);
  const tab = useUiStore((state) => state.tab);
  const { belowLg } = useMobileBreakpoints();
  const panelActive = belowLg ? panelSheetOpen : panelOpen;

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <ToolbarTabs />
        <Button
          variant="secondary"
          size="icon"
          aria-label="New task"
          title="New task (N)"
          onClick={() => openDialog({ type: "new-task" })}
        >
          <PlusIcon className="size-3.5" aria-hidden />
        </Button>
      </div>
      {tab === "issues" && (
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <ToolbarSearch />
          <ToolbarFilter />
          <ToolbarDisplay />
          <Button
            variant="secondary"
            size="icon"
            aria-label={
              panelActive
                ? "Hide hidden columns panel"
                : "Show hidden columns panel"
            }
            aria-pressed={panelActive}
            data-active={panelActive}
            onClick={() =>
              belowLg ? setPanelSheetOpen(!panelSheetOpen) : togglePanel()
            }
          >
            <PanelIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
