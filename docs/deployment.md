# Deployment runbook

How the product runs in production, how to deploy this version next to the first one, switch over, check it, and switch back if needed. Every service is on a free tier; section 7 lists what to upgrade first.

## 1. Production setup

```
Browser ──► Vercel (web app, apps/web)  ──/api/* rewrite──►  Render (API container, apps/api)
                                                                 ├─► MongoDB Atlas  (database ru-lost-found-v2)
                                                                 ├─► Upstash Redis  (codes, rate limits, job leases)
                                                                 ├─► Brevo          (email)
                                                                 ├─► Cloudinary     (images)
                                                                 └─► Sentry         (errors; the web app reports too)
UptimeRobot ──► /api/v1/health/live every 5 minutes (alerts, and keeps the free instance awake)
```

The browser only ever talks to the Vercel domain: `/api` is rewritten to Render, so the refresh-token cookie is first-party and no CORS preflight is needed.

## Where configuration lives

| File or place                                              | Committed?       | Used for                                                                                                                                            |
| ---------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.env.example`                                    | Yes              | Reference: every API setting, explained, with no real values                                                                                        |
| `apps/api/.env`                                            | No (git-ignored) | Local development (`npm run dev:api`): local database, no production secrets                                                                        |
| `apps/api/.env.production`                                 | No (git-ignored) | Production values, for running scripts against production from a laptop (`npx tsx --env-file=.env.production …`) and as a copy of Render's settings |
| Render dashboard → `ru-lost-found-api` → Environment       | n/a              | The live API's settings (the source of truth)                                                                                                       |
| `apps/web/.env.example`                                    | Yes              | Reference: the web app's settings                                                                                                                   |
| `apps/web/.env.production`                                 | No (git-ignored) | Production build settings, a copy of Vercel's                                                                                                       |
| Vercel dashboard → `ru-lost-found` → Environment Variables | n/a              | The live website's settings (the source of truth)                                                                                                   |

A new developer copies `apps/api/.env.example` to `apps/api/.env` and is ready (see the README); the web app needs no env file locally. Every `*.env` and `.env.*` file except the examples is git-ignored. When a value changes in a dashboard, update the local copy too.

## 2. Before the first deploy

| Service       | What to set up                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB Atlas | In the existing cluster, nothing to create: the API creates database `ru-lost-found-v2` and its indexes on start. Use a database user with access to it (and read access to the old database for the migration). |
| Upstash       | A Redis database (free tier). Copy the `rediss://` URL.                                                                                                                                                          |
| Brevo         | Verify the sender address used as `EMAIL_FROM_ADDRESS`; create an API key.                                                                                                                                       |
| Cloudinary    | The existing account (old images stay where they are).                                                                                                                                                           |
| Sentry        | Two projects: Node (API) and React (web). Copy both DSNs.                                                                                                                                                        |

## 3. Deploy the API (Render)

1. Render → **New → Blueprint** → this repository. Render reads `render.yaml` and creates the service `ru-lost-found-api` (Docker, built from `apps/api/Dockerfile`).
2. Fill in the secrets it asks for: `MONGODB_URI` (ending in `/ru-lost-found-v2`), `REDIS_URL`, `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `CLOUDINARY_*`, `SENTRY_DSN`. `APP_SECRET` is generated by Render; never change it later (it would sign everyone out and invalidate pending codes).
3. When the deploy is live, check:
   - `https://ru-lost-found-api.onrender.com/api/v1/health/ready` → `{"status":"ok", ...}`
   - `https://ru-lost-found-api.onrender.com/api/v1/docs` → the API documentation

The API refuses to start in production if a required setting is missing or invalid, and its log names every problem at once.

## 4. Data: university, first admin, old accounts

Render's free plan has no shell, so these run from a laptop against the production database. Use the production `MONGODB_URI`; `APP_SECRET` can be any 32+ character value here (these scripts don't use it).

```bash
cd apps/api
export MONGODB_URI='mongodb+srv://…/ru-lost-found-v2' APP_SECRET='any-32-characters-long-value-here'

npm run seed                                               # the university (seed/universities.json); rerun after editing it

export LEGACY_MONGODB_URI='mongodb+srv://…/<old database>'
npm run migrate-legacy                                     # dry run: prints what would happen
npm run migrate-legacy -- --apply                          # copies accounts and items

npm run set-role -- your.email@rishihood.edu.in PLATFORM_ADMIN     # only if ADMIN_EMAILS isn't set
```

**Admins:** the owners' emails go in the Render setting `ADMIN_EMAILS` (comma-separated). The API makes those accounts platform admins when it starts, or as soon as they sign up, so a fresh deployment needs no manual step. The actual addresses are kept in the dashboard because the repository is public.

The migration keeps ids and passwords (people sign in as before), never writes to the old database, sends no emails and can be run again safely. It does not copy the old "claimed by" contact notes (personal data). Inside the Docker image the same scripts are `node dist/scripts/<name>.js`.

## 5. Switch the web app over (Vercel)

1. Vercel project → **Settings → Build and Deployment**: Root Directory `apps/web`, framework Vite, "Include files outside the root directory" on (the app imports `packages/shared`). The first version's frontend folder no longer exists in this version of the repository, so this setting must be in place before this version is deployed.
2. Environment variable `VITE_SENTRY_DSN` (the React project's DSN).
3. In `apps/web/vercel.json`, point the `/api/:path*` rewrite at `https://ru-lost-found-api.onrender.com/api/:path*`, then deploy. **This is the switch-over.**

## 6. After switching over

| Check                                | How                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in with an old account          | Use an account from the first version: same email and password                                                                                                                                                                                                                                                                                                                                                                                                |
| The whole flow                       | Post an item with a photo, claim it from a second account, approve, hand over with the code                                                                                                                                                                                                                                                                                                                                                                   |
| Real client IPs (`TRUST_PROXY_HOPS`) | Open `https://ru-lost-found.vercel.app/api/v1/health/client`: `ip` must be **your** public address (compare with a "what is my IP" site). `forwardedFor` lists the chain, nearest proxy last; `TRUST_PROXY_HOPS` is the number of entries after your address, plus one for the direct peer. Too low and everyone shares a proxy's rate-limit bucket; too high and clients could fake their IP. The sign-ins in Admin → Activity then show real addresses too. |
| Emails                               | The sign-up code arrives from the Brevo sender; links point at `APP_URL`                                                                                                                                                                                                                                                                                                                                                                                      |
| Error tracking                       | Sentry → Releases shows the deployed commit, and Issues stays empty                                                                                                                                                                                                                                                                                                                                                                                           |
| Uptime                               | UptimeRobot: HTTP monitor on `/api/v1/health/live` every 5 min (alerts + keeps the free instance awake); a second monitor on `/api/v1/health/ready` for alerts only (database or Redis down)                                                                                                                                                                                                                                                                  |
| Security headers                     | `curl -sI https://ru-lost-found.vercel.app/` shows `Content-Security-Policy`; the browser console shows no "Refused to…" messages                                                                                                                                                                                                                                                                                                                             |

**Switching back:** point the rewrite in `vercel.json` back at `https://ru-lost-found.onrender.com` and redeploy the web app. The first version keeps running untouched, but anything created in this version since the switch won't be there. Keep the old service for two weeks, then delete it.

## 7. Free tiers and what to upgrade first

| Limit                                                     | Effect                                                                                 | Upgrade                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Render free instance sleeps after 15 min idle; 512 MB RAM | First request after a quiet period takes ~30 s (the app shows "Waking up the server…") | Render Starter: always on; then run `dist/worker.js` as a separate background worker with `WORKER_ENABLED=false` on the API |
| Atlas M0: 512 MB storage, shared CPU                      | Enough for years of posts (photos live in Cloudinary)                                  | M10 for backups and Atlas Search                                                                                            |
| Upstash free: 10,000 commands/day                         | Each write request costs about one command (rate limit)                                | Pay-as-you-go                                                                                                               |
| Brevo free: 300 emails/day                                | Sign-up codes and claim emails                                                         | Starter plan                                                                                                                |
| Cloudinary free: 25 credits/month                         | Images are resized and re-encoded before upload, so usage stays small                  | Plus plan                                                                                                                   |
| Sentry free: 5,000 errors/month                           | Errors only, no performance tracing                                                    | Team plan                                                                                                                   |

Every provider sits behind an interface (`StorageProvider`, `EmailSender`, `KeyValueStore`, `ErrorReporter`), so moving to another vendor is a new adapter plus a line in `container.ts`.

## 8. Running everything locally with Docker

```bash
docker compose up --build      # → http://localhost:8080 (API docs at /api/v1/docs)
docker compose down -v         # stop and delete the local data
```

MongoDB (as a one-member replica set), Redis, a one-off seed, the API and the web app behind nginx, which mirrors the Vercel setup (same `/api` rewrite and security headers). Sign-up codes are printed in the API log (`docker compose logs api`).
