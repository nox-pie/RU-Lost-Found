# External services

Every service the product runs on: what it does, how it is connected, what to watch and how to change or replace it. All of them are on a free plan. Setting **names** are listed here; the values live in the hosting dashboards and in the git-ignored local copies described in [deployment.md](deployment.md#where-configuration-lives). No secret belongs in this file.

## Overview

| Service                         | Role                                                    | Plan             | Where to find it                                                                                                         | Connected through                                                                                                       |
| ------------------------------- | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [MongoDB Atlas](#mongodb-atlas) | The database                                            | M0 (free)        | [cloud.mongodb.com](https://cloud.mongodb.com) → cluster **Lost-and-Found** → database **ru-lost-found-v2**              | Setting `MONGODB_URI` (Render)                                                                                          |
| [Upstash Redis](#upstash-redis) | One-time codes, rate limits, login throttle, job leases | Free             | [console.upstash.com](https://console.upstash.com) → Redis → database **ru-lost-found** (Singapore)                      | Setting `REDIS_URL` (Render)                                                                                            |
| [Render](#render)               | Runs the API (and its background worker)                | Free web service | [dashboard.render.com](https://dashboard.render.com) → service **ru-lost-found-api**                                     | Auto-deploys from GitHub `main` when the API changes (build filter); API address https://ru-lost-found-api.onrender.com |
| [Vercel](#vercel)               | Serves the website, forwards `/api` to Render           | Hobby (free)     | [vercel.com](https://vercel.com) → project **ru-lost-found**                                                             | Deploys from GitHub `main` (root `apps/web`) using `apps/web/vercel.json`; site https://ru-lost-found.vercel.app        |
| [Cloudinary](#cloudinary)       | Stores and delivers photos                              | Free             | [console.cloudinary.com](https://console.cloudinary.com) → cloud **dowyiom8** → Media Library → folder **ru-lost-found** | Settings `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Render)                                |
| [Brevo](#brevo)                 | Sends email                                             | Free             | [app.brevo.com](https://app.brevo.com) → Transactional (logs), SMTP & API (keys), Senders                                | Settings `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS` (Render)                                                                 |
| [Sentry](#sentry)               | Error tracking (API and website)                        | Developer (free) | [sentry.io](https://sentry.io) → projects **ru-lost-found-api** and **ru-lost-found-web**                                | Settings `SENTRY_DSN` (Render) and `VITE_SENTRY_DSN` (Vercel)                                                           |
| [UptimeRobot](#uptimerobot)     | Uptime alerts; keeps the free API awake                 | Free             | [dashboard.uptimerobot.com](https://dashboard.uptimerobot.com) → two monitors (below)                                    | HTTP(s) checks of `/api/v1/health/live` and `/api/v1/health/ready` every 5 minutes                                      |
| [GitHub](#github)               | Code, CI, dependency updates                            | Free             | https://github.com/nox-pie/RU-Lost-Found → Actions (CI), Pull requests (Dependabot)                                      | Vercel deploys every push to `main`; Render when the API changes                                                        |

Each provider sits behind an interface in the code, so replacing one is a new adapter and no change to business code ([deployment.md §7](deployment.md#7-scaling-up)).

---

## MongoDB Atlas

- **Dashboard:** [cloud.mongodb.com](https://cloud.mongodb.com) → cluster **Lost-and-Found** → Browse Collections → **ru-lost-found-v2**.
- **What:** all data: universities, users, sessions, posts, claims, notifications, moderation reports, the audit log and the outbox of pending events. Transactions (claim + item + events saved together) need a replica set, which every Atlas cluster is.
- **Where:** project with the cluster **`Lost-and-Found`** (M0, AWS Mumbai `ap-south-1`, MongoDB 8.0; tests, CI and Docker use the same version, so check them after Atlas moves to a new major version). The app's database is **`ru-lost-found-v2`**; it creates its collections and indexes itself on start-up.
- **Setting:** `MONGODB_URI` (connection string ending in `/ru-lost-found-v2`), in Render and in `apps/api/.env.production`.
- **Access:** Database Access has the app's user (read and write). Network Access allows `0.0.0.0/0` because Render's free tier has no fixed outgoing IP; the password is the protection.
- **Limits:** 512 MB storage and shared CPU. Photos are not stored here (Cloudinary), so this lasts a long time. Old data is pruned automatically ([retention](design/database.md#5-retention)).
- **Watch:** Clusters → Metrics (storage, connections).
- **Backups:** M0 has no automatic backups. Flex and above take daily snapshots; until then, `mongodump`. The steps for both, and a restore test, are in [launch-checklist.md §3](launch-checklist.md#3-a-week-before-data-safety).
- **Rotate the password:** Database Access → Edit user → new password → update `MONGODB_URI` in Render (redeploys) and in `apps/api/.env.production`.
- **Upgrade:** M10+ adds backups, more storage and Atlas Search (better text search).

## Upstash Redis

- **Dashboard:** [console.upstash.com](https://console.upstash.com) → Redis → **ru-lost-found**.
- **What:** short-lived shared state: one-time codes (stored as a hash, 10 minutes), rate-limit counters, failed-login counters and the leases that make each scheduled job run on one instance only. Losing it is harmless: codes must be requested again and counters restart.
- **Where:** database **`ru-lost-found`**, region **AP-Southeast-1 (Singapore)**, next to the API.
- **Setting:** `REDIS_URL`, which must start with `rediss://` (encrypted). The API refuses anything else at start-up. The API speaks the RESP2 protocol (`protocol: 2` in `RedisKeyValueStore`), which it has always used with Upstash; ioredis 6 would otherwise switch to RESP3.
- **Limits:** 500,000 commands a month on the free plan, and a size limit (the database's **Usage** page shows both). Each write request uses about one command for its rate limit; reads aren't counted.
- **Watch:** Usage page (commands per day).
- **Rotate the password:** database page → reset credentials → copy the new `rediss://…` URL into Render.
- **Without it:** the API keeps the same data in memory (fine for one instance; never in production).
- **If it goes down:** the API keeps working. Codes, rate limits and job leases move to the API's own memory until Upstash answers again; the API checks every 30 seconds, and the one request that checks can take up to 1.5 s. Codes requested before the outage must be requested again. `/api/v1/health/ready` reports `redis: down` (so UptimeRobot's database + Redis monitor sends an alert), and the outage is logged and reported to Sentry once.

## Render

- **Dashboard:** [dashboard.render.com](https://dashboard.render.com) → **ru-lost-found-api** (tabs: Logs, Events, Environment, Metrics).
- **What:** runs the API as a Docker container built from `apps/api/Dockerfile`, with the background worker (notifications, emails, scheduled jobs) in the same process.
- **Where:** web service **`ru-lost-found-api`** (region Singapore, free plan), created by hand in the dashboard; `render.yaml` records the same settings. URL: `https://ru-lost-found-api.onrender.com`. Visitors never call it directly; Vercel forwards `/api`.
- **Settings:** every API setting is under the service's **Environment** tab (the source of truth). Notable non-secret ones: `NODE_ENV=production`, `TRUST_PROXY_HOPS=4`, `APP_URL`, `CORS_ORIGINS`, `ADMIN_EMAILS`, `WORKER_ENABLED`.
- **Deploys:** automatically on pushes to `main` that change something the API image uses: the build filter (**Settings → Build Filters → Included Paths**) is `apps/api/**`, `packages/shared/**`, `package.json`, `package-lock.json`, `tsconfig.base.json`. Pushes that change only the web app or the docs don't deploy. On the free plan a deploy can leave the API unreachable for a few minutes (29 October 2026: 6 minutes, reported by UptimeRobot), which is what the filter avoids. The health check is `/api/v1/health/live`; a deploy that doesn't become healthy keeps the previous version running.
- **Limits:** the free instance sleeps after 15 minutes without traffic (UptimeRobot prevents this) and has 512 MB of memory and a share of a CPU. Free instance hours (750 a month) cover exactly one always-on service.
- **Watch:** Logs (JSON lines with a `requestId`), Events (deploys), Metrics.
- **Upgrade:** Starter plan (no sleeping, full CPU), then more instances and the worker as its own service (a ready block in `render.yaml`). Steps in [deployment.md §7](deployment.md#7-scaling-up).

## Vercel

- **Dashboard:** [vercel.com](https://vercel.com) → **ru-lost-found** (tabs: Deployments, Settings → Environment Variables, Settings → Build and Deployment).
- **What:** builds and serves the React website, adds its security headers, and rewrites `/api/*` to the Render API so the browser sees a single origin (needed for the refresh-token cookie).
- **Where:** project **`ru-lost-found`**, Root Directory **`apps/web`**, framework Vite, Node 24 (from `engines` in `apps/web/package.json`). Address: `https://ru-lost-found.vercel.app`.
- **Settings:** `VITE_SENTRY_DSN` (Environment Variables). Rewrites and headers are in `apps/web/vercel.json`.
- **Deploys:** automatically on every push to `main`; every earlier deployment can be promoted back in one click (Deployments → ⋯ → Promote to Production).
- **Watch:** Deployments (build logs), Analytics if enabled.
- **Custom domain:** Settings → Domains. If the address changes, update `APP_URL` and `CORS_ORIGINS` on Render.

## Cloudinary

- **Dashboard:** [console.cloudinary.com](https://console.cloudinary.com) → Media Library → folder **ru-lost-found**; keys under Settings → API Keys.
- **What:** stores post photos and profile pictures and delivers them through its CDN, resized and in the best format for each browser (`f_auto,q_auto,c_limit,w_1600`). The API cleans every image first (strips location data, resizes, re-encodes) and uploads with signed requests.
- **Where:** cloud name **`dowyiom8`** (owned by the project owner's GitHub sign-in). Folders `ru-lost-found/items` and `ru-lost-found/avatars` are created by the API.
- **Settings:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Settings → API Keys).
- **Housekeeping:** photos of removed posts are deleted automatically 30 days after removal (the moderation window).
- **Limits:** the free plan's monthly credits (storage + bandwidth + transformations); usage is shown on the dashboard.
- **Rotate the secret:** Settings → API Keys → generate a new key → update the two key settings on Render → delete the old key.
- **Security:** keep two-factor authentication on; this account can delete every photo on the site.
- **History:** photos uploaded before 2 October 2026 were in an earlier account (`dnr0ymudr`) that is no longer used or reachable.

## Brevo

- **Dashboard:** [app.brevo.com](https://app.brevo.com) → Transactional → Logs; keys under SMTP & API; sender under Senders, Domains & Dedicated IPs.
- **What:** sends every email: sign-up and password-reset codes (or "you already have an account"), claim notifications (new claim, approval with the handover code, decline, cancellation, expiry), likely matches for a lost post, the reminder a week before a post closes, removed-post notices and account notices (password changed, suspended, reactivated, account deleted).
- **Settings:** `BREVO_API_KEY` (SMTP & API → API Keys) and `EMAIL_FROM_ADDRESS` (a sender verified under Senders). The sender name is the brand name (`BRAND_NAME`, "RU Lost & Found") unless `EMAIL_FROM_NAME` is set.
- **Limits:** 300 emails a day on the free plan.
- **Deliverability:** with a personal address as the sender, some emails can land in spam. A domain of your own, authenticated in Brevo (SPF and DKIM), fixes this.
- **Watch:** Transactional → Logs (sent, delivered, bounced).
- **Rotate the key:** create a new API key → update Render → delete the old one.
- **Without it:** emails are printed to the API log (development); production refuses to start without it.

## Sentry

- **Dashboard:** [sentry.io](https://sentry.io) → Issues (filter by project **ru-lost-found-api** or **ru-lost-found-web**).
- **What:** records unexpected errors with their stack trace, so problems are found before users report them. Expected errors (validation, not found, rate limits) are never sent, and no personal data is collected: no cookies, headers, bodies, query strings, IP addresses or passwords in URLs.
- **Where:** two projects: **`ru-lost-found-api`** (Node.js) and **`ru-lost-found-web`** (React).
- **Settings:** `SENTRY_DSN` on Render for the API; `VITE_SENTRY_DSN` on Vercel for the website (a public value, built into the page).
- **What the API reports:** unexpected request errors (tagged with the request id), event handlers that keep failing after their retries, failed scheduled jobs, start-up failures. The website reports crashes caught by its error boundary and unhandled errors.
- **Limits:** 5,000 errors a month on the free plan.
- **Working with issues:** each alert email links to an issue; fix the cause, then mark it **Resolved** (it reopens if the error comes back).

## UptimeRobot

- **Dashboard:** [dashboard.uptimerobot.com](https://dashboard.uptimerobot.com). Two HTTP(s) monitors, each checking every 5 minutes and emailing an alert when it fails:
  - **RU Lost & Found API (up + keep awake)**, on https://ru-lost-found-api.onrender.com/api/v1/health/live: alerts when the API is down, and its regular visits stop the free Render instance from sleeping. Keep it while the API is on the free plan.
  - **RU Lost & Found API (database + Redis)**, on https://ru-lost-found-api.onrender.com/api/v1/health/ready: alerts when MongoDB or Redis can't be reached (the endpoint then answers 503). Without it a Redis outage goes unnoticed, because the API carries on with its in-memory fallback.
- **Limits:** 50 monitors at 5-minute intervals on the free plan. Each database + Redis check uses one Redis command: about 9,000 a month of Upstash's 500,000.

## GitHub

- **Repository:** https://github.com/nox-pie/RU-Lost-Found (Actions for CI runs, Pull requests for Dependabot).
- **What:** the repository `nox-pie/RU-Lost-Found`; pushes to `main` deploy Vercel, and Render when the API changes.
- **Protection:** `main` is a protected branch: a pull request can be merged only once the four CI jobs pass, and force-pushes and deleting `main` are blocked. An admin can still bypass it in an emergency (a deliberate tick box when merging).
- **Security:** Dependabot alerts (an email when a library we use has a security advisory) and secret scanning with push protection are on (Settings → Code security).
- **CI** (`.github/workflows/ci.yml`): runs on every push and pull request; its jobs are described in [backend.md §14](architecture/backend.md#continuous-integration-githubworkflowsciyml).
- **Dependabot** (`.github/dependabot.yml`): weekly grouped updates for npm (minor and patch only; major versions are upgraded by hand) and monthly for GitHub Actions. CI checks each pull request.

---

## Routine checks

Weekly, monthly and yearly upkeep (Dependabot, usage against these limits, alerts, version upgrades) is in [maintenance.md](maintenance.md).

## If a secret leaks

1. Rotate it at the provider (steps above), then update Render (and Vercel for the website setting).
2. Update the local copy in `apps/api/.env.production`.
3. For `APP_SECRET`: changing it signs everyone out and invalidates pending codes; that is the intended effect after a leak.
4. Check the activity log (Admin → Activity) and the provider's logs for misuse.
