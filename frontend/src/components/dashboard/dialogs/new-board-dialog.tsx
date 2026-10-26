import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import Button from "@/components/_ui/button";
import Dialog from "@/components/_ui/dialog";
import { Field, Input } from "@/components/_ui/form";
import { createBoard } from "@/server/boards";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";

export default function NewBoardDialog({ open }: { open: boolean }) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      const board = await createBoard({ data: { title } });
      const { boards, setBoards } = useKanbanStore.getState();
      setBoards([...boards, board]);
      closeDialog();
      toast(`${board.title} created`);
      navigate({ to: "/b/$boardId", params: { boardId: board.id } });
    } catch {
      toast("Couldn't create the board");
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title="New board"
      description="Give a part of your life its own board."
      footer={
        <>
          <Button variant="secondary" size="md" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => submit()}
            disabled={!title.trim() || pending}
          >
            Create board
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="Name" htmlFor="board-title">
          <Input
            id="board-title"
            data-autofocus
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fitness, Reading, Side project…"
          />
        </Field>
      </form>
    </Dialog>
  );
}
