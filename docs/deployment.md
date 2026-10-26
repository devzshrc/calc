# Cloudflare deployment

- Frontend: https://kanban.devzshrc.in (`kanban-web` Worker)
- API: https://kanban-api.devzshrc.in (`kanban-api` Worker)
- Database: MongoDB Atlas Free/M0, AWS Mumbai (`ap-south-1`), cluster `kanban-mumbai`, database `kanban`.
- GitHub: https://github.com/devzshrc/calc, branch `main`.

## Runtime

TanStack Start still renders full HTML and streams secondary data. Nitro's `cloudflare_module` preset adapts the same application to Workers. Public assets are served through the asset binding. Clerk sessions are forwarded to Hono and verified there independently.

The API runs inside the `KanbanApi` Durable Object to reuse MongoDB connections. An APAC location hint is used; Cloudflare controls the exact compute location. The database itself is in Mumbai. A Cron Trigger calls maintenance every minute for reminders and the durable Google sync queue. The local Bun entry point retains the development timer.

The Atlas app user has `readWrite` access only to `kanban`. Workers use changing outbound IPs, so the project uses the explicitly approved `0.0.0.0/0` network entry, with TLS and SCRAM authentication still required. Credentials and encryption/push keys are Worker secrets, not Wrangler variables or Git files.

## Redeploy

Use Bun throughout:

```sh
bun install --cwd backend
bun install --cwd frontend
bun run --cwd backend typecheck
bun run --cwd frontend typecheck
bun test tests/scheduling.test.ts
bun run --cwd backend deploy
bun run --cwd frontend deploy
```

Frontend deployment builds Nitro's generated Worker config from `frontend/wrangler.jsonc`. The custom-domain declarations let Wrangler manage the subdomain route and certificate. The root domain's other applications are not changed.

After changing secrets, upload them with `bunx wrangler secret bulk` using a private JSON file. Never commit secret JSON, `.env.production`, `.dev.vars`, database backups, or Wrangler state. Reuse `TOKEN_ENCRYPTION_KEY` and the VAPID keys so existing connections and device subscriptions remain usable.

## Data migration

`scripts/migrate-mongodb.ts` copies documents by `_id` with upserts, keeps the source database, and writes private Extended JSON backups under ignored `backups/`. It skips transient OAuth attempts. Supply `SOURCE_MONGODB_URI`, `TARGET_MONGODB_URI`, and optional `MONGODB_DB` in the process environment, not CLI arguments. Do not run the migration against an active destination with newer edits without reviewing conflicts.

## Remaining service setup

The deployment currently uses the existing Clerk development instance. Switch to a Clerk production instance and its Google OAuth client before a public launch; keep users/data migration in mind when changing Clerk instances.

Google Calendar/Tasks/Gmail connections need `GOOGLE_CLIENT_SECRET` in the API Worker and the production callback `https://kanban-api.devzshrc.in/google/callback` registered in Google Cloud. `GOOGLE_CLIENT_ID` is already configured. DeepSeek features require `DEEPSEEK_API_KEY`, which is not present in the local configuration. Board, calendar, journal, focus, undo, offline capture, and push infrastructure work independently of that key.

Phone push additionally needs notification permission in the installed app. On iPhone, install the PWA to the home screen first. Real phone delivery requires testing from the device.
