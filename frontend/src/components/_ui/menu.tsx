
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import Popover, { type PopoverProps } from "@/components/_ui/popover";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

export type MenuItem =
  | {
      id: string;
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      keepOpen?: boolean;
    }
  | { id: string; separator: true }
  | { id: string; heading: string };

type MenuProps = Omit<PopoverProps, "children" | "role"> & {
  items: MenuItem[];
};

export default function Menu({ items, onClose, open, ...popover }: MenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLElement>(
      "[role^=menuitem]:not([disabled])",
    );
    first?.focus({ preventScroll: true });
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(
        "[role^=menuitem]:not([disabled])",
      ) ?? [],
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      nodes[(next + nodes.length) % nodes.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    if (event.key === "ArrowUp") move(index - 1);
    if (event.key === "Home") move(0);
    if (event.key === "End") move(nodes.length - 1);
  };

  return (
    <Popover open={open} onClose={onClose} role="menu" {...popover}>
      <div ref={listRef} onKeyDown={onKeyDown} className="flex flex-col">
        {items.map((item) => {
          if ("separator" in item) {
            return <div key={item.id} className="bg-border my-1 h-px" />;
          }
          if ("heading" in item) {
            return (
              <span
                key={item.id}
                className="label-style text-muted-foreground px-2 pt-2 pb-1.5"
              >
                {item.heading}
              </span>
            );
          }
          return (
            <Button
              key={item.id}
              role={
                item.checked === undefined ? "menuitem" : "menuitemcheckbox"
              }
              variant={item.danger ? "danger" : "ghost"}
              size="md"
              disabled={item.disabled}
              aria-checked={
                item.checked === undefined ? undefined : item.checked
              }
              onClick={() => {
                item.onSelect();
                if (!item.keepOpen) onClose();
              }}
              className={cn(
                "text-foreground w-full justify-start gap-2 px-2",
                item.danger && "text-danger",
              )}
            >
              {item.icon && (
                <span className="text-muted-foreground flex size-3.5 shrink-0 items-center justify-center [&>svg]:size-3.5">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate text-left">{item.label}</span>
              {item.checked && (
                <span
                  aria-hidden
                  className="bg-foreground ml-2 size-1.5 shrink-0 rounded-full"
                />
              )}
            </Button>
          );
        })}
      </div>
    </Popover>
  );
}
