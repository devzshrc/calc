import { motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

type SegmentedProps<T extends string> = {
  id: string;
  label: string;
  value: T;
  items: { id: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
};

// Same control as the board's Overview/Update/Tasks tabs.
export default function Segmented<T extends string>({
  id,
  label,
  value,
  items,
  onChange,
  className,
}: SegmentedProps<T>) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("bg-muted flex min-w-0 rounded-[10px]", className)}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Button
            key={item.id}
            role="tab"
            aria-selected={active}
            variant="ghost"
            size="md"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex-1 rounded-[10px] px-2 hover:bg-transparent",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-indicator`}
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
