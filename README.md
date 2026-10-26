# Kanban: life, goals, studies

UI ported from [kargulstudio/kanban](https://github.com/kargulstudio/kanban) (Geist, same tokens, layout and components).

- `frontend/`: TanStack Start (file routes, zod-validated search params, loaders, server functions, full SSR, streamed activity), Vite and Tailwind 4
- `backend/`: Hono on Bun with MongoDB

## Run (bun only)

```bash
cd backend  && bun install && bun run db:up && bun run dev   # API on :3001, seeds Life/Goals/Studies
cd frontend && bun install && bun run dev                    # app on :3000
```

Env: `backend/.env` (`MONGODB_URI`, `PORT`, `CORS_ORIGINS`), `frontend/.env` (`API_URL`, server-only).
Deploy target: `NITRO_PRESET=bun` by default; set another Nitro preset (node-server, vercel, cloudflare…) at build time without code changes.

## Second brain features

- **Quick capture** (`⌘K` / `C`): plain language like `Gym every tue #goals ~45m !urgent`, parsed instantly offline.
- **Brain dump**: paste anything, and DeepSeek splits it into tasks on the right boards. "One per line" works without AI.
- **Today** (`/`): focus pins, overdue, due today, habits, next 7 days, snoozed. **Plan my day** asks AI to pick a focus for the time you have.
- **Repeating tasks and habits**: finishing one logs today and rolls it to the next date. Streaks show on cards, and a 28-day grid on Overview.
- **Steps** (subtasks) with **AI breakdown**, **time estimates**, **snooze**, and **goals** (tasks on a board named "Goals"; link tasks to them and watch progress).
- **Weekly review**: wins, slipped, stale, goal progress, and AI suggestions you apply in one click.
- **Journal**: one autosaving entry a day, auto-linked to what you finished.
- **Ask**: chat with your boards, habits, goals and journal.
- **Reminders**: background push reminders and daily digests, configurable per device in Connections.
- **Calendar**: month/week/day views and Google sync, plus a private iCal feed (Today → ⋯ → Copy calendar feed link).

AI needs `DEEPSEEK_API_KEY` in `backend/.env`; everything else works without it.

## Sign-in (Clerk, Google only)

1. Create an app at dashboard.clerk.com. Under **SSO connections** enable **Google**; under **Email, phone, username** turn every identifier off.
2. `frontend/.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. `backend/.env`: `CLERK_SECRET_KEY`.
3. Restart both servers. Until keys exist, the app shows a setup page.

How it's wired: Clerk middleware runs on every TanStack Start request; the `_app` layout's `beforeLoad` is the auth boundary. Server functions forward the session token to Hono, which verifies it with `@clerk/hono` and scopes every query by `userId`. The first account to sign in adopts any data created before auth existed; later accounts get fresh starter boards. Calendar feeds use a private per-user URL.

## Theme

Light, Dark or System from the account menu (bottom of the sidebar) or the sign-in page. Stored per browser and applied before first paint.

## Calendar, Google connections, installation, and focus

- `/calendar?view=month|week|day&date=YYYY-MM-DD`: deadlines and separate time blocks, drag from the unscheduled tray, drag blocks to move, drag the lower edge to resize (15-minute steps; arrow keys work on the resize handle). Select a task for exact times and reminders. Calendar shows the device timezone.
- **Schedule my day** and Today’s **Schedule it** place tasks in free gaps from 09:00–18:00, respecting meetings, existing blocks, and estimates.
- **Undo**: task mutations are persisted as groups. Use the toast or `⌘Z`/`Ctrl+Z`. Conflicting changes from elsewhere are rejected rather than overwritten. Deleted tasks can be restored through history.
- `/connections`: independent Google Calendar, Tasks, and Gmail consent. Clerk remains responsible for sign-in. Google refresh tokens are encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`; access tokens remain in server memory.
- Calendar sync uses a dedicated **Kanban** calendar. Tasks sync uses a dedicated **Kanban** list. Mapped remote changes update local tasks; Calendar deletion clears the block and preserves the task. Google Tasks deletion detaches that occurrence. Existing Google lists can be imported explicitly. Recurring completion rolls the local task forward; each Google Tasks occurrence has a new remote ID. Calendar represents the next scheduled occurrence, not an infinite series.
- Changes enter a Mongo-backed retry queue, processed every 30 seconds. Calendar polls every 5 minutes; Tasks every 2 minutes. Optional `GOOGLE_WEBHOOK_URL=https://your-api/google/webhook` enables Calendar change notifications with automatic channel renewal. A public HTTPS callback is required for webhooks; polling works locally. Run one persistent backend process (including the reminder worker); do not deploy this worker to request-only/serverless hosting without a scheduled worker.
- PWA manifest, icons, install prompt, capture/Today shortcuts, and share target. The service worker caches public assets and a dedicated offline page; authenticated HTML and API responses are never cached. Last workspace and pending task commands are scoped to the signed-in user in local storage. Offline reload supports capture and nonrecurring completion; the full calendar and authentication need a connection. Reopen online to replay changes. Sign-out clears saved workspace data.
- Push uses VAPID and per-device subscriptions. Task reminders, daily digest, quiet hours, and Done/Snooze actions work while the app is closed. Configure device access in Connections. iPhone requires an installed home-screen app and HTTPS (iOS 16.4+). Notification actions depend on browser support; failed actions open the app.
- Start focus from ▶ on a task or block; finish in the floating timer. Sessions persist on the server and appear in Weekly review with actual versus estimated time.

### Google OAuth setup

Create a Web application OAuth client in Google Cloud, enable Calendar/Tasks/Gmail APIs, configure an External testing consent screen, and add your account as a test user. The local redirect URI is `http://localhost:3001/google/callback` (copy the exact deployment URI from Connections). Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, and `PUBLIC_API_URL` in `backend/.env`. Set a stable `TOKEN_ENCRYPTION_KEY` (32 random bytes, base64) and VAPID public/private keys. Never commit these keys. Restart the backend after changing environment configuration.

Services request permissions when connected. Gmail currently checks connection health only; it does not import email. Gmail read access is restricted and may require Google verification/security assessment for public distribution. Testing consent with sensitive/restricted scopes may require reconnecting after Google’s test-token expiry.

### Validation

```bash
bun run --cwd backend typecheck
bun run --cwd frontend typecheck
bun test tests/scheduling.test.ts
bun --env-file=backend/.env tests/integration.ts
bun --env-file=backend/.env tests/google-sync.integration.ts
bun run --cwd frontend build
```

The integration script uses uniquely named temporary records in the configured Mongo database and cleans them up. It exercises real Hono routes with a test identity injected in a local test harness: idempotent offline replay, schedule validation, delete restore, multi-step undo, and durable sync jobs. Live Google consent and real phone delivery require the corresponding connected account/device.

## Deployed app

The app is deployed at [kanban.devzshrc.in](https://kanban.devzshrc.in), with its Hono API at [kanban-api.devzshrc.in](https://kanban-api.devzshrc.in). MongoDB Atlas uses the free M0 tier in AWS Mumbai. See [deployment and redeploy instructions](docs/deployment.md).
