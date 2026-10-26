import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import Button from "@/components/_ui/button";
import { Reveal } from "@/components/_ui/motion";
import Dialog from "@/components/_ui/dialog";
import Segmented from "@/components/_ui/segmented";
import { Field, Input, Select, Textarea } from "@/components/_ui/form";
import MetaChips from "@/components/second-brain/meta-chips";
import { COLUMN_META } from "@/components/_common/column-meta";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { aiCapture, type CapturedTask } from "@/server/ai";
import { CURRENT_USER_ID, newTask, type WorkspaceBoard } from "@/lib/kanban";
import { parseCapture } from "@/lib/parse";
import { firstColumn } from "@/lib/recurrence";
import { todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import StarsIcon from "@/assets/icons/stars.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";

type Mode = "quick" | "dump";

const HINTS = ["#board", "!urgent", "tomorrow", "fri", "~30m", "every day"];

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function openColumn(board: WorkspaceBoard) {
  return firstColumn(board.columns, "todo") ?? board.columns.find((c) => !c.hidden) ?? board.columns[0];
}

export default function CaptureDialog({
  open,
  initialMode = "quick",
}: {
  open: boolean;
  initialMode?: Mode;
}) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const toast = useUiStore((state) => state.toast);
  const boards = useWorkspaceStore((state) => state.boards);
  const tasks = useWorkspaceStore((state) => state.tasks);
  const addTasks = useWorkspaceStore((state) => state.addTasks);
  const currentBoard = useKanbanStore((state) => state.id);
  const navigate = useNavigate();
  const fallbackBoard =
    boards.find((b) => b.id === currentBoard) ??
    boards.find((b) => b.favorite) ??
    boards[0];

  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState(() => { if (typeof window === "undefined") return ""; const value = sessionStorage.getItem("kanban:share") ?? ""; sessionStorage.removeItem("kanban:share"); return value; });
  const [boardOverride, setBoardOverride] = useState<string | null>(null);
  const [dump, setDump] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<(CapturedTask & { keep: boolean })[] | null>(null);

  const parsed = useMemo(() => parseCapture(text, boards), [text, boards]);
  const target =
    boards.find((b) => b.id === (boardOverride ?? parsed.boardId)) ?? fallbackBoard;

  const matches = useMemo(() => {
    const query = parsed.title.trim().toLowerCase();
    if (query.length < 3) return [];
    return tasks.filter((task) => task.title.toLowerCase().includes(query)).slice(0, 4);
  }, [parsed.title, tasks]);

  const createQuick = (event?: FormEvent) => {
    event?.preventDefault();
    if (!parsed.title || !target) return;
    const column = openColumn(target);
    if (!column) return;
    addTasks([
      {
        ...newTask({
          title: parsed.title,
          columnId: column.id,
          priority: parsed.priority ?? "normal",
          dueDate: parsed.dueDate,
          estimate: parsed.estimate,
          recurrence: parsed.recurrence,
          assigneeIds: [CURRENT_USER_ID],
        }),
        boardId: target.id,
      },
    ]);
    toast(`Added to ${target.title}`);
    setText("");
    setBoardOverride(null);
  };

  const organize = async () => {
    if (!dump.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await aiCapture({
        data: { text: dump, today: todayKey(), boardId: fallbackBoard?.id },
      });
      setDrafts(result.tasks.map((task) => ({ ...task, keep: true })));
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't organize that"));
    } finally {
      setPending(false);
    }
  };

  // Without AI, each non-empty line becomes a task on the default board.
  const splitLines = () => {
    setDrafts(
      dump
        .split("\n")
        .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter(Boolean)
        .map((line) => {
          const p = parseCapture(line, boards);
          return {
            title: p.title,
            boardId: p.boardId ?? fallbackBoard?.id ?? "",
            priority: p.priority ?? "normal",
            dueDate: p.dueDate,
            estimate: p.estimate,
            recurrence: p.recurrence,
            description: "",
            keep: true,
          };
        }),
    );
  };

  const kept = drafts?.filter((draft) => draft.keep) ?? [];

  const addDrafts = () => {
    const created = kept.flatMap((draft) => {
      const board = boards.find((b) => b.id === draft.boardId) ?? fallbackBoard;
      const column = board && openColumn(board);
      if (!board || !column) return [];
      return [
        {
          ...newTask({
            title: draft.title,
            description: draft.description,
            columnId: column.id,
            priority: draft.priority,
            dueDate: draft.dueDate,
            estimate: draft.estimate,
            recurrence: draft.recurrence,
            assigneeIds: [CURRENT_USER_ID],
          }),
          boardId: board.id,
        },
      ];
    });
    addTasks(created);
    toast(`Added ${created.length} task${created.length === 1 ? "" : "s"}`);
    closeDialog();
  };

  const footer =
    mode === "quick" ? (
      <>
        <span className="text-subtle mr-auto hidden sm:inline">
          Press Enter to add, keep typing for the next
        </span>
        <Button variant="secondary" size="md" onClick={closeDialog}>
          Done
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => createQuick()}
          disabled={!parsed.title || !target}
        >
          Add task
        </Button>
      </>
    ) : drafts ? (
      <>
        <Button variant="secondary" size="md" onClick={() => setDrafts(null)} className="mr-auto">
          Back
        </Button>
        <Button variant="secondary" size="md" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={addDrafts} disabled={kept.length === 0}>
          Add {kept.length} task{kept.length === 1 ? "" : "s"}
        </Button>
      </>
    ) : (
      <>
        <Button
          variant="secondary"
          size="md"
          onClick={splitLines}
          disabled={!dump.trim() || pending}
          className="mr-auto"
        >
          One per line
        </Button>
        <Button variant="secondary" size="md" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={organize} disabled={!dump.trim() || pending}>
          <StarsIcon aria-hidden className="size-3.5" />
          {pending ? "Organizing…" : "Organize with AI"}
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title="Capture"
      description={
        mode === "quick"
          ? "Type it the way you'd say it."
          : "Empty your head. AI sorts it into tasks across your boards."
      }
      footer={footer}
      className="sm:max-w-[600px]"
      instant
    >
      <div className="flex flex-col gap-4">
        <Segmented
          id="capture-mode"
          label="Capture mode"
          value={mode}
          onChange={setMode}
          items={[
            { id: "quick", label: "Quick" },
            { id: "dump", label: "Brain dump" },
          ]}
          className="self-start"
        />

        {mode === "quick" && (
          <form onSubmit={createQuick} className="flex flex-col gap-4">
            <Input
              data-autofocus
              aria-label="Task"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Call grandma tomorrow #life !urgent ~15m"
              className="h-10 text-[15px]"
            />
            <div className="flex min-h-[30px] flex-wrap items-center gap-2">
              {text.trim() ? (
                <MetaChips
                  board={target}
                  priority={parsed.priority}
                  dueDate={parsed.dueDate}
                  estimate={parsed.estimate}
                  recurrence={parsed.recurrence}
                  size="md"
                />
              ) : (
                HINTS.map((hint) => (
                  <kbd
                    key={hint}
                    className="bg-secondary text-muted-foreground shadow-ring inline-flex h-6 items-center rounded-md px-1.5 font-mono text-[12px]"
                  >
                    {hint}
                  </kbd>
                ))
              )}
            </div>
            <Field label="Board" htmlFor="capture-board">
              <Select
                id="capture-board"
                value={target?.id ?? ""}
                onChange={(event) => setBoardOverride(event.target.value)}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </Select>
            </Field>
            {matches.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-[13px]">Already on your boards</span>
                <div className="divide-border flex flex-col divide-y">
                  {matches.map((task) => {
                    const board = boards.find((b) => b.id === task.boardId);
                    const kind = board?.columns.find((c) => c.id === task.columnId)?.kind ?? "todo";
                    const meta = COLUMN_META[kind];
                    return (
                      <Button
                        key={task.id}
                        variant="ghost"
                        size="md"
                        onClick={() => {
                          closeDialog();
                          navigate({
                            to: "/b/$boardId",
                            params: { boardId: task.boardId },
                            search: { task: task.id },
                          });
                        }}
                        className="text-foreground -mx-2 h-auto justify-start motion-safe:active:scale-100 gap-3 rounded-lg px-2 py-2"
                      >
                        <meta.icon aria-hidden className={cn("size-3.5 shrink-0", meta.color)} />
                        <span className="min-w-0 flex-1 truncate text-left">{task.title}</span>
                        <span className="text-subtle shrink-0">{board?.title}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        )}

        {mode === "dump" && !drafts && (
          <>
            <Textarea
              data-autofocus
              aria-label="Brain dump"
              value={dump}
              onChange={(event) => setDump(event.target.value)}
              placeholder={
                "need to renew passport before the trip, also call mom on sunday\nfinish the stats assignment by thursday, it's big\nstart running again 3x a week"
              }
              className="min-h-[200px]"
            />
            {error && <p className="text-danger">{error}</p>}
          </>
        )}

        {mode === "dump" && drafts && (
          <div className="flex flex-col gap-2">
            {drafts.length === 0 && <p className="text-subtle">Nothing actionable found.</p>}
            {drafts.map((draft, index) => (
              <Reveal
                index={index}
                key={index}
                className={cn(
                  "shadow-card flex flex-col gap-3 rounded-2xl bg-card p-3 transition-opacity duration-150",
                  !draft.keep && "opacity-50",
                )}
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Title"
                    value={draft.title}
                    onChange={(event) =>
                      setDrafts((all) =>
                        all!.map((d, i) => (i === index ? { ...d, title: event.target.value } : d)),
                      )
                    }
                    className="h-[30px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={draft.keep ? "Skip this task" : "Keep this task"}
                    aria-pressed={!draft.keep}
                    onClick={() =>
                      setDrafts((all) =>
                        all!.map((d, i) => (i === index ? { ...d, keep: !d.keep } : d)),
                      )
                    }
                  >
                    <XCloseIcon aria-hidden className="size-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Board"
                    value={draft.boardId}
                    onChange={(event) =>
                      setDrafts((all) =>
                        all!.map((d, i) => (i === index ? { ...d, boardId: event.target.value } : d)),
                      )
                    }
                    className="h-[30px] w-auto"
                  >
                    {boards.map((board) => (
                      <option key={board.id} value={board.id}>
                        {board.title}
                      </option>
                    ))}
                  </Select>
                  <MetaChips
                    priority={draft.priority}
                    dueDate={draft.dueDate}
                    estimate={draft.estimate}
                    recurrence={draft.recurrence}
                    size="md"
                  />
                </div>
                {draft.description && (
                  <p className="text-muted-foreground line-clamp-2">{draft.description}</p>
                )}
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
