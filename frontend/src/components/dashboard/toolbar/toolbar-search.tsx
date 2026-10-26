
import Button from "@/components/_ui/button";
import { useUiStore } from "@/stores/ui-store";
import SearchIcon from "@/assets/icons/search-lg.svg?react";
import XCloseIcon from "@/assets/icons/x-close.svg?react";

export default function ToolbarSearch() {
  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);

  return (
    <label className="shadow-control ease-[ease] focus-within:shadow-focus flex h-[30px] w-full min-w-0 items-center gap-1 rounded-[10px] bg-card pr-1 pl-2 transition-[box-shadow] duration-150 sm:w-[180px]">
      <SearchIcon aria-hidden className="text-subtle size-3.5 shrink-0" />
      <input
        id="board-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
        aria-label="Search tasks"
        className="text-foreground placeholder:text-subtle min-w-0 flex-1 bg-transparent text-[14px] font-medium tracking-[-0.02em] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {search && (
        <Button
          variant="ghost"
          size="xs"
          aria-label="Clear search"
          onClick={() => setSearch("")}
          className="-mr-0.5"
        >
          <XCloseIcon className="size-3" aria-hidden />
        </Button>
      )}
    </label>
  );
}
