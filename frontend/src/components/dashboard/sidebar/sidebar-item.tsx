
import type { ComponentType, ReactNode, SVGProps } from "react";
import { motion } from "motion/react";
import { LAYOUT_SPRING } from "@/lib/easings";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

type SidebarItemProps = {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** Join the shared sliding highlight (navigation items only). */
  indicator?: boolean;
};

export const sidebarFade =
  "transition-opacity duration-150 ease-out data-[collapsed=true]:opacity-0 data-[collapsed=false]:delay-100";

export default function SidebarItem({
  icon: Icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  leading,
  trailing,
  className,
  indicator = true,
}: SidebarItemProps) {
  return (
    <Button
      variant="ghost"
      size="md"
      data-active={active}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "group/item relative isolate w-full justify-start gap-1.5 px-2",
        indicator && "data-[active=true]:bg-transparent",
        className,
      )}
    >
      {active && indicator && (
        <motion.span
          layoutId="sidebar-active"
          aria-hidden
          transition={LAYOUT_SPRING}
          className="bg-foreground/[0.05] absolute inset-0 -z-10 rounded-lg"
        />
      )}
      {leading ??
        (Icon && (
          <Icon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 transition-colors duration-150",
              active
                ? "text-foreground"
                : "text-icon group-hover/item:text-muted-foreground",
            )}
          />
        ))}
      <span
        data-collapsed={collapsed}
        className={cn(
          "min-w-0 flex-1 overflow-hidden px-0.5 text-left whitespace-nowrap",
          sidebarFade,
        )}
      >
        {label}
      </span>
      {trailing && (
        <span
          data-collapsed={collapsed}
          className={cn("flex shrink-0 items-center", sidebarFade)}
        >
          {trailing}
        </span>
      )}
    </Button>
  );
}
