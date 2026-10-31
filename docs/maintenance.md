# Maintenance

How to keep the portal healthy and up to date once it runs: what to do every week, month and year, how to handle updates and alerts, and where to look when something breaks. It assumes the setup in [deployment.md](deployment.md) and the services in [services.md](services.md). The launch itself is in the [launch checklist](launch-checklist.md).

Expect about 15 minutes a week and an hour a month.

## At a glance

| How often           | What                                                                  | Section                                         |
| ------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| Weekly              | Dependabot pull requests; Sentry, UptimeRobot and flagged posts       | [Every week](#every-week)                       |
| When an alert comes | A security advisory or a secret-scanning alert from GitHub            | [Security alerts](#security-alerts)             |
| Monthly             | Backup restore test; usage against the free plans                     | [Every month](#every-month)                     |
| Every 3 to 6 months | Major library versions, by hand                                       | [Major upgrades](#major-upgrades)               |
| Yearly              | Node and MongoDB versions, legal pages, campus places, who has access | [Every year](#every-year)                       |
| When needed         | Something is down or wrong                                            | [When something breaks](#when-something-breaks) |
| After a long break  | Getting the project running and checked again                         | [Coming back to it](#coming-back-after-a-break) |

## Every week

### Dependabot pull requests

Dependabot (`.github/dependabot.yml`) opens pull requests every week for npm and every month for GitHub Actions. It groups minor and patch updates into one `production` and one `development` pull request, and never proposes major versions (those are done by hand, see [Major upgrades](#major-upgrades)). CI runs on each one.

1. **CI green:** read the list of updated packages in the pull request. For minor and patch versions, a green CI is enough. Merge it (**Create a merge commit**). `main` deploys to Vercel on its own, and to Render too, because npm updates change `package-lock.json` (Render's build filter, [services.md](services.md#render)): the API is then unreachable for a few minutes while it restarts.
2. **CI red:** GitHub won't let you merge (`main` requires the four CI jobs to pass). Open the failed job's log:
   - a test or type error means one update changed behaviour: find the package in the list, read its release notes, and fix the code on the Dependabot branch or in a new pull request;
   - a failed `npm audit` step means a new advisory, not the update itself: see [Security alerts](#security-alerts);
   - a network or Docker Hub error is temporary: re-run the job.

   If it can wait, close the pull request: Dependabot proposes the updates again next week.

3. **After merging:** check the live site (below).

**Checking the live site after any merge** (about two minutes):

- https://ru-lost-found-api.onrender.com/api/v1/health/ready answers `"status":"ok"`. If the merge changed the API (Render → Events shows a new deploy), wait until it says "Deploy live"; until then the API doesn't answer. Web-only and docs-only merges don't deploy the API.
- https://ru-lost-found.vercel.app loads, and signing in works.
- Sentry shows no new issues in the next hour.

If the deploy broke something, roll back first and fix after (see [When something breaks](#when-something-breaks)).

### Quick health look

- **Sentry:** new issues in `ru-lost-found-api` or `ru-lost-found-web`. Fix the cause, then mark the issue **Resolved**.
- **UptimeRobot:** any downtime this week on either monitor (up + keep awake, database + Redis).
- **Admin → Reports:** flagged posts waiting for a decision (the admin overview shows the count).

## Security alerts

GitHub raises two kinds of alert, under the repository's **Security** tab. Both also arrive by email.

### A vulnerable library (Dependabot alert, or CI's `npm audit` step fails)

1. Read the advisory: which package, which versions are affected and fixed, and whether the live API uses it (`npm ls <package>` shows who pulls it in). CI checks only the libraries production runs (`npm audit --omit=dev --audit-level=high`).
2. On a new branch from `main`, from the project folder:

   ```bash
   npm audit fix          # updates within the allowed ranges; never use --force
   npm ci                 # puts back a complete install, so the tests can run
   npm run check
   ```

   Don't run `npm audit fix --omit=dev`: it removes the development tools from `node_modules`, and the tests then fail to start (`npm ci` repairs it).

3. Open a pull request, merge once CI is green, and check the live site.
4. If the fix exists only in a new major version, plan it as a [major upgrade](#major-upgrades), sooner rather than later. Until then, judge the real exposure: the API limits request bodies to 100 KB, uploads to 3 photos of 5 MB each, and arrays in requests to a few items, which blunts most denial-of-service advisories.

### A secret in the code (secret-scanning alert)

1. Open the alert: it shows the file, line and commit.
2. **A real secret** (it matches a value in Render, Vercel or `apps/api/.env.production`): rotate it right away, as [services.md](services.md#if-a-secret-leaks) describes. Deleting it from the code isn't enough, because it stays in the git history. Then close the alert as **Revoked**.
3. **A made-up example** in a test or a doc: close the alert as **Used in tests**, and change the example to a reserved domain (`example.net`, `example.invalid`) so scanners stop matching it.

## Every month

- **Backups:** check the latest backup exists, and restore it into a scratch database or cluster, as [launch-checklist.md §3](launch-checklist.md#3-a-week-before-data-safety) describes. A backup nobody has restored is only a hope.
- **Usage against the free plans** (each dashboard's usage page, limits in [services.md](services.md)):

  | Service    | Limit                                    | When to act                                         |
  | ---------- | ---------------------------------------- | --------------------------------------------------- |
  | Atlas      | 512 MB storage (M0)                      | Above 400 MB: a bigger plan, see deployment.md §7   |
  | Upstash    | Monthly command allowance                | Above 80% of it                                     |
  | Brevo      | 300 emails a day                         | Days close to 300: a paid plan                      |
  | Cloudinary | Monthly credits                          | Above 80% of them                                   |
  | Render     | 750 instance hours a month, one instance | Sign-ins feel slow: Starter                         |
  | Sentry     | 5,000 errors a month                     | Far before that: something is broken, fix the cause |

- **Admin → Activity:** skim for anything odd (many failed sign-ins from one address, role changes nobody remembers).

## Major upgrades

Dependabot skips major versions on purpose: they change APIs and need code changes. List what is waiting:

```bash
npm outdated
```

Rows where **Latest** is a new major version (the first number) are candidates. Every 3 to 6 months, or when a security fix needs one, upgrade them as their own piece of work:

- One branch and pull request per area (for example: API libraries, web libraries, tooling), each with its library's migration guide at hand.
- All checks and the end-to-end tests must pass. For web libraries, compare the landing page's Lighthouse score before and after (see [frontend.md](architecture/frontend.md)).
- Never in launch week or exam season, when students rely on the portal most.

The October 2026 upgrade milestone is a worked example: pull requests #33 to #39 (Zod 4, Node 24, API libraries, React 19, tooling); @hookform/resolvers 6 followed once its optional dependencies installed cleanly.

**Waiting, as of October 2026:**

- **TypeScript 7:** once typescript-eslint supports it (it supports up to 6.0 today; check its release notes).
- **@types/node 26:** together with Node 26 (below), never ahead of the Node version that runs.

## Every year

- **Node.js:** the project runs Node 24, which gets security fixes until **30 April 2028**. Move to the next even-numbered version (Node 26, long-term support from October 2026) well before then. The version is set in `.nvmrc` (CI and local), the `node:24` images in both Dockerfiles (Render), `engines` in `apps/web/package.json` (Vercel), `engines` in the root `package.json`, and the `target` in `apps/api/tsup.config.ts`. `git show 16116b5 --stat` lists every file the move to Node 24 touched.
- **MongoDB:** Atlas emails ahead of version changes and end-of-life dates; the cluster's overview shows the version it runs (8.0 in October 2026). Keep the tests on that same version: `MONGOMS_VERSION` in `.github/workflows/ci.yml`, `config.mongodbMemoryServer.version` in `apps/api/package.json` and `apps/web/package.json`, and the `mongo:` image in `docker-compose.yml` and the README.
- **Privacy policy and terms:** reread both, and change the `updated` date in `apps/web/src/features/legal/` when the text changes.
- **Campus places:** new buildings or renamed ones go in `apps/api/seed/universities.json`; after merging, apply them with `npx tsx --env-file=.env.production src/scripts/seed.ts` from `apps/api`. Existing posts keep the place they were posted with.
- **Who has access:** in Admin → People, check the admins and security desk staff are still the right people, and change the roles of anyone who left. Check the same for the service dashboards (Render, Vercel, Atlas and the others) and the GitHub repository.
- **Contact address:** the footer and legal pages show `brand.contactEmail` (`apps/web/src/brand/brand.config.ts`). Make sure someone still reads it.
- **Secrets:** they don't expire, and changing `APP_SECRET` signs everyone out, so rotate keys only after a leak or when someone with access leaves ([services.md](services.md#if-a-secret-leaks)).

## When something breaks

| What you see                                        | Look at                                              | What to do                                                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A deploy broke the site                             | Render → Events, Vercel → Deployments                | **Rollback** to the previous deploy in each dashboard, then fix forward with a pull request                                                                                              |
| "Waking up the server" for long, or the API is down | UptimeRobot, Render → Logs, `/api/v1/health/ready`   | `mongodb: down`: Atlas status and network access; `redis: down`: the API keeps working without it; no answer at all: Render's status page, then **Manual Deploy → Deploy latest commit** |
| Sign-up codes don't arrive                          | Brevo → Transactional → Logs                         | Daily limit reached, the sender blocked, or the mail in spam (see the launch checklist's sender domain)                                                                                  |
| Photos don't upload or show                         | Sentry, Cloudinary usage                             | Credits used up, or a changed Cloudinary key on Render                                                                                                                                   |
| Many errors after a change                          | Sentry → Issues (each shows the release, the commit) | Roll back if users are affected, then fix                                                                                                                                                |
| Data deleted or damaged                             | Admin → Activity, Atlas                              | Restore from a backup ([launch-checklist.md](launch-checklist.md#if-something-goes-wrong)); anything written after it is lost, so tell the people affected                               |
| A secret leaked                                     | The alert or the place it appeared                   | [services.md](services.md#if-a-secret-leaks)                                                                                                                                             |

## Coming back after a break

After weeks or months away, before changing anything:

1. **The services:** free plans can pause accounts nobody uses. Sign in to each dashboard in [services.md](services.md); if one paused something, it says why and how to resume.
2. **The code**, from the project folder:

   ```bash
   git checkout main && git pull
   nvm install          # the Node version in .nvmrc
   npm ci
   npm run check        # typecheck, lint, formatting, tests
   npm run e2e          # the browser tests
   ```

   For the local database and dev servers, follow "Running it locally" in the [README](../README.md#running-it-locally).

3. **What piled up:** open Dependabot pull requests (merge the oldest first, or close them all and let Dependabot propose fresh ones), the Security tab, and `npm outdated` for major versions.
4. **The live site:** the checks after a merge, [above](#every-week).
