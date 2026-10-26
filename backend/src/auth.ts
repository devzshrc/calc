import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { clerkMiddleware, getAuth } from "@clerk/hono";
import { ensureUser } from "./users";

export type AuthEnv = { Variables: { userId: string } };

const authorizedParties = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const verify = clerkMiddleware({ authorizedParties });

// Verifies the Clerk session token (Authorization: Bearer) on every request.
export const clerk = createMiddleware(async (c, next) => {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new HTTPException(503, { message: "Auth isn't configured. Set CLERK_SECRET_KEY in backend/.env" });
  }
  return verify(c, next);
});

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) throw new HTTPException(401, { message: "Sign in required" });
  await ensureUser(auth.userId);
  c.set("userId", auth.userId);
  await next();
});
