import { storagePrefix } from "@/lib/task-mutations";
import { useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import SidebarItem from "@/components/dashboard/sidebar/sidebar-item";
import Menu from "@/components/_ui/menu";
import { THEMES, originOf } from "@/components/_common/theme-toggle";
import { useThemeStore } from "@/lib/theme";
import { useUiStore } from "@/stores/ui-store";
import DotsIcon from "@/assets/icons/dots-horizontal.svg?react";
import HelpIcon from "@/assets/icons/help-circle.svg?react";
import LogOutIcon from "@/assets/icons/log-out.svg?react";
import UserIcon from "@/assets/icons/user-03.svg?react";

export default function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const openDialog = useUiStore((state) => state.openDialog);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";

  return (
    <div ref={anchorRef}>
      <SidebarItem
        label={name}
        collapsed={collapsed}
        active={open}
        indicator={false}
        onClick={() => setOpen((value) => !value)}
        leading={
          user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="shadow-ring size-[18px] shrink-0 rounded-full -mx-0.5"
            />
          ) : (
            <UserIcon aria-hidden className="text-icon size-3.5 shrink-0" />
          )
        }
        trailing={<DotsIcon aria-hidden className="text-icon size-3.5" />}
      />
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Account"
        className="w-[227px]"
        items={[
          { id: "email", heading: user?.primaryEmailAddress?.emailAddress ?? "Signed in" },
          { id: "theme", heading: "Theme" },
          ...THEMES.map((item) => ({
            id: `theme-${item.value}`,
            label: item.label,
            icon: <item.icon />,
            checked: theme === item.value,
            keepOpen: true,
            onSelect: () => setTheme(item.value, originOf(anchorRef.current)),
          })),
          { id: "sep", separator: true as const },
          {
            id: "help",
            label: "Help and shortcuts",
            icon: <HelpIcon />,
            onSelect: () => openDialog({ type: "help" }),
          },
          {
            id: "sign-out",
            label: "Sign out",
            icon: <LogOutIcon />,
            onSelect: async () => {
              // Clear private offline data before leaving the authenticated layout.
              for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith(storagePrefix)) localStorage.removeItem(key); }
              await signOut();
              // Full reload: drops every in-memory store from the previous user.
              window.location.assign("/sign-in");
            },
          },
        ]}
      />
    </div>
  );
}
