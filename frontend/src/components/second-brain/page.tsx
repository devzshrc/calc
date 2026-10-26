import type { ComponentType, ReactNode, SVGProps } from "react";
import { motion } from "motion/react";
import { LAYOUT_SPRING } from "@/lib/easings";
import Button from "@/components/_ui/button";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import AlignLeftIcon from "@/assets/icons/align-left-01.svg?react";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg?react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Mirrors the board header: breadcrumb on the left, actions on the right. */
export function PageHeader({
  icon: Icon,
  title,
  actions,
}: {
  icon: Icon;
  title: string;
  actions?: ReactNode;
}) {
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  return (
    <header className="border-border flex items-center gap-2 border-b p-4">
      <Button
        variant="secondary"
        size="icon"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden"
      >
        <AlignLeftIcon className="size-3.5" aria-hidden />
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-muted-foreground hidden shrink-0 sm:inline">Kanban</span>
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground hidden size-3.5 shrink-0 sm:block"
        />
        <Icon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
        <h1 className="min-w-0 truncate">{title}</h1>
      </nav>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The toolbar row under the header (tabs on the left, controls on the right). */
export function PageToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
      {children}
    </div>
  );
}

export function PageBody({
  children,
  width = "max-w-[720px]",
}: {
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
      <div className={cn("mx-auto flex flex-col gap-4", width)}>{children}</div>
    </div>
  );
}

export function Section({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      layout="position"
      transition={{ layout: LAYOUT_SPRING }}
      className={cn(
        "shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4",
        className,
      )}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate">{title}</h2>
          {meta !== undefined && (
            <span className="text-subtle shrink-0 tabular-nums">{meta}</span>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children}
    </motion.section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-subtle">{children}</p>;
}

/** Same stat tile as the board Overview. */
export function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="shadow-card flex flex-col gap-3 rounded-2xl bg-card p-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums",
          tone,
        )}
      >
        {value}
      </span>
    </div>
  );
}
