import { createMiddleware, createStart } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

// Isolates client-store state per request during SSR.
const storeScope = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const { storeScope } = await import("./server/store-scope.server");
  return storeScope.run(new Map(), () => next());
});

// Without Clerk keys every request would 500; explain the fix instead.
const requireClerkKeys = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const missing = [
    !(process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY) &&
      "VITE_CLERK_PUBLISHABLE_KEY",
    !process.env.CLERK_SECRET_KEY && "CLERK_SECRET_KEY",
  ].filter(Boolean);
  if (missing.length === 0) return next();
  const { setupPage } = await import("./server/setup-page.server");
  return new Response(setupPage(missing as string[]), {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  }) as never;
});

// Clerk reads the session cookie on every request so server functions and
// loaders can call auth().
export const startInstance = createStart(() => ({
  requestMiddleware: [requireClerkKeys, storeScope, clerkMiddleware()],
}));
