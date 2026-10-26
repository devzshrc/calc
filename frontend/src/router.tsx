import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import NotFound from "@/components/_common/not-found";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
    scrollRestoration: false,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
