import { collections } from "./db";
import { syncConnection } from "./google";
import { deliverReminders } from "./reminders";
let running = false;
export async function tick() {
  if (running) return;
  running = true;
  try {
    for (const c of await collections()
      .connections.find({ service: { $ne: "gmail" } })
      .toArray())
      await syncConnection(c._id);
    await deliverReminders();
  } catch (error) {
    console.error(
      "Background worker failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    running = false;
  }
}
export function startWorker() {
  void tick();
  setInterval(() => void tick(), 30_000);
}
