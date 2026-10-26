
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import XCloseIcon from "@/assets/icons/x-close.svg?react";
import { EASE_OUT } from "@/lib/easings";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Skip open/close motion: for surfaces summoned by keyboard many times a day. */
  instant?: boolean;
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  instant = false,
}: DialogProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("overflow-hidden");
    const target =
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panelRef.current;
    target?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.classList.remove("overflow-hidden");
      previous?.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={instant ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
            onClick={onClose}
            className="bg-foreground/40 absolute inset-0"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={
              instant
                ? false
                : reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: "translateY(16px) scale(0.97)" }
            }
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={
              instant
                ? { opacity: 0, transition: { duration: 0 } }
                : reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: "translateY(8px) scale(0.97)" }
            }
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className={cn(
              "shadow-popover relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-card outline-none sm:max-w-[520px] sm:rounded-2xl",
              className,
            )}
          >
            <div className="border-border flex items-start gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
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
                className="-m-2"
              >
                <XCloseIcon className="size-3.5" aria-hidden />
              </Button>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
              {children}
            </div>
            {footer && (
              <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t p-4">
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
