
import { motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import { useUiStore, type Tab } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "updates", label: "Update" },
  { id: "issues", label: "Tasks" },
];

export default function ToolbarTabs() {
  const tab = useUiStore((state) => state.tab);
  const setTab = useUiStore((state) => state.setTab);
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Views"
      className="bg-muted flex min-w-0 flex-1 rounded-[10px] sm:flex-none"
    >
      {tabs.map((item) => {
        const active = item.id === tab;
        return (
          <Button
            key={item.id}
            role="tab"
            aria-selected={active}
            variant="ghost"
            size="md"
            onClick={() => setTab(item.id)}
            className={cn(
              "relative flex-1 rounded-[10px] px-2 hover:bg-transparent sm:flex-none",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="toolbar-tab-indicator"
                aria-hidden
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", duration: 0.3, bounce: 0 }
                }
                className="shadow-ring absolute inset-0 rounded-[10px] bg-card"
              />
            )}
            <span className="relative">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
