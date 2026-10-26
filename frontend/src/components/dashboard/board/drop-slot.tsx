
import { useDroppable } from "@dnd-kit/core";
import { motion } from "motion/react";
import TaskCardView, {
  type TaskCardViewProps,
} from "@/components/dashboard/board/task-card-view";

type DropSlotProps = Pick<
  TaskCardViewProps,
  "task" | "column" | "members" | "teamName" | "display"
>;

export default function DropSlot(props: DropSlotProps) {
  const { setNodeRef } = useDroppable({
    id: "drop-slot",
    data: { type: "slot" },
  });

  return (
    <motion.div
      ref={setNodeRef}
      aria-hidden
      layout="position"
      transition={{ layout: { type: "spring", duration: 0.3, bounce: 0 } }}
      className="border-border bg-secondary rounded-2xl border border-dashed"
    >
      <TaskCardView {...props} invisible />
    </motion.div>
  );
}
