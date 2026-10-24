# Deployment runbook

How the product runs in production, how to deploy it from scratch and how to check a deploy. Every service is on a free tier; section 7 explains how to scale up.

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

| Service       | What to set up                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB Atlas | A cluster (M0 is enough); nothing else to create: the API creates database `ru-lost-found-v2` and its indexes on start. Use a database user with access to it. |
| Upstash       | A Redis database (free tier). Copy the `rediss://` URL.                                                                                                        |
| Brevo         | Verify the sender address used as `EMAIL_FROM_ADDRESS`; create an API key.                                                                                     |
| Cloudinary    | An account; copy the cloud name, API key and secret.                                                                                                           |
| Sentry        | Two projects: Node (API) and React (web). Copy both DSNs.                                                                                                      |

## 3. Deploy the API (Render)

1. Render → **New → Blueprint** → this repository. Render reads `render.yaml` and creates the service `ru-lost-found-api` (Docker, built from `apps/api/Dockerfile`).
2. Fill in the values it asks for: `MONGODB_URI` (ending in `/ru-lost-found-v2`), `REDIS_URL`, `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `CLOUDINARY_*`, `SENTRY_DSN` and `ADMIN_EMAILS` (see section 4). Optional: `EMAIL_FROM_NAME`, otherwise emails come from the brand name. `APP_SECRET` is generated by Render; never change it later (it would sign everyone out and invalidate pending codes).
3. When the deploy is live, check:
   - `https://ru-lost-found-api.onrender.com/api/v1/health/ready` → `{"status":"ok", ...}`
   - `https://ru-lost-found-api.onrender.com/api/v1/docs` → the API documentation

The API refuses to start in production if a required setting is missing or invalid, and its log names every problem at once.

## 4. Data: university and first admin

Render's free plan has no shell, so these run from a laptop against the production database. Use the production `MONGODB_URI`; `APP_SECRET` can be any 32+ character value here (these scripts don't use it).

```bash
cd apps/api
export MONGODB_URI='mongodb+srv://…/ru-lost-found-v2' APP_SECRET='any-32-characters-long-value-here'

npm run seed                                               # the university (seed/universities.json); rerun after editing it
npm run set-role -- your.email@rishihood.edu.in PLATFORM_ADMIN     # only if ADMIN_EMAILS isn't set
```

**Admins:** the owners' emails go in the Render setting `ADMIN_EMAILS` (comma-separated). The API makes those accounts platform admins when it starts, or as soon as they sign up, so a fresh deployment needs no manual step. The actual addresses are kept in the dashboard because the repository is public.

Inside the Docker image the same scripts are `node dist/scripts/<name>.js`.

## 5. Deploy the web app (Vercel)

1. Vercel project → **Settings → Build and Deployment**: Root Directory `apps/web`, framework Vite, "Include files outside the root directory" on (the app imports `packages/shared`).
2. Environment variable `VITE_SENTRY_DSN` (the React project's DSN).
3. `apps/web/vercel.json` rewrites `/api/:path*` to `https://ru-lost-found-api.onrender.com/api/:path*`; change it if the API lives elsewhere.

Pushes to `main` deploy both the web app (Vercel) and the API (Render, `autoDeploy`).

## 6. After a deploy

| Check                                | How                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The whole flow                       | Post an item with a photo, claim it from a second account, approve, hand over with the code                                                                                                                                                                                                                                                                                                                                                                   |
| Real client IPs (`TRUST_PROXY_HOPS`) | Open `https://ru-lost-found.vercel.app/api/v1/health/client`: `ip` must be **your** public address (compare with a "what is my IP" site). `forwardedFor` lists the chain, nearest proxy last; `TRUST_PROXY_HOPS` is the number of entries after your address, plus one for the direct peer. Too low and everyone shares a proxy's rate-limit bucket; too high and clients could fake their IP. The sign-ins in Admin → Activity then show real addresses too. |
| Emails                               | The sign-up code arrives from the Brevo sender; links point at `APP_URL`                                                                                                                                                                                                                                                                                                                                                                                      |
| Error tracking                       | Sentry → Releases shows the deployed commit, and Issues stays empty                                                                                                                                                                                                                                                                                                                                                                                           |
| Uptime                               | UptimeRobot: HTTP monitor on `/api/v1/health/live` every 5 min (alerts + keeps the free instance awake); a second monitor on `/api/v1/health/ready` for alerts only (database or Redis down)                                                                                                                                                                                                                                                                  |
| Security headers                     | `curl -sI https://ru-lost-found.vercel.app/` shows `Content-Security-Policy`; the browser console shows no "Refused to…" messages                                                                                                                                                                                                                                                                                                                             |

## 7. Scaling up

Everything runs on free plans today, and moving to paid ones is a matter of settings: no code changes. Each service's limits are in [services.md](services.md).

**Why no code changes are needed.** The API keeps no state of its own. Sessions, posts and the event outbox are in MongoDB; codes, rate limits and job leases in Redis; photos in Cloudinary. So any number of API instances can run side by side. Each outbox event is claimed by exactly one worker, and each scheduled job runs on one instance at a time (a Redis lease). The code holds no free-plan limits either.

| When                                             | Change                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch with real users                           | **Atlas:** upgrade the cluster in place to Flex or M10 for backups (the data stays; if Atlas shows a new connection string, update `MONGODB_URI` on Render). **Brevo:** a sending domain of your own, and a paid month if more than ~200 people may sign up on one day. See [launch-checklist.md](launch-checklist.md). |
| Always on, without relying on UptimeRobot        | **Render:** `plan: free` → `starter` in `render.yaml` (or the dashboard): no sleeping and a full CPU. UptimeRobot then only alerts.                                                                                                                                                                                     |
| One API instance is busy                         | **Render:** more instances (Scaling tab). Then run the worker on its own: uncomment the worker in `render.yaml`, give it the API's environment variables, and set `WORKER_ENABLED=false` on the API.                                                                                                                    |
| More Redis commands than the free allowance      | **Upstash:** pay-as-you-go. Same `REDIS_URL`.                                                                                                                                                                                                                                                                           |
| More photo traffic or errors than the free plans | **Cloudinary** Plus, **Sentry** Team. Same settings.                                                                                                                                                                                                                                                                    |
| The website                                      | **Vercel:** Hobby is meant for personal, non-commercial projects; a university service should move to Pro. Same project and settings.                                                                                                                                                                                   |

**After any hosting change** (another proxy or CDN in front of the API), check `TRUST_PROXY_HOPS` again with `/api/v1/health/client` (section 6).

**Moving off a provider** works the same way: every provider sits behind an interface (`StorageProvider`, `EmailSender`, `KeyValueStore`, `ErrorReporter`), so another vendor is a new adapter plus a line in `container.ts`. The API image also runs on any Docker host; CI builds and starts it on every change (section 8).

## 8. Running everything locally with Docker

```bash
docker compose up --build      # → http://localhost:8080 (API docs at /api/v1/docs)
docker compose down -v         # stop and delete the local data
```

MongoDB (as a one-member replica set), Redis, a one-off seed, the API and the web app behind nginx, which mirrors the Vercel setup (same `/api` rewrite, security headers and gzip compression, except HSTS, which belongs to whatever serves HTTPS in front). Sign-up codes are printed in the API log (`docker compose logs api`). CI starts this same stack on every change and checks the web app reaches the API. MongoDB runs 8.0, the version Atlas runs; 8.0 refuses to start on Linux kernels 6.19 and newer ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)), so on such a Docker host use an older kernel or check MongoDB's release notes for a fix. Atlas isn't affected.
