import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { PageBody, PageHeader, Section } from "@/components/second-brain/page";
import Button from "@/components/_ui/button";
import { Field, Input, Select } from "@/components/_ui/form";
import SettingsIcon from "@/assets/icons/settings-04.svg?react";
import {
  connectGoogle,
  disconnectGoogle,
  getConnections,
  getNotificationSettings,
  syncGoogle,
  saveNotificationPreferences,
  testPush,
  getTaskLists,
  importGoogleTasks,
} from "@/server/productivity";
import { enablePush, disablePush } from "@/lib/pwa";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
export const Route = createFileRoute("/_app/connections")({
  ssr: true,
  validateSearch: z.object({
    connected: z.enum(["calendar", "tasks", "gmail"]).optional(),
    error: z.string().max(500).optional(),
  }),
  loader: async () => ({
    connections: await getConnections(),
    notifications: await getNotificationSettings(),
  }),
  head: () => ({ meta: [{ title: "Connections - Kanban" }] }),
  component: Connections,
});
function Connections() {
  const { connections, notifications } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const toast = useUiStore((s) => s.toast);
  const boards = useWorkspaceStore((s) => s.boards);
  const [prefs, setPrefs] = useState(notifications.preferences);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [install, setInstall] = useState<any>(null);
  const [lists, setLists] = useState<{ id: string; title: string }[]>([]);
  const [listId, setListId] = useState("");
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready
        .then((r) => r.pushManager.getSubscription())
        .then((s) => setSubscribed(Boolean(s)));
    const listener = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await action();
      if (message) toast(message);
      await router.invalidate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not complete this action");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        icon={SettingsIcon}
        title="Connections"
        actions={
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => run(() => syncGoogle(), "Connection check finished")}
          >
            Sync now
          </Button>
        }
      />
      <PageBody>
        {search.error && (
          <p role="alert" className="text-danger">
            {search.error}
          </p>
        )}
        {search.connected && (
          <p role="status" className="text-info">
            Google {search.connected} connected.
          </p>
        )}
        {!connections.configured && (
          <Section title="Google setup">
            <p className="text-muted-foreground">
              An OAuth client is needed before you can connect your account. Add
              its credentials to the backend configuration.
            </p>
            <Field label="Authorized redirect URI">
              <Input
                readOnly
                value={connections.redirectUri}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <p className="text-subtle">
              Enable Calendar, Tasks, and Gmail APIs in your Google Cloud
              project. Add your Google account as a test user while the app is
              in testing.
            </p>
          </Section>
        )}
        {(["calendar", "tasks", "gmail"] as const).map((service) => {
          const connection = connections.services.find(
            (s) => s.service === service,
          );
          return (
            <Section
              key={service}
              title={`Google ${service === "calendar" ? "Calendar" : service === "tasks" ? "Tasks" : "Gmail"}`}
              actions={
                <>
                  <span className={connection ? "text-info" : "text-subtle"}>
                    {connection ? "Connected" : "Not connected"}
                  </span>
                  {connection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => disconnectGoogle({ data: { service } }),
                          "Disconnected",
                        )
                      }
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || !connections.configured}
                    onClick={() =>
                      run(async () => {
                        const result = await connectGoogle({
                          data: { service },
                        });
                        window.location.assign(result.url);
                      })
                    }
                  >
                    {connection ? "Reconnect" : "Connect"}
                  </Button>
                </>
              }
            >
              <p className="text-muted-foreground">
                {service === "calendar"
                  ? "Time blocks and deadlines sync to a dedicated Kanban calendar. Meetings from your other calendars appear beside your tasks."
                  : service === "tasks"
                    ? "Titles, notes, due dates, and completion sync with a dedicated Kanban list. Google Tasks supports dates; time blocks live in Calendar."
                    : "Connect your account for future email capture. No messages are imported."}
              </p>
              {connection && (
                <>
                  <p className="text-subtle">
                    {connection.account} ·{" "}
                    {connection.lastSync
                      ? `Last checked ${new Date(connection.lastSync).toLocaleString()}`
                      : "Waiting for first sync"}
                  </p>
                  {connection.error && (
                    <p role="alert" className="text-danger">
                      {connection.error}
                    </p>
                  )}
                </>
              )}
              {service === "gmail" && (
                <p className="text-subtle text-xs">
                  Gmail read access is a restricted Google permission. Public
                  release requires Google’s applicable verification process.
                </p>
              )}
            </Section>
          );
        })}
        {connections.services.some((s) => s.service === "tasks") && (
          <Section title="Import existing Google Tasks">
            <p className="text-subtle">
              Copies open tasks from a list into your chosen board. Repeating
              the import skips tasks already copied.
            </p>
            <Button
              variant="secondary"
              size="md"
              disabled={busy}
              onClick={() => run(async () => setLists(await getTaskLists()))}
            >
              Choose a Google list
            </Button>
            {lists.length > 0 && (
              <>
                <Field label="Google list">
                  <Select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                  >
                    <option value="">Select list</option>
                    {lists.map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Destination board">
                  <Select
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                  >
                    {boards.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="primary"
                  size="md"
                  disabled={busy || !listId || !boardId}
                  onClick={() =>
                    run(async () => {
                      const result = await importGoogleTasks({
                        data: { listId, boardId },
                      });
                      toast(`Imported ${result.count} tasks`);
                    })
                  }
                >
                  Import tasks
                </Button>
              </>
            )}
          </Section>
        )}
        <Section
          title="Phone reminders"
          actions={
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !notifications.publicKey}
              onClick={() =>
                run(
                  async () => {
                    if (subscribed) {
                      await disablePush();
                      setSubscribed(false);
                    } else {
                      await enablePush();
                      setSubscribed(true);
                    }
                  },
                  subscribed
                    ? "Reminders off on this device"
                    : "Reminders on for this device",
                )
              }
            >
              {subscribed ? "Disable on this device" : "Enable on this device"}
            </Button>
          }
        >
          <p className="text-muted-foreground">
            Task reminders arrive when Kanban is closed. {notifications.devices}{" "}
            device{notifications.devices === 1 ? "" : "s"} connected.
          </p>
          <p className="text-subtle">
            On iPhone, add Kanban to your home screen first, then enable
            notifications inside the installed app. Phone installation and push
            require HTTPS.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone">
              <Input
                value={prefs.timezone}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, timezone: e.target.value }))
                }
              />
            </Field>
            <Field label="Daily digest">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.digestEnabled}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, digestEnabled: e.target.checked }))
                  }
                />
                Send each day
              </label>
            </Field>
            <Field label="Digest time">
              <Input
                type="time"
                value={prefs.digestTime}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, digestTime: e.target.value }))
                }
              />
            </Field>
            <div />
            <Field label="Quiet hours start">
              <Input
                type="time"
                value={prefs.quietStart}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, quietStart: e.target.value }))
                }
              />
            </Field>
            <Field label="Quiet hours end">
              <Input
                type="time"
                value={prefs.quietEnd}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, quietEnd: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              disabled={busy}
              onClick={() =>
                run(
                  () => saveNotificationPreferences({ data: prefs }),
                  "Reminder preferences saved",
                )
              }
            >
              Save preferences
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={busy || !subscribed}
              onClick={() =>
                run(async () => {
                  const { sent } = await testPush();
                  toast(
                    sent
                      ? "Test notification sent"
                      : "No devices received the test. Re-enable notifications and retry.",
                  );
                })
              }
            >
              Send test
            </Button>
          </div>
        </Section>
        <Section title="Take Kanban with you">
          <p className="text-muted-foreground">
            Install it for quick capture, a focused home-screen app, and phone
            reminders.
          </p>
          {install ? (
            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              Install Kanban
            </Button>
          ) : (
            <p className="text-subtle">
              Use your browser’s Install app option. On iPhone: Share → Add to
              Home Screen.
            </p>
          )}
          <p className="text-subtle">
            Offline task changes stay on this device until you reconnect.
            Sign-in requires an internet connection.
          </p>
        </Section>
      </PageBody>
    </>
  );
}
