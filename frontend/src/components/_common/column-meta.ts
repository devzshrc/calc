import type { ComponentType, SVGProps } from "react";
import type { ColumnKind, Priority } from "@/lib/kanban";
import type { BadgeTone } from "@/components/_common/status-badge";
import ListIcon from "@/assets/icons/list.svg?react";
import ContrastIcon from "@/assets/icons/contrast-02.svg?react";
import ClipboardCheckIcon from "@/assets/icons/clipboard-check.svg?react";
import LoadingIcon from "@/assets/icons/loading-02.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";
import IntersectCircleIcon from "@/assets/icons/intersect-circle.svg?react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type ColumnMeta = { icon: Icon; tone: BadgeTone; color: string };

export const COLUMN_META: Record<ColumnKind, ColumnMeta> = {
  todo: { icon: ListIcon, tone: "neutral", color: "text-icon" },
  "in-progress": { icon: ContrastIcon, tone: "info", color: "text-info" },
  done: { icon: ClipboardCheckIcon, tone: "success", color: "text-success" },
  backlog: { icon: LoadingIcon, tone: "neutral", color: "text-icon" },
  canceled: { icon: XCloseIcon, tone: "neutral", color: "text-icon" },
  duplicated: {
    icon: IntersectCircleIcon,
    tone: "neutral",
    color: "text-icon",
  },
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "text-warning",
  normal: "text-info",
  low: "text-success",
};
