import { useEffect, useRef } from "react";
import { MotionConfig, motion } from "motion/react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import Sidebar from "@/components/dashboard/sidebar/sidebar";
import Dialogs from "@/components/dashboard/dialogs/dialogs";
import Toaster from "@/components/_ui/toaster";
import { useReminders } from "@/hooks/use-reminders";
import { useUiStore } from "@/stores/ui-store";
import FocusTimer from "@/components/second-brain/focus-timer";
import { undoLatest, ProductivityRuntime } from "@/components/second-brain/productivity-runtime";
import { EASE_OUT } from "@/lib/easings";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export default function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onBoard = pathname.startsWith("/b/");
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);
  useReminders();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (ui.dialog?.type === "capture") ui.closeDialog();
        else ui.openDialog({ type: "capture" });
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !isTypingTarget(event.target)) { event.preventDefault(); void undoLatest(); return; }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (ui.dialog) return;
      if (event.key === "/" && onBoard) {
        event.preventDefault();
        document.getElementById("board-search")?.focus();
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        ui.openDialog({ type: "capture" });
      } else if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        ui.openDialog(onBoard ? { type: "new-task" } : { type: "capture" });
      } else if (event.key === "?") {
        event.preventDefault();
        ui.openDialog({ type: "help" });
      } else if (event.key === "[") {
        event.preventDefault();
        ui.toggleSidebarCollapsed(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBoard]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-background flex h-dvh w-full overflow-hidden">
        <Sidebar />
        <motion.div
          key={pathname}
          initial={firstPaint.current ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          className="flex min-w-0 flex-1 flex-col"
        >
          <Outlet />
        </motion.div>
        <Dialogs />
        <Toaster />
        <FocusTimer />
        <ProductivityRuntime />
      </div>
    </MotionConfig>
  );
}
