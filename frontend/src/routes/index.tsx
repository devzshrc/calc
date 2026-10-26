import { createFileRoute, redirect } from "@tanstack/react-router";

// Today is home: it's the one page that spans every board.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/today" });
  },
});
