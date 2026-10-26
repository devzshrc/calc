import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HandleSSOCallback } from "@clerk/tanstack-react-start";
import Logo from "@/assets/logo.svg?react";
export const Route = createFileRoute("/sso-callback")({
  ssr: false,
  component: SsoCallback,
});
function SsoCallback() {
  const [error, setError] = useState(false);
  return (
    <main className="bg-sidebar flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <Logo role="img" aria-label="Kanban" className="size-10" />
      <p className="text-muted-foreground">
        {error
          ? "Google sign-in needs another verification step. Please try again."
          : "Finishing Google sign-in…"}
      </p>
      {error && (
        <a className="text-info underline" href="/sign-in">
          Return to sign in
        </a>
      )}
      <HandleSSOCallback
        navigateToApp={({ decorateUrl }) =>
          window.location.assign(decorateUrl("/today"))
        }
        navigateToSignIn={() => setError(true)}
        navigateToSignUp={() => setError(true)}
      />
      <div id="clerk-captcha" />
    </main>
  );
}
