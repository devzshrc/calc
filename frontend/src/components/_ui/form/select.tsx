import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/_ui/form/input";

export default function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldClasses,
        "select-chevron h-[34px] cursor-pointer appearance-none pr-8 pl-3",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
