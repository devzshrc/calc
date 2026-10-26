import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { isDone, type Workspace } from "./workspace";

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function complete(messages: ChatMessage[], json: boolean) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new HTTPException(503, {
      message: "AI is off. Add DEEPSEEK_API_KEY to backend/.env",
    });
  }
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: json ? 0.2 : 0.5,
      max_tokens: 2000,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    console.error("DeepSeek error", response.status, await response.text());
    throw new HTTPException(502, { message: "The AI service failed. Try again." });
  }
  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message.content ?? "";
}

export async function chatText(messages: ChatMessage[]) {
  return (await complete(messages, false)).trim();
}

// JSON mode, then validated: model output is untrusted input.
export async function chatJson<T>(messages: ChatMessage[], schema: z.ZodType<T>) {
  const raw = await complete(messages, true);
  try {
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    console.error("Unparseable AI output", raw, error);
    throw new HTTPException(502, { message: "The AI answer was malformed. Try again." });
  }
}

// One compact line per task keeps prompts small and lets the model cite ids.
export function describeWorkspace(workspace: Workspace, options: { openOnly?: boolean } = {}) {
  const lines: string[] = [];
  for (const board of workspace.boards) {
    lines.push(`## Board "${board.title}" (id ${board.id})`);
    for (const task of workspace.tasks.filter((t) => t.boardId === board.id)) {
      const done = isDone(workspace, task);
      if (options.openOnly && done) continue;
      const column = board.columns.find((c) => c.id === task.columnId);
      const parts = [
        `[${task.id}] ${task.title}`,
        `status=${column?.name ?? task.columnId}`,
        `priority=${task.priority}`,
      ];
      if (task.dueDate) parts.push(`due=${task.dueDate}`);
      if (task.estimate) parts.push(`estimate=${task.estimate}m`);
      if (task.recurrence) parts.push(`repeats=${task.recurrence}`);
      if (task.completions.length) parts.push(`last_done=${task.completions.at(-1)}`);
      if (task.completedAt) parts.push(`completed=${task.completedAt.slice(0, 10)}`);
      if (task.snoozedUntil) parts.push(`snoozed_until=${task.snoozedUntil}`);
      if (task.subtasks.length) {
        parts.push(`subtasks=${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}`);
      }
      parts.push(`created=${task.createdAt.slice(0, 10)}`);
      if (task.description) parts.push(`notes="${task.description.slice(0, 160).replace(/\s+/g, " ")}"`);
      lines.push(`- ${parts.join(" | ")}`);
    }
  }
  return lines.join("\n");
}
