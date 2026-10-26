import {
  getNotificationSettings,
  subscribePush,
  unsubscribePush,
} from "@/server/productivity";
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator))
    throw new Error("This browser does not support app installation");
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export async function enablePush() {
  if (!("Notification" in window) || !("PushManager" in window))
    throw new Error(
      "Install Kanban to your home screen to enable push on this device",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Allow notifications in your browser settings to receive reminders",
    );
  const settings = await getNotificationSettings();
  if (!settings.publicKey) throw new Error("Push delivery is not configured");
  const worker = await registerServiceWorker();
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(settings.publicKey),
    }));
  const data = subscription.toJSON();
  await subscribePush({
    data: {
      endpoint: subscription.endpoint,
      keys: { p256dh: data.keys!.p256dh, auth: data.keys!.auth },
    },
  });
}
export async function disablePush() {
  const worker = await registerServiceWorker();
  const subscription = await worker.pushManager.getSubscription();
  if (subscription) {
    await unsubscribePush({ data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
}
