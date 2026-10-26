
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import Button from "@/components/_ui/button";
import { deleteBoard } from "@/server/boards";
import Menu from "@/components/_ui/menu";
import { Input } from "@/components/_ui/form";
import HeaderNotifications from "@/components/dashboard/header/header-notifications";
import { useKanbanStore } from "@/stores/kanban-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import AlignLeftIcon from "@/assets/icons/align-left-01.svg?react";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg?react";
import FileIcon from "@/assets/icons/file-04.svg?react";
import StarIcon from "@/assets/icons/star-01.svg?react";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";
import LinkIcon from "@/assets/icons/link-02.svg?react";
import CopyIcon from "@/assets/icons/copy-01.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";

export default function Header() {
  const title = useKanbanStore((state) => state.title);
  const favorite = useKanbanStore((state) => state.favorite);
  const setTitle = useKanbanStore((state) => state.setTitle);
  const toggleFavorite = useKanbanStore((state) => state.toggleFavorite);
  const boardId = useKanbanStore((state) => state.id);
  const navigate = useNavigate();
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const toast = useUiStore((state) => state.toast);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    document.title = `${title} - Kanban`;
  }, [title]);

  const startRename = () => {
    setDraft(title);
    setRenaming(true);
  };

  const commitRename = () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== title) {
      setTitle(draft);
      toast("Board renamed");
    }
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commitRename();
    if (event.key === "Escape") setRenaming(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied to clipboard");
    } catch {
      toast("Couldn't copy the link");
    }
  };

  return (
    <header className="border-border flex items-center gap-2 border-b p-4">
      <Button
        variant="secondary"
        size="icon"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden"
      >
        <AlignLeftIcon className="size-3.5" aria-hidden />
      </Button>
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="text-muted-foreground hidden shrink-0 sm:inline">
          Boards
        </span>
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground hidden size-3.5 shrink-0 sm:block"
        />
        <FileIcon
          aria-hidden
          className="text-muted-foreground size-3.5 shrink-0"
        />
        {renaming ? (
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={onRenameKey}
            aria-label="Board title"
            autoFocus
            className="h-[30px] max-w-[360px]"
          />
        ) : (
          <h1 className="min-w-0 truncate">{title}</h1>
        )}
        <div className="divide-border shadow-control flex shrink-0 divide-x overflow-hidden rounded-[10px] bg-card">
          <Button
            variant="ghost"
            size="icon"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={favorite}
            onClick={() => {
              toggleFavorite();
              toast(favorite ? "Removed from favorites" : "Added to favorites");
            }}
            className="rounded-none"
          >
            <StarIcon
              aria-hidden
              className={cn(
                "size-3.5 transition-colors duration-150",
                favorite && "text-warning fill-current",
              )}
            />
          </Button>
          <Button
            ref={menuRef}
            variant="ghost"
            size="icon"
            aria-label="Board options"
            aria-expanded={menuOpen}
            data-active={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-none"
          >
            <DotsIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRef={menuRef}
          label="Board options"
          items={[
            {
              id: "rename",
              label: "Rename board",
              icon: <FileIcon />,
              onSelect: startRename,
            },
            {
              id: "copy",
              label: "Copy link",
              icon: <CopyIcon />,
              onSelect: copyLink,
            },
            {
              id: "favorite",
              label: favorite ? "Remove from favorites" : "Add to favorites",
              icon: <StarIcon />,
              onSelect: toggleFavorite,
            },
            { id: "sep", separator: true },
            {
              id: "delete",
              label: "Delete board",
              icon: <XCloseIcon />,
              danger: true,
              onSelect: async () => {
                if (!window.confirm(`Delete “${title}” and all its tasks?`)) return;
                try {
                  await deleteBoard({ data: { boardId } });
                  toast("Board deleted");
                  navigate({ to: "/" });
                } catch {
                  toast("Couldn't delete the board");
                }
              },
            },
          ]}
        />
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Copy link"
          onClick={copyLink}
          className="hidden sm:inline-flex"
        >
          <LinkIcon className="size-3.5" aria-hidden />
        </Button>
        <HeaderNotifications />
      </div>
    </header>
  );
}
