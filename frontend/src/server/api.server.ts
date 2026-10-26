import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";

// Server-only: the Hono API URL and session tokens never reach the browser bundle.
const API_URL = process.env.API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = void>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  // Forward the caller's Clerk session to Hono, which verifies it independently.
  const { userId, getToken } = await auth();
  const token = userId ? await getToken() : null;
  if (!token) throw redirect({ to: "/sign-in" });
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (init?.body) headers["content-type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (response.status === 401) throw redirect({ to: "/sign-in" });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const message =
      typeof data?.error === "string" ? data.error : response.statusText;
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
