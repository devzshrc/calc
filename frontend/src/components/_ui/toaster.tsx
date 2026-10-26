
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useUiStore } from "@/stores/ui-store";
import { EASE_OUT, LAYOUT_SPRING } from "@/lib/easings";

export default function Toaster() {
  const toasts = useUiStore((state) => state.toasts);
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: "translateY(12px) scale(0.97)" };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          // Outer element owns the stack reflow (layout), inner owns enter/exit,
          // so the two transforms never fight.
          <motion.div key={toast.id} layout="position" transition={{ layout: LAYOUT_SPRING }}>
            <motion.div
              initial={hidden}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              exit={hidden}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="bg-primary text-primary-foreground shadow-popover pointer-events-auto rounded-xl px-3.5 py-2.5 text-[14px] font-medium tracking-[-0.02em]"
            >
              {toast.title}
              {toast.action && <button className="ml-4 cursor-pointer underline underline-offset-4" onClick={() => { toast.action!.run(); useUiStore.getState().dismissToast(toast.id); }}>{toast.action.label}</button>}
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
