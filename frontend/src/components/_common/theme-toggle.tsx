import { useRef, useState } from "react";
import Button from "@/components/_ui/button";
import Menu from "@/components/_ui/menu";
import { useThemeStore, type Theme } from "@/lib/theme";
import SunIcon from "@/assets/icons/sun.svg?react";
import MoonIcon from "@/assets/icons/moon.svg?react";
import MonitorIcon from "@/assets/icons/monitor.svg?react";

export const THEMES: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/** Center of an element, used as the origin of the theme reveal. */
export function originOf(element: HTMLElement | null) {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function ThemeToggle() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <>
      <Button
        ref={ref}
        variant="secondary"
        size="icon"
        aria-label="Theme"
        aria-expanded={open}
        data-active={open}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Both icons render; CSS picks one so SSR never guesses the theme. */}
        <SunIcon aria-hidden className="size-3.5 dark:hidden" />
        <MoonIcon aria-hidden className="hidden size-3.5 dark:block" />
      </Button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        align="end"
        label="Theme"
        items={THEMES.map((item) => ({
          id: item.value,
          label: item.label,
          icon: <item.icon />,
          checked: theme === item.value,
          onSelect: () => setTheme(item.value, originOf(ref.current)),
        }))}
      />
    </>
  );
}
