
import { useKanbanStore } from "@/stores/kanban-store";
import { timeAgo } from "@/lib/dates";

export default function Updates() {
  const activity = useKanbanStore((state) => state.activity);

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <section className="shadow-card flex flex-col gap-4 rounded-2xl bg-card p-4">
          <div className="flex items-center justify-between">
            <h2>Activity</h2>
            <span className="text-subtle">{activity.length} updates</span>
          </div>
          {activity.length === 0 ? (
            <p className="text-subtle">
              Changes you make on the board will show up here.
            </p>
          ) : (
            <ol className="flex flex-col">
              {activity.map((item, index) => (
                <li
                  key={item.id}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  {index < activity.length - 1 && (
                    <span
                      aria-hidden
                      className="bg-border absolute top-3 bottom-0 left-[3px] w-px"
                    />
                  )}
                  <span
                    aria-hidden
                    className="bg-info relative mt-[6px] size-[7px] shrink-0 rounded-full ring-2 ring-white"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p>{item.text}</p>
                    <span className="text-subtle text-[12px]">
                      {timeAgo(item.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
