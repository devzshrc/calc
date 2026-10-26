
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import Button from "@/components/_ui/button";
import XCloseIcon from "@/assets/icons/x-close.svg?react";
import { EASE_DRAWER, EASE_OUT } from "@/lib/easings";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const DISMISS_OFFSET = 80;
const DISMISS_VELOCITY = 400;

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("overflow-hidden");
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.classList.remove("overflow-hidden");
      previous?.focus();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onClick={onClose}
            className="bg-foreground/40 absolute inset-0"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.4, ease: EASE_DRAWER }}
            drag={reduceMotion ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={onDragEnd}
            className={cn(
              "shadow-popover relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-card outline-none",
              className,
            )}
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex cursor-grab touch-none flex-col items-center pt-2 pb-1 active:cursor-grabbing"
            >
              <span aria-hidden className="bg-border h-1 w-9 rounded-full" />
            </div>
            <div className="flex items-start gap-3 px-4 pb-3">
              <div
                onPointerDown={(event) => dragControls.start(event)}
                className="min-w-0 flex-1 touch-none"
              >
                <h2 id={titleId} className="lead-style">
                  {title}
                </h2>
                {description && (
                  <p className="text-muted-foreground mt-1">{description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={onClose}
                className="-mt-1.5 -mr-2"
              >
                <XCloseIcon className="size-3.5" aria-hidden />
              </Button>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {children}
            </div>
            {footer && (
              <div className="border-border flex items-center gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
