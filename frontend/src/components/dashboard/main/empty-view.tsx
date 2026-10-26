
import Button from "@/components/_ui/button";
import { useUiStore, type NavId } from "@/stores/ui-store";
import CubeIcon from "@/assets/icons/cube-01.svg?react";
import LayersIcon from "@/assets/icons/layers-three-01.svg?react";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";

const views: Partial<Record<NavId, { title: string; icon: typeof CubeIcon }>> =
  {
    projects: { title: "Projects", icon: CubeIcon },
    "team-projects": { title: "Projects", icon: CubeIcon },
    views: { title: "Views", icon: LayersIcon },
    "team-views": { title: "Views", icon: LayersIcon },
    more: { title: "More", icon: DotsIcon },
  };

export default function EmptyView({ nav }: { nav: NavId }) {
  const setNav = useUiStore((state) => state.setNav);
  const view = views[nav] ?? { title: "This page", icon: DotsIcon };
  const Icon = view.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="bg-secondary shadow-ring flex size-12 items-center justify-center rounded-2xl">
        <Icon aria-hidden className="text-icon size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2>{view.title} isn&apos;t part of this demo</h2>
        <p className="text-muted-foreground max-w-[26em]">
          The Tasks board is fully working, with drag and drop, filters,
          assignees and due dates. Head back there to keep going.
        </p>
      </div>
      <Button variant="primary" size="md" onClick={() => setNav("team-issues")}>
        Go to tasks
      </Button>
    </div>
  );
}
