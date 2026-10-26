
import { useRef, useState } from "react";
import Button from "@/components/_ui/button";
import Menu, { type MenuItem } from "@/components/_ui/menu";
import { DISPLAY_OPTIONS, useUiStore } from "@/stores/ui-store";
import SettingsIcon from "@/assets/icons/settings-04.svg?react";

export default function ToolbarDisplay() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const display = useUiStore((state) => state.display);
  const setDisplay = useUiStore((state) => state.setDisplay);

  const items: MenuItem[] = [
    { id: "heading", heading: "Show on cards" },
    ...DISPLAY_OPTIONS.map<MenuItem>((option) => ({
      id: option.key,
      label: option.label,
      checked: display[option.key],
      keepOpen: true,
      onSelect: () => setDisplay({ [option.key]: !display[option.key] }),
    })),
  ];

  return (
    <>
      <Button
        ref={anchorRef}
        variant="secondary"
        size="icon"
        aria-label="Display options"
        aria-expanded={open}
        data-active={open}
        onClick={() => setOpen((value) => !value)}
        className="hidden sm:inline-flex"
      >
        <SettingsIcon className="size-3.5" aria-hidden />
      </Button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        align="end"
        label="Display options"
        items={items}
      />
    </>
  );
}
