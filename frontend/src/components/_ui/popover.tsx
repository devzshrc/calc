
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/easings";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "start" | "end";
  role?: string;
  label?: string;
  className?: string;
  children: ReactNode;
};

const GAP = 6;
const MARGIN = 8;

export default function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  role = "dialog",
  label,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const rawLeft = align === "end" ? rect.right - width : rect.left;
      const left = Math.min(
        Math.max(MARGIN, rawLeft),
        Math.max(MARGIN, window.innerWidth - width - MARGIN),
      );
      const fitsBelow =
        rect.bottom + GAP + height <= window.innerHeight - MARGIN;
      const fitsAbove = rect.top - GAP - height >= MARGIN;
      const below = fitsBelow || !fitsAbove;
      const top = below
        ? Math.min(rect.bottom + GAP, window.innerHeight - height - MARGIN)
        : rect.top - GAP - height;
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.transformOrigin = `${align === "end" ? "right" : "left"} ${below ? "top" : "bottom"}`;
      panel.dataset.positioned = "true";
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role={role}
          aria-label={label}
          tabIndex={-1}
          initial={
            reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96)" }
          }
          animate={{ opacity: 1, transform: "scale(1)" }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : { opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12, ease: EASE_OUT } }
          }
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className={cn(
            "bg-popover text-popover-foreground shadow-popover invisible fixed top-0 left-0 z-50 min-w-[180px] rounded-xl p-1 outline-none data-[positioned=true]:visible",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
