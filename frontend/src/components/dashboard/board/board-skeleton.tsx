export default function BoardSkeleton() {
  return (
    <div
      aria-busy
      className="flex min-h-0 flex-1 animate-pulse overflow-hidden"
    >
      {[0, 1, 2].map((column) => (
        <div
          key={column}
          className="border-border flex w-[85vw] max-w-[340px] shrink-0 flex-col gap-5 border-r p-4 sm:w-[320px] lg:w-auto lg:max-w-none lg:flex-1"
        >
          <div className="flex items-center gap-2">
            <span className="bg-muted size-3.5 rounded-[4px]" />
            <span className="bg-muted h-3.5 w-20 rounded" />
          </div>
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="bg-secondary shadow-ring h-[130px] rounded-2xl"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
