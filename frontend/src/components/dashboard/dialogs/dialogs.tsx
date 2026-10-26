
import TaskDialog from "@/components/dashboard/dialogs/task-dialog";
import CaptureDialog from "@/components/second-brain/capture-dialog";
import NewBoardDialog from "@/components/dashboard/dialogs/new-board-dialog";
import HelpDialog from "@/components/dashboard/dialogs/help-dialog";
import { useUiStore } from "@/stores/ui-store";

export default function Dialogs() {
  const dialog = useUiStore((state) => state.dialog);
  const session = useUiStore((state) => state.dialogSession);
  const taskId = dialog?.type === "task" ? dialog.taskId : null;
  const columnId =
    dialog?.type === "new-task" ? (dialog.columnId ?? null) : null;

  return (
    <>
      <TaskDialog
        key={`task-${session}`}
        open={dialog?.type === "task" || dialog?.type === "new-task"}
        taskId={taskId}
        columnId={columnId}
      />
      <CaptureDialog
        key={`capture-${session}`}
        open={dialog?.type === "capture"}
        initialMode={dialog?.type === "capture" ? dialog.mode : undefined}
      />
      <NewBoardDialog
        key={`board-${session}`}
        open={dialog?.type === "new-board"}
      />
      <HelpDialog open={dialog?.type === "help"} />
    </>
  );
}
