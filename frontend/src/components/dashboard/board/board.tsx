
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import BoardColumn from "@/components/dashboard/board/board-column";
import HiddenColumns from "@/components/dashboard/board/hidden-columns";
import TaskCardView from "@/components/dashboard/board/task-card-view";
import { taskMatches } from "@/components/dashboard/board/board-filters";
import {
  markDragEnd,
  type DropData,
  type Placement,
} from "@/components/dashboard/board/board-drag";
import Button from "@/components/_ui/button";
import { useKanbanStore } from "@/stores/kanban-store";
import { isFilterActive, useUiStore } from "@/stores/ui-store";
import { useMobileBreakpoints } from "@/hooks/use-mobile-breakpoints";
import type { Task } from "@/lib/kanban";
import { EASE_DRAWER, EASE_OUT, ease } from "@/lib/easings";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

type Point = { x: number; y: number };
type EdgeDirection = -1 | 0 | 1;

const EDGE_DWELL = 220;
const EDGE_ZONE_MAX = 64;
const EDGE_ZONE_RATIO = 0.16;
const LOCK_RADIUS = 28;
const REALIGN_DURATION = 400;

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) {
    const preferred = within.find((collision) => {
      const type = (
        collision.data?.droppableContainer?.data?.current as
          | DropData
          | undefined
      )?.type;
      return type !== "column";
    });
    return [preferred ?? within[0]];
  }
  return rectIntersection(args);
};

function eventPoint(event: Event | null): Point | null {
  if (!event) return null;
  if ("touches" in event) {
    const touch = event as TouchEvent;
    const point = touch.touches[0] ?? touch.changedTouches[0];
    return point ? { x: point.clientX, y: point.clientY } : null;
  }
  if ("clientX" in event) {
    const mouse = event as MouseEvent;
    return { x: mouse.clientX, y: mouse.clientY };
  }
  return null;
}

export default function Board({ mine = false }: { mine?: boolean }) {
  const columns = useKanbanStore((state) => state.columns);
  const tasks = useKanbanStore((state) => state.tasks);
  const members = useKanbanStore((state) => state.members);
  const teamName = useKanbanStore((state) => state.teamName);
  const moveTask = useKanbanStore((state) => state.moveTask);
  const search = useUiStore((state) => state.search);
  const filter = useUiStore((state) => state.filter);
  const clearFilter = useUiStore((state) => state.clearFilter);
  const setSearch = useUiStore((state) => state.setSearch);
  const display = useUiStore((state) => state.display);
  const panelOpen = useUiStore((state) => state.panelOpen);
  const panelSheetOpen = useUiStore((state) => state.panelSheetOpen);
  const setPanelSheetOpen = useUiStore((state) => state.setPanelSheetOpen);
  const toast = useUiStore((state) => state.toast);
  const { belowLg } = useMobileBreakpoints();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [settledId, setSettledId] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(0);
  const [edgeDir, setEdgeDir] = useState<EdgeDirection>(0);
  const [snapping, setSnapping] = useState(true);
  const placementRef = useRef<Placement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<Point | null>(null);
  const edgeRef = useRef<{ dir: EdgeDirection; timer: number | null }>({
    dir: 0,
    timer: null,
  });
  const lockRef = useRef<{ columnId: string; at: Point } | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const mounted = useMounted();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    const onTouchMove = (event: TouchEvent) => {
      const point = eventPoint(event);
      if (point) pointerRef.current = point;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    document.body.classList.add("cursor-grabbing", "select-none");
    return () => {
      document.body.classList.remove("cursor-grabbing", "select-none");
    };
  }, [activeId]);

  useEffect(
    () => () => {
      if (edgeRef.current.timer) window.clearTimeout(edgeRef.current.timer);
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    },
    [],
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) =>
        taskMatches(task, { search, filter, mine, columns }),
      ),
    [tasks, search, filter, mine, columns],
  );
  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    columns.forEach((column) => {
      map[column.id] = visibleTasks.filter(
        (task) => task.columnId === column.id,
      );
    });
    return map;
  }, [columns, visibleTasks]);
  const hiddenCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      counts[task.columnId] = (counts[task.columnId] ?? 0) + 1;
    });
    return counts;
  }, [tasks]);

  const visibleColumns = columns.filter((column) => !column.hidden);
  const hiddenColumns = columns.filter((column) => column.hidden);
  const activeTask = activeId
    ? (tasks.find((task) => task.id === activeId) ?? null)
    : null;
  const activeColumn = activeTask
    ? (columns.find((column) => column.id === activeTask.columnId) ?? null)
    : null;
  const filtering = isFilterActive(filter) || search.trim().length > 0 || mine;
  const nothingVisible =
    visibleTasks.length === 0 && tasks.length > 0 && filtering;

  const updatePlacement = useCallback((next: Placement | null) => {
    placementRef.current = next;
    setPlacement(next);
  }, []);

  const columnOffsets = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return [];
    const base = scroller.getBoundingClientRect().left - scroller.scrollLeft;
    return Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-column-id]"),
    ).map((element) => ({
      id: element.dataset.columnId as string,
      left: element.getBoundingClientRect().left - base,
    }));
  };

  const nearestColumn = (
    offsets: { id: string; left: number }[],
    left: number,
  ) =>
    offsets.reduce(
      (best, item, index) =>
        Math.abs(item.left - left) < Math.abs(offsets[best].left - left)
          ? index
          : best,
      0,
    );

  const pageBoard = (dir: EdgeDirection) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const offsets = columnOffsets();
    if (offsets.length === 0) return;
    const current = nearestColumn(offsets, scroller.scrollLeft);
    const target =
      offsets[Math.min(offsets.length - 1, Math.max(0, current + dir))];
    if (!target || Math.abs(target.left - scroller.scrollLeft) < 1) return;
    scroller.scrollTo({ left: target.left, behavior: "smooth" });
    const pointer = pointerRef.current;
    lockRef.current = pointer ? { columnId: target.id, at: pointer } : null;
  };

  const clearEdge = () => {
    if (edgeRef.current.timer) window.clearTimeout(edgeRef.current.timer);
    edgeRef.current = { dir: 0, timer: null };
    setEdgeDir((dir) => (dir === 0 ? dir : 0));
  };

  const armEdge = (dir: EdgeDirection) => {
    if (edgeRef.current.dir === dir) return;
    if (edgeRef.current.timer) window.clearTimeout(edgeRef.current.timer);
    edgeRef.current = {
      dir,
      timer: window.setTimeout(() => {
        edgeRef.current.timer = null;
        pageBoard(dir);
      }, EDGE_DWELL),
    };
    setEdgeDir(dir);
  };

  const updateEdge = (pointer: Point, hit: Element | null) => {
    const scroller = scrollerRef.current;
    if (
      !scroller ||
      !hit ||
      !scroller.contains(hit) ||
      scroller.scrollWidth <= scroller.clientWidth + 1
    ) {
      clearEdge();
      return;
    }
    const rect = scroller.getBoundingClientRect();
    const zone = Math.min(EDGE_ZONE_MAX, rect.width * EDGE_ZONE_RATIO);
    const canRight =
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
    const canLeft = scroller.scrollLeft > 1;
    if (canRight && pointer.x >= rect.right - zone) armEdge(1);
    else if (canLeft && pointer.x <= rect.left + zone) armEdge(-1);
    else clearEdge();
  };

  const realignColumns = () => {
    const scroller = scrollerRef.current;
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    if (!scroller || !belowLg) {
      setSnapping(true);
      return;
    }
    const offsets = columnOffsets();
    if (offsets.length === 0) {
      setSnapping(true);
      return;
    }
    const target = offsets[nearestColumn(offsets, scroller.scrollLeft)];
    if (Math.abs(target.left - scroller.scrollLeft) < 1) {
      setSnapping(true);
      return;
    }
    scroller.scrollTo({ left: target.left, behavior: "smooth" });
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      setSnapping(true);
    }, REALIGN_DURATION);
  };

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    pointerRef.current = eventPoint(activatorEvent);
    lockRef.current = null;
    setSnapping(false);
    setActiveId(String(active.id));
    setDragCount((count) => count + 1);
    updatePlacement(null);
  };

  const pointerFrom = (event: DragMoveEvent) => {
    const origin = eventPoint(event.activatorEvent) ?? { x: 0, y: 0 };
    return { x: origin.x + event.delta.x, y: origin.y + event.delta.y };
  };

  const samePlacement = (a: Placement | null, b: Placement | null) =>
    a === b ||
    (a !== null &&
      b !== null &&
      a.columnId === b.columnId &&
      a.index === b.index &&
      a.hidden === b.hidden);

  const computePlacement = (pointer: Point, id: string): Placement | null => {
    const hit = document.elementFromPoint(pointer.x, pointer.y);
    updateEdge(pointer, hit);
    const hiddenRow = hit?.closest<HTMLElement>("[data-hidden-column]");
    if (hiddenRow?.dataset.hiddenColumn) {
      lockRef.current = null;
      return {
        columnId: hiddenRow.dataset.hiddenColumn,
        index: Number.MAX_SAFE_INTEGER,
        beforeId: null,
        hidden: true,
      };
    }
    const lock = lockRef.current;
    if (
      lock &&
      Math.hypot(pointer.x - lock.at.x, pointer.y - lock.at.y) > LOCK_RADIUS
    ) {
      lockRef.current = null;
    }
    const columnId =
      lockRef.current?.columnId ??
      hit?.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
    if (!columnId) return null;
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-column-id="${columnId}"] [data-task-card]`,
      ),
    ).filter((card) => card.dataset.taskCard !== id);
    let index = 0;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (pointer.y > rect.top + rect.height / 2) index += 1;
      else break;
    }
    return {
      columnId,
      index,
      beforeId: cards[index]?.dataset.taskCard ?? null,
      hidden: false,
    };
  };

  const onDragMove = (event: DragMoveEvent) => {
    const pointer = pointerRef.current ?? pointerFrom(event);
    const next = computePlacement(pointer, String(event.active.id));
    if (!samePlacement(placementRef.current, next)) updatePlacement(next);
  };

  const finish = () => {
    markDragEnd();
    clearEdge();
    lockRef.current = null;
    setActiveId(null);
    updatePlacement(null);
    realignColumns();
  };

  const onDragEnd = ({ active }: DragEndEvent) => {
    const id = String(active.id);
    const pointer = pointerRef.current;
    const target = pointer
      ? computePlacement(pointer, id)
      : placementRef.current;
    const task = tasks.find((item) => item.id === id);
    if (task && target) {
      setSettledId(id);
      window.setTimeout(() => setSettledId(null), 150);
      moveTask(id, target.columnId, target.beforeId);
      if (target.hidden) {
        const column = columns.find((item) => item.id === target.columnId);
        toast(`Moved to ${column?.name ?? "hidden column"}`);
      }
    }
    finish();
  };

  const panel = <HiddenColumns columns={hiddenColumns} counts={hiddenCounts} />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Enter to open the task. Drag it with a pointer to move it to another column. Hold it at the edge of the board to slide to the next column.",
        },
      }}
    >
      <div className="relative flex min-h-0 flex-1">
        <motion.div
          ref={scrollerRef}
          layoutScroll
          className={cn(
            "scroll-thin flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden lg:snap-none",
            !snapping && "snap-none",
          )}
        >
          {visibleColumns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={tasksByColumn[column.id] ?? []}
              members={members}
              teamName={teamName}
              display={display}
              activeId={activeId}
              activeTask={activeTask}
              placement={placement}
              settledId={settledId}
            />
          ))}
          {visibleColumns.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <h2>Every column is hidden</h2>
              <p className="text-muted-foreground max-w-[22em]">
                Bring a column back from the hidden columns panel to see your
                tasks.
              </p>
            </div>
          )}
        </motion.div>
        <div
          aria-hidden
          className={cn(
            "from-info/15 pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-linear-to-r to-transparent transition-opacity duration-150 lg:hidden",
            edgeDir === -1 ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "from-info/15 pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-linear-to-l to-transparent transition-opacity duration-150 lg:hidden",
            edgeDir === 1 ? "opacity-100" : "opacity-0",
          )}
        />
        {nothingVisible && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 px-8 text-center">
            <div className="shadow-card pointer-events-auto flex flex-col items-center gap-3 rounded-2xl bg-card p-6">
              <h2>No tasks match</h2>
              <p className="text-muted-foreground max-w-[22em]">
                Try a different search or clear the active filters.
              </p>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  clearFilter();
                  setSearch("");
                }}
              >
                Clear search and filters
              </Button>
            </div>
          </div>
        )}
        {panelOpen && (
          <div className="border-border hidden shrink-0 border-l lg:flex">
            {panel}
          </div>
        )}
      </div>
      <AnimatePresence>
        {panelSheetOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setPanelSheetOpen(false)}
              className="bg-foreground/40 absolute inset-0"
            />
            <motion.div
              initial={{ transform: "translateX(100%)" }}
              animate={{ transform: "translateX(0%)" }}
              exit={{ transform: "translateX(100%)" }}
              transition={{ duration: 0.4, ease: EASE_DRAWER }}
              className="shadow-popover absolute inset-y-0 right-0 flex w-[240px] flex-col bg-card"
            >
              <HiddenColumns
                columns={hiddenColumns}
                counts={hiddenCounts}
                onClose={() => setPanelSheetOpen(false)}
                className="w-full flex-1"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {mounted &&
        createPortal(
          <DragOverlay
            dropAnimation={null}
            zIndex={80}
            className="pointer-events-none"
          >
            {activeTask && activeColumn && (
              <TaskCardView
                key={`${activeTask.id}-${dragCount}`}
                task={activeTask}
                column={activeColumn}
                members={members}
                teamName={teamName}
                display={display}
                lifted
                className="pointer-events-none"
              />
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
