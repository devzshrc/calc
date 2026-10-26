import { useEffect } from "react";
import { create } from "@/lib/create-store";
import { enablePush } from "@/lib/pwa";
import {
  getNotificationSettings,
  saveNotificationPreferences,
} from "@/server/productivity";
type ReminderSettings = {
  enabled: boolean;
  time: string;
  lastSent: string | null;
};
export const useReminderSettings = create<
  ReminderSettings & {
    update: (patch: Partial<ReminderSettings>) => void;
    hydrate: () => void;
  }
>()((set) => ({
  enabled: false,
  time: "08:00",
  lastSent: null,
  hydrate: () => {
    void getNotificationSettings()
      .then(({ preferences: p }) =>
        set({ enabled: p.digestEnabled, time: p.digestTime }),
      )
      .catch(() => {});
  },
  update: (patch) => {
    set(patch);
    void getNotificationSettings()
      .then(({ preferences: p }) =>
        saveNotificationPreferences({
          data: {
            ...p,
            ...(patch.enabled === undefined
              ? {}
              : { digestEnabled: patch.enabled }),
            ...(patch.time ? { digestTime: patch.time } : {}),
          },
        }),
      )
      .catch(() => {});
  },
}));
export const notificationsSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "PushManager" in window;
export async function enableReminders() {
  try {
    await enablePush();
    useReminderSettings.getState().update({ enabled: true });
    return true;
  } catch {
    return false;
  }
}
export function useReminders() {
  useEffect(() => {
    useReminderSettings.getState().hydrate();
  }, []);
}
