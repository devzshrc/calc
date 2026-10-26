import { describe, expect, test } from "bun:test";
import { isQuiet } from "../backend/src/reminders";
import { taskInput, taskPatch } from "../backend/src/types";
import { scheduleInGaps } from "../frontend/src/lib/scheduling";

describe("scheduling contracts", () => {
  test("preserves omitted scheduling fields in patches", () => {
    expect(taskPatch.parse({ title: "Read" })).toEqual({ title: "Read" });
  });
  test("new tasks default to no block or reminder", () => {
    const t = taskInput.parse({ id: "a", title: "Read", columnId: "todo" });
    expect(t.scheduledStart).toBeNull();
    expect(t.reminderAt).toBeNull();
  });
  test("rejects timestamps without timezone", () => {
    expect(
      taskPatch.safeParse({ scheduledStart: "2030-01-01T09:00" }).success,
    ).toBe(false);
  });
  test("quiet hours cross midnight and allow the exact end", () => {
    expect(isQuiet("23:00", "22:00", "07:00")).toBe(true);
    expect(isQuiet("06:59", "22:00", "07:00")).toBe(true);
    expect(isQuiet("07:00", "22:00", "07:00")).toBe(false);
    expect(isQuiet("12:00", "22:00", "07:00")).toBe(false);
  });
  test("gap planner skips a meeting, respects estimates, and stops at 6pm", () => {
    const day = "2035-01-01";
    const iso = (hour: number) =>
      new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
    const tasks = [
      { id: "a", estimate: 60 },
      { id: "b", estimate: 120 },
      { id: "c", estimate: 600 },
    ] as any;
    const events = [{ start: iso(9), end: iso(10), busy: true }] as any;
    const result = scheduleInGaps(tasks, events, day);
    expect(result.map((r) => r.task.id)).toEqual(["a", "b"]);
    expect(result[0]!.start).toBe(iso(10));
    expect(result[1]!.end).toBe(iso(13));
  });
  test("all-day busy events leave no gaps", () => {
    expect(
      scheduleInGaps(
        [{ id: "a", estimate: 15 }] as any,
        [{ start: "2035-01-01", end: "2035-01-02", busy: true }] as any,
        "2035-01-01",
      ),
    ).toHaveLength(0);
  });
});
