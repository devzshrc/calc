import { useEffect, type ReactNode } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import appCss from "@/styles/app.css?url";
import { themeScript, useThemeStore } from "@/lib/theme";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kanban" },
      {
        name: "description",
        content: "A calm kanban board for life, goals and studies.",
      },
      { name: "color-scheme", content: "light dark" },
      { name: "theme-color", content: "#2575ff" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" afterSignOutUrl="/sign-in">
      {/* The theme class is set by the inline script before hydration. */}
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <HeadContent />
        </head>
        <body className="relative z-0 font-sans antialiased">
          {children}
          <ThemeSync />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}

function ThemeSync() {
  useEffect(() => useThemeStore.getState().hydrate(), []);
  return null;
}
