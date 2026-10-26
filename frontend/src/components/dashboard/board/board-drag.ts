export type DropData =
  | { type: "task"; taskId: string; columnId: string }
  | { type: "column"; columnId: string }
  | { type: "tail"; columnId: string }
  | { type: "slot" }
  | { type: "hidden"; columnId: string };

export type Placement = {
  columnId: string;
  index: number;
  beforeId: string | null;
  hidden: boolean;
};

let lastDragEndedAt = 0;

export function markDragEnd() {
  lastDragEndedAt = Date.now();
}

export function wasJustDragged() {
  return Date.now() - lastDragEndedAt < 250;
}
