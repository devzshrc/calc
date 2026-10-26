
import { useEffect } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import SidebarContent from "@/components/dashboard/sidebar/sidebar-content";
import { useUiStore } from "@/stores/ui-store";
import { EASE_DRAWER, EASE_OUT } from "@/lib/easings";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const instant = useUiStore((state) => state.sidebarInstant);

  // Hold the no-transition state for just the frame that applies the change.
  useEffect(() => {
    if (!instant) return;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => useUiStore.setState({ sidebarInstant: false })),
    );
    return () => cancelAnimationFrame(frame);
  }, [instant]);

  return (
    <>
      <aside
        data-instant={instant}
        className={cn(
          "border-border bg-sidebar ease-in-out hidden h-full shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-[260px]",
        )}
      >
        <LayoutGroup id="sidebar-desktop">
          <SidebarContent
            collapsed={collapsed}
            onToggle={() => toggleCollapsed()}
            toggleLabel={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          />
        </LayoutGroup>
      </aside>
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setSidebarOpen(false)}
              className="bg-foreground/40 absolute inset-0"
            />
            <motion.aside
              initial={{ transform: "translateX(-100%)" }}
              animate={{ transform: "translateX(0%)" }}
              exit={{ transform: "translateX(-100%)" }}
              transition={{ duration: 0.4, ease: EASE_DRAWER }}
              className="bg-sidebar shadow-popover absolute inset-y-0 left-0 flex w-[260px] flex-col"
            >
              <LayoutGroup id="sidebar-mobile">
                <SidebarContent
                  collapsed={false}
                  onToggle={() => setSidebarOpen(false)}
                  toggleLabel="Close menu"
                />
              </LayoutGroup>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
