import { DurableObject } from "cloudflare:workers";
import { app } from "./app";
import { connect } from "./db";
import { tick } from "./worker";

type Env = {
  KANBAN_API: DurableObjectNamespace<KanbanApi>;
  MONGODB_URI?: string;
};

// Keep MongoDB sockets in one Durable Object so requests can reuse connections.
// The Bun entry point keeps its timer; Cloudflare invokes maintenance using Cron.
export class KanbanApi extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (!this.env.MONGODB_URI)
      return Response.json(
        { error: "Database configuration is required" },
        { status: 503 },
      );
    try {
      await connect();
      const response = await app.fetch(request, this.env);
      response.headers.set("x-kanban-runtime", "cloudflare-v2");
      return response;
    } catch (error) {
      console.error(
        "Database request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return Response.json(
        { error: "Database temporarily unavailable" },
        { status: 503 },
      );
    }
  }
  async runMaintenance() {
    if (!this.env.MONGODB_URI) return;
    await connect();
    await tick();
  }
}
function stub(env: Env) {
  return env.KANBAN_API.get(env.KANBAN_API.idFromName("kanban-mumbai-v2"), {
    locationHint: "apac",
  });
}
export default {
  fetch(request, env) {
    return stub(env).fetch(request);
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(stub(env).runMaintenance());
  },
} satisfies ExportedHandler<Env>;
