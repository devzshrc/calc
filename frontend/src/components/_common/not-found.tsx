import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/_ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex flex-col gap-1.5">
        <h2>This board doesn&apos;t exist</h2>
        <p className="text-muted-foreground">
          It may have been deleted or the link is wrong.
        </p>
      </div>
      <Link to="/" className={buttonVariants({ variant: "primary", size: "md" })}>
        Go to your boards
      </Link>
    </div>
  );
}
