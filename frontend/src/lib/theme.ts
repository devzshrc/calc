import { create } from "@/lib/create-store";
import { EASE_OUT } from "@/lib/easings";

export type Theme = "light" | "dark" | "system";

const KEY = "kanban:theme";

/** Inlined in <head>: sets the class before first paint, so there's no flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(theme: Theme) {
  return theme === "dark" || (theme === "system" && prefersDark());
}

/** Swap the class with every CSS transition paused, so colors don't fade unevenly. */
function swap(dark: boolean) {
  const root = document.documentElement;
  root.dataset.instant = "true";
  root.classList.toggle("dark", dark);
  requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.instant));
}

/**
 * Applies a theme. With an origin point (the toggle), the new theme is
 * revealed as a circle growing from it; reduced motion or no View Transitions
 * support falls back to an instant swap.
 */
function apply(theme: Theme, origin?: { x: number; y: number }) {
  const dark = isDark(theme);
  if (document.documentElement.classList.contains("dark") === dark) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origin || reduce || !document.startViewTransition) return swap(dark);

  const transition = document.startViewTransition(() => swap(dark));
  transition.ready.then(() => {
    const { x, y } = origin;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 450,
        easing: `cubic-bezier(${EASE_OUT.join(",")})`,
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });
}

export const useThemeStore = create<{
  theme: Theme;
  hydrate: () => void;
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
}>()((set, get) => ({
  theme: "system",
  hydrate: () => {
    const stored = localStorage.getItem(KEY);
    const theme: Theme = stored === "light" || stored === "dark" ? stored : "system";
    set({ theme });
    // Follow the OS while on "system".
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => get().theme === "system" && apply("system"));
  },
  setTheme: (theme, origin) => {
    localStorage.setItem(KEY, theme);
    set({ theme });
    apply(theme, origin);
  },
}));
