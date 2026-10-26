import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral:
    "bg-subtle shadow-[0_1px_2px_0_rgb(9_9_11/0.08),0_0_0_0.5px_var(--subtle)]",
  info: "bg-info shadow-[0_1px_2px_0_rgb(9_9_11/0.08),0_0_0_0.5px_var(--info)]",
  success:
    "bg-success shadow-[0_1px_2px_0_rgb(9_9_11/0.08),0_0_0_0.5px_var(--success)]",
  warning:
    "bg-warning shadow-[0_1px_2px_0_rgb(9_9_11/0.08),0_0_0_0.5px_var(--warning)]",
  danger:
    "bg-danger shadow-[0_1px_2px_0_rgb(9_9_11/0.08),0_0_0_0.5px_var(--danger)]",
};

type StatusBadgeProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: BadgeTone;
  className?: string;
};

export default function StatusBadge({
  icon: Icon,
  tone,
  className,
}: StatusBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] text-white",
        tones[tone],
        className,
      )}
    >
      <Icon className="size-2" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_20px_0_rgb(255_255_255/0.16)]" />
    </span>
  );
}
