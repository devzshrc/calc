import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/_ui/form/input";

export default function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        fieldClasses,
        "min-h-[88px] resize-y px-3 py-2.5 leading-[140%]",
        className,
      )}
      {...props}
    />
  );
}
