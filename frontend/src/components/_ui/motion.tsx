import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/easings";

const STAGGER = 0.04;

/**
 * Content that arrives (AI results, new sections): rises 6px and fades in.
 * Pass `index` to stagger siblings 40ms apart. Reduced motion keeps the fade only.
 */
export function Reveal({
  index = 0,
  as = "div",
  className,
  children,
}: {
  index?: number;
  as?: "div" | "li" | "section";
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay: index * STAGGER }}
      className={className}
    >
      {children}
    </Component>
  );
}
