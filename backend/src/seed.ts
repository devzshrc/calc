import { collections } from "./db";
import type { BoardDoc, Column, TaskDoc } from "./types";

export const DEFAULT_COLUMNS: Column[] = [
  { id: "todo", name: "To do", kind: "todo", hidden: false },
  { id: "in-progress", name: "In progress", kind: "in-progress", hidden: false },
  { id: "done", name: "Done", kind: "done", hidden: false },
  { id: "backlog", name: "Backlog", kind: "backlog", hidden: true },
  { id: "canceled", name: "Canceled", kind: "canceled", hidden: true },
  { id: "duplicated", name: "Duplicated", kind: "duplicated", hidden: true },
];

export const ME = { id: "me", name: "Me" };

function dayKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

type SeedTask = [string, string, TaskDoc["priority"], number | null, string?];

const SEED: { id: string; title: string; tasks: SeedTask[] }[] = [
  {
    id: "life",
    title: "Life",
    tasks: [
      ["Renew passport", "todo", "urgent", 12, "Book the appointment and gather photos."],
      ["Plan weekend trip", "todo", "low", 9],
      ["Deep clean apartment", "in-progress", "normal", 1],
      ["Call grandma", "in-progress", "urgent", 0],
      ["Set up monthly budget", "done", "normal", -2],
      ["Try a new recipe every week", "backlog", "low", null],
    ],
  },
  {
    id: "goals",
    title: "Goals",
    tasks: [
      ["Run a half marathon", "todo", "normal", 90, "Follow a 12-week plan, 4 runs a week."],
      ["Read 24 books this year", "in-progress", "normal", 60],
      ["Save an emergency fund", "in-progress", "urgent", 120],
      ["Meditate 10 minutes daily", "todo", "low", 0],
      ["Learn to play guitar", "backlog", "low", null],
    ],
  },
  {
    id: "studies",
    title: "Studies",
    tasks: [
      ["Finish linear algebra problem set", "todo", "urgent", 2],
      ["Revise data structures notes", "todo", "normal", 5],
      ["Write literature review draft", "in-progress", "urgent", -1],
      ["Watch distributed systems lecture 4", "in-progress", "normal", 3],
      ["Submit lab report", "done", "normal", -3],
    ],
  },
];

/** Starter boards for a brand-new account. Ids are random so users never collide. */
export async function seedFor(userId: string) {
  const { boards, tasks, activity } = collections();
  const now = new Date();
  const ids = new Map(SEED.map((board) => [board.id, crypto.randomUUID()]));
  const boardDocs: BoardDoc[] = SEED.map((board, position) => ({
    _id: ids.get(board.id)!,
    userId,
    title: board.title,
    favorite: position === 0,
    teamName: "Personal",
    githubConnected: false,
    members: [ME],
    columns: DEFAULT_COLUMNS,
    position,
    createdAt: now,
  }));
  const taskDocs: TaskDoc[] = SEED.flatMap((board) =>
    board.tasks.map(([title, columnId, priority, due, description], position) => ({
      _id: crypto.randomUUID(),
      userId,
      boardId: ids.get(board.id)!,
      title,
      description: description ?? "",
      columnId,
      priority,
      assigneeIds: [ME.id],
      createdAt: new Date(now.getTime() - (position + 1) * 86_400_000),
      dueDate: due === null ? null : dayKey(due),
      recurrence: /daily/i.test(title) ? "daily" : null,
      completions: [],
      estimate: null,
      subtasks: [],
      goalId: null,
      snoozedUntil: null,
      focusOn: null,
      completedAt: null,
      position,
    })),
  );
  await boards.insertMany(boardDocs);
  await tasks.insertMany(taskDocs);
  await activity.insertMany(
    boardDocs.map((board) => ({
      _id: crypto.randomUUID(),
      userId,
      boardId: board._id,
      text: `You created the ${board.title} board`,
      at: now,
    })),
  );
}
