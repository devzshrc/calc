import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export default function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-muted-foreground text-[13px] font-medium tracking-[-0.01em]"
      >
        {label}
      </label>
      {children}
      {hint && <span className="text-subtle text-[12px]">{hint}</span>}
    </div>
  );
}
