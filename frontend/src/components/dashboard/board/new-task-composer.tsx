
import { useState, type FormEvent, type KeyboardEvent } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/form";
import { useKanbanStore } from "@/stores/kanban-store";

type NewTaskComposerProps = { columnId: string; onClose: () => void };

export default function NewTaskComposer({
  columnId,
  onClose,
}: NewTaskComposerProps) {
  const addTask = useKanbanStore((state) => state.addTask);
  const [title, setTitle] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    addTask({ title, columnId });
    setTitle("");
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <form
      onSubmit={submit}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      className="shadow-card-lift flex flex-col gap-2 rounded-2xl bg-card p-3"
    >
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Task title"
        aria-label="Task title"
        className="h-[30px] px-1 shadow-none focus:shadow-none"
      />
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          disabled={!title.trim()}
        >
          Add task
        </Button>
      </div>
    </form>
  );
}
