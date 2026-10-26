import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSignIn } from "@clerk/tanstack-react-start/legacy";
import { z } from "zod";
import Button from "@/components/_ui/button";
import ThemeToggle from "@/components/_common/theme-toggle";
import { getSession } from "@/server/session";
import Logo from "@/assets/logo.svg?react";

/** Only same-origin paths are allowed as post-sign-in destinations. */
const safePath = z
  .string()
  .regex(/^\/(?!\/)[^\s]*$/)
  .optional()
  .catch(undefined);

export const Route = createFileRoute("/sign-in")({
  ssr: true,
  validateSearch: z.object({ redirect: safePath }),
  beforeLoad: async ({ search }) => {
    const { userId } = await getSession();
    if (userId) throw redirect({ href: search.redirect ?? "/today" });
  },
  head: () => ({ meta: [{ title: "Sign in - Kanban" }] }),
  component: SignIn,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}

function SignIn() {
  const { redirect: destination } = Route.useSearch();
  const { signIn, isLoaded } = useSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueWithGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      if (!isLoaded || !signIn) {
        setPending(false);
        return;
      }
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: destination ?? "/today",
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn't start Google sign-in",
      );
      setPending(false);
    }
  };

  return (
    <main className="bg-sidebar relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {/* CSS, not Motion: it must animate on the server-rendered paint, before JS. */}
      <div className="animate-enter shadow-popover bg-card flex w-full max-w-[380px] flex-col rounded-2xl">
        <div className="border-border flex flex-col items-center gap-4 border-b px-6 pt-8 pb-6 text-center">
          <Logo role="img" aria-label="Kanban" className="size-10" />
          <div className="flex flex-col gap-1.5">
            <h1 className="lead-style">Welcome to Kanban</h1>
            <p className="text-muted-foreground">
              Your second brain for life, goals and studies.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <Button
            variant="secondary"
            size="lg"
            onClick={continueWithGoogle}
            disabled={pending || !isLoaded}
            className="text-foreground w-full gap-2"
          >
            <GoogleMark />
            {pending ? "Redirecting to Google…" : "Continue with Google"}
          </Button>
          {error && <p className="text-danger text-center">{error}</p>}
          {/* Clerk mounts its bot-protection challenge here when needed. */}
          <div id="clerk-captcha" />
        </div>
        <p className="text-subtle border-border border-t px-6 py-4 text-center text-[12px]">
          New here? Signing in creates your account with starter boards.
        </p>
      </div>
    </main>
  );
}
