# External services

Every service the product runs on: what it does, how it is connected, what to watch and how to change or replace it. All of them are on a free plan. Setting **names** are listed here; the values live in the hosting dashboards and in the git-ignored local copies described in [deployment.md](deployment.md#where-configuration-lives). No secret belongs in this file.

## Overview

| Service                         | Role                                                    | Plan             | Where to find it                                                                                                         | Connected through                                                                                                |
| ------------------------------- | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [MongoDB Atlas](#mongodb-atlas) | The database                                            | M0 (free)        | [cloud.mongodb.com](https://cloud.mongodb.com) → cluster **Lost-and-Found** → database **ru-lost-found-v2**              | Setting `MONGODB_URI` (Render)                                                                                   |
| [Upstash Redis](#upstash-redis) | One-time codes, rate limits, login throttle, job leases | Free             | [console.upstash.com](https://console.upstash.com) → Redis → database **ru-lost-found** (Singapore)                      | Setting `REDIS_URL` (Render)                                                                                     |
| [Render](#render)               | Runs the API (and its background worker)                | Free web service | [dashboard.render.com](https://dashboard.render.com) → service **ru-lost-found-api**                                     | Deploys from GitHub `main` using `render.yaml`; API address https://ru-lost-found-api.onrender.com               |
| [Vercel](#vercel)               | Serves the website, forwards `/api` to Render           | Hobby (free)     | [vercel.com](https://vercel.com) → project **ru-lost-found**                                                             | Deploys from GitHub `main` (root `apps/web`) using `apps/web/vercel.json`; site https://ru-lost-found.vercel.app |
| [Cloudinary](#cloudinary)       | Stores and delivers photos                              | Free             | [console.cloudinary.com](https://console.cloudinary.com) → cloud **dowyiom8** → Media Library → folder **ru-lost-found** | Settings `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Render)                         |
| [Brevo](#brevo)                 | Sends email                                             | Free             | [app.brevo.com](https://app.brevo.com) → Transactional (logs), SMTP & API (keys), Senders                                | Settings `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS` (Render)                                                          |
| [Sentry](#sentry)               | Error tracking (API and website)                        | Developer (free) | [sentry.io](https://sentry.io) → projects **ru-lost-found-api** and **ru-lost-found-web**                                | Settings `SENTRY_DSN` (Render) and `VITE_SENTRY_DSN` (Vercel)                                                    |
| [UptimeRobot](#uptimerobot)     | Uptime alerts; keeps the free API awake                 | Free             | [dashboard.uptimerobot.com](https://dashboard.uptimerobot.com) → monitor **RU Lost & Found API**                         | HTTP(s) monitor on https://ru-lost-found-api.onrender.com/api/v1/health/live every 5 minutes                     |
| [GitHub](#github)               | Code, CI, dependency updates                            | Free             | https://github.com/nox-pie/RU-Lost-Found → Actions (CI), Pull requests (Dependabot)                                      | Render and Vercel deploy every push to `main`                                                                    |

Each provider sits behind an interface in the code (`StorageProvider`, `EmailSender`, `KeyValueStore`, `ErrorReporter`, …), so replacing one means a new adapter and a line in `apps/api/src/container.ts`. Business code doesn't change.

---

## MongoDB Atlas

- **Dashboard:** [cloud.mongodb.com](https://cloud.mongodb.com) → cluster **Lost-and-Found** → Browse Collections → **ru-lost-found-v2**.
- **What:** all data: universities, users, sessions, posts, claims, notifications, moderation reports, the audit log and the outbox of pending events. Transactions (claim + item + events saved together) need a replica set, which every Atlas cluster is.
- **Where:** project with the cluster **`Lost-and-Found`** (M0, AWS Mumbai `ap-south-1`). The app's database is **`ru-lost-found-v2`**; it creates its collections and indexes itself on start-up.
- **Setting:** `MONGODB_URI` (connection string ending in `/ru-lost-found-v2`), in Render and in `apps/api/.env.production`.
- **Access:** Database Access has the app's user (read and write). Network Access allows `0.0.0.0/0` because Render's free tier has no fixed outgoing IP; the password is the protection.
- **Limits:** 512 MB storage and shared CPU. Photos are not stored here (Cloudinary), so this lasts a long time. Old data is pruned automatically: delivered events after 7 days, notifications after 180 days, ended sessions when they expire, audit entries after a year.
- **Watch:** Clusters → Metrics (storage, connections).
- **Backups:** M0 has no automatic backups. Before risky changes, export with `mongodump` (MongoDB Database Tools) using the connection string.
- **Rotate the password:** Database Access → Edit user → new password → update `MONGODB_URI` in Render (redeploys) and in `apps/api/.env.production`.
- **Upgrade:** M10+ adds backups, more storage and Atlas Search (better text search).

## Upstash Redis

- **Dashboard:** [console.upstash.com](https://console.upstash.com) → Redis → **ru-lost-found**.
- **What:** short-lived shared state: one-time codes (stored as a hash, 10 minutes), rate-limit counters, failed-login counters and the leases that make each scheduled job run on one instance only. Losing it is harmless: codes must be requested again and counters restart.
- **Where:** database **`ru-lost-found`**, region **AP-Southeast-1 (Singapore)**, next to the API.
- **Setting:** `REDIS_URL`, which must start with `rediss://` (encrypted). The API refuses anything else at start-up.
- **Limits:** the free plan has a command allowance and a size limit (see the database's **Usage** page). Each write request uses about one command for its rate limit; reads aren't counted.
- **Watch:** Usage page (commands per day).
- **Rotate the password:** database page → reset credentials → copy the new `rediss://…` URL into Render.
- **Without it:** the API keeps the same data in memory (fine for one instance; never in production).

## Render

- **Dashboard:** [dashboard.render.com](https://dashboard.render.com) → **ru-lost-found-api** (tabs: Logs, Events, Environment, Metrics).
- **What:** runs the API as a Docker container built from `apps/api/Dockerfile`, with the background worker (notifications, emails, scheduled jobs) in the same process.
- **Where:** web service **`ru-lost-found-api`** (region Singapore, free plan), created from `render.yaml`. URL: `https://ru-lost-found-api.onrender.com`. Visitors never call it directly; Vercel forwards `/api`.
- **Settings:** every API setting is under the service's **Environment** tab (the source of truth). Notable non-secret ones: `NODE_ENV=production`, `TRUST_PROXY_HOPS=4`, `APP_URL`, `CORS_ORIGINS`, `ADMIN_EMAILS`, `WORKER_ENABLED`.
- **Deploys:** automatically on every push to `main`. The health check is `/api/v1/health/live`; a deploy that doesn't become healthy keeps the previous version running.
- **Limits:** the free instance sleeps after 15 minutes without traffic (UptimeRobot prevents this) and has 512 MB of memory and a share of a CPU. Free instance hours (750 a month) cover exactly one always-on service.
- **Watch:** Logs (JSON lines with a `requestId`), Events (deploys), Metrics.
- **Upgrade:** Starter plan (no sleeping, full CPU), then run `dist/worker.js` as a separate background worker with `WORKER_ENABLED=false` on the API.

## Vercel

- **Dashboard:** [vercel.com](https://vercel.com) → **ru-lost-found** (tabs: Deployments, Settings → Environment Variables, Settings → Build and Deployment).
- **What:** builds and serves the React website, adds its security headers, and rewrites `/api/*` to the Render API so the browser sees a single origin (needed for the refresh-token cookie).
- **Where:** project **`ru-lost-found`**, Root Directory **`apps/web`**, framework Vite, Node 22. Address: `https://ru-lost-found.vercel.app`.
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
- **What:** sends every email: sign-up and password-reset codes, claim notifications (new claim, approval with the handover code, decline, cancellation, expiry), removed-post notices and account notices (password changed, suspended, reactivated).
- **Settings:** `BREVO_API_KEY` (SMTP & API → API Keys) and `EMAIL_FROM_ADDRESS` (a sender verified under Senders). The sender name defaults to "RU Lost & Found" (`EMAIL_FROM_NAME`).
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

- **Dashboard:** [dashboard.uptimerobot.com](https://dashboard.uptimerobot.com) → monitor **RU Lost & Found API** (HTTP(s), every 5 minutes, URL https://ru-lost-found-api.onrender.com/api/v1/health/live).
- **What:** checks https://ru-lost-found-api.onrender.com/api/v1/health/live every 5 minutes. It emails an alert when the API is down, and its regular visits stop the free Render instance from sleeping.
- **Also useful:** https://ru-lost-found-api.onrender.com/api/v1/health/ready reports whether MongoDB and Redis are reachable (for an alert-only monitor).
- **Limits:** 50 monitors at 5-minute intervals on the free plan.

## GitHub

- **Repository:** https://github.com/nox-pie/RU-Lost-Found (Actions for CI runs, Pull requests for Dependabot).
- **What:** the repository `nox-pie/RU-Lost-Found`; pushes to `main` deploy both Render and Vercel.
- **CI** (`.github/workflows/ci.yml`): on every push and pull request: API (typecheck, lint, formatting, tests with coverage, build), web (typecheck, lint, build), end-to-end tests in a real browser, and Docker image builds.
- **Dependabot** (`.github/dependabot.yml`): weekly grouped updates for npm (minor and patch only; major versions are upgraded by hand) and monthly for GitHub Actions. CI checks each pull request.

---

## Routine checks (about 10 minutes a week)

- [ ] Sentry: new issues in either project.
- [ ] UptimeRobot: any downtime.
- [ ] Usage against free limits: Render hours, Upstash commands, Brevo emails, Cloudinary credits, Atlas storage.
- [ ] GitHub: merge or close Dependabot pull requests.

## If a secret leaks

1. Rotate it at the provider (steps above), then update Render (and Vercel for the website setting).
2. Update the local copy in `apps/api/.env.production`.
3. For `APP_SECRET`: changing it signs everyone out and invalidates pending codes; that is the intended effect after a leak.
4. Check the activity log (Admin → Activity) and the provider's logs for misuse.
