# Load test

**Question:** can one API instance serve a campus of about 10,000 students on a busy day, and where does it stop coping?

**Answer:** yes, with a lot of room. At 200 people using the site at the same moment, 95% of page reads took under 8 ms and no request failed. One instance kept working without a single error up to 1,000 simultaneous users (~360 requests/second), but there it runs flat out: most requests stay fast, while the slowest ones wait from a fraction of a second up to a few seconds. That is the point to add a second instance ([deployment.md §7](deployment.md#7-scaling-up)).

Last measured on 22 October 2026, on the code with post expiry, campus places, matching, the desk working as a team and insights (Part 2).

The test also found and fixed one real problem: password checks were blocking the server (see "What the test changed").

## Method

- **Tool:** [k6](https://k6.io) 2.3 (`load/load-test.js`), run in Docker next to the stack from `docker-compose.yml` (API, MongoDB replica set, Redis), with the production password cost (bcrypt 12) and request logging on.
- **Data:** 300 accounts and 600 posts (`load/seed-load-data.mts`), half of them at a campus place.
- **Every simulated person has their own client IP**, like real visitors. From a single IP, the per-IP rate limits would (correctly) stop the test.
- **Machine:** Apple M2, 8 GB (Docker: 8 CPUs, 4 GB). The API is one Node.js process.
- **Demo data off** (`load/compose.load.yml`), so every run starts from the same data.

| Scenario   | What it does                                                                                                                         | Rate                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Browsing   | Feed → an item → a search → notifications → my claims, with 1–5 s pauses like a person                                               | Ramps to 200 people (stress run: 1,000), held 3 min |
| Posting    | Reports a found item at a campus place with a photo (decoded, resized, re-encoded); each one is also matched against open lost posts | 1 every 2 s                                         |
| Claiming   | Claims a found item (a repeat claim is an expected 409)                                                                              | 1 per second                                        |
| Signing in | Email + password                                                                                                                     | 1 per second                                        |

Why 200: if about 2% of 10,000 students are active in the same minute at the busiest time of day, that's 200. Each one makes a request every few seconds, so ~80 requests/second.

## Results

**Target load: 200 simultaneous users, 5½ minutes, 27,553 requests (81/s)**

| Request type                                      | Median | 95th percentile | Target (p95) |
| ------------------------------------------------- | ------ | --------------- | ------------ |
| Reads (feed, item, search, notifications, claims) | 2.2 ms | **7.3 ms**      | < 300 ms ✓   |
| Writes (claims)                                   | 14 ms  | **33 ms**       | < 1,000 ms ✓ |
| Posts with a photo                                | 20 ms  | **46 ms**       | < 2,000 ms ✓ |
| Sign-in                                           | 384 ms | **415 ms**      | < 2,000 ms ✓ |
| Failed requests                                   |        | **0**           | < 1% ✓       |

Sign-in is slow on purpose: bcrypt with cost 12 makes every password guess expensive for an attacker. It no longer slows anything else down (below).

**Stress: 1,000 simultaneous users, two runs (about 121,000 and 127,000 requests, 350–365/s)**

| Request type       | Median       | 90th percentile | 95th percentile |
| ------------------ | ------------ | --------------- | --------------- |
| Reads              | 3.7 – 5.5 ms | 98 – 307 ms     | 0.2 – 0.9 s     |
| Writes             | 23 – 34 ms   | 0.23 – 1.5 s    | 0.5 – 3.4 s     |
| Posts with a photo | 41 – 55 ms   | 0.3 – 1.6 s     | 0.7 – 4.0 s     |
| Failed requests    |              |                 | **0**           |

Nothing failed, and the typical request stays fast, but one Node.js process is now saturated (its container at 110–190% CPU, the database at 30–50%), so requests queue behind each other and the slowest ones wait. At saturation the waiting times scatter widely from one run to the next, so the table gives both runs.

**Part 2 didn't make requests more expensive.** Compared with the code before Part 2 on the same machine: at 200 users, both spend the same CPU per request (1.85 s of API time per 1,000 requests) and answer just as fast. At 1,000 users the earlier code also scattered between runs (95th percentile of reads 58 ms and 154 ms); it reached saturation a little later. MongoDB's slow-query log during a stress run had only 8 queries over 50 ms, all using an index. (The stress run of 18 October, on older code and an older k6, had a 95th percentile of 55 ms for reads and 197 ms for writes.)

## What the test changed

The first run failed its read target (p95 355 ms), and every write took at least 430 ms. The cause: password hashing used `bcryptjs`, a pure-JavaScript bcrypt that does its ~0.5 s of work on Node's main thread, so **every request that arrived during a sign-in waited for it**. Switching the `PasswordHasher` implementation to the native `bcrypt` library (same hash format, runs on libuv's thread pool) gave:

|                         | Before | After (same day) |
| ----------------------- | ------ | ---------------- |
| Reads, p95              | 355 ms | 8 ms             |
| Writes, p95             | 601 ms | 36 ms            |
| Posts with a photo, p95 | 693 ms | 58 ms            |

Only one class changed (`BcryptPasswordHasher`), because the rest of the code depends on the `PasswordHasher` interface. A unit test checks that hashes made by bcryptjs (`$2b$` and `$2a$`) still verify, so no existing password broke.

## What this means in production

- **Free tier:** Render's free instance has a fraction of a CPU, so expect several times less headroom than these numbers. That is still above the expected 80 requests/second at peak for reads, but sign-ins (about 0.4 s of CPU each) would be the first thing to queue. The first upgrade is Render Starter (a full instance, no sleeping).
- **Scaling out:** the API keeps no state in memory between requests (sessions, codes, rate limits and job leases are in MongoDB and Redis), so more instances behind Render's load balancer add capacity directly. The background worker can move to its own process (`dist/worker.js`, `WORKER_ENABLED=false` on the API). Steps: [deployment.md §7](deployment.md#7-scaling-up).
- **Don't run this against production on free tiers:** a 5-minute run makes tens of thousands of Redis commands, a large share of Upstash's free 500,000 a month, and would trip the real rate limits.

## Running it

```bash
docker compose -f docker-compose.yml -f load/compose.load.yml up -d --build
MONGODB_URI='mongodb://127.0.0.1:27018/ru-lost-found-v2?directConnection=true' npx tsx load/seed-load-data.mts
docker compose -f docker-compose.yml -f load/compose.load.yml run --rm k6              # 200 people
PEAK=1000 docker compose -f docker-compose.yml -f load/compose.load.yml run --rm k6    # stress
docker compose -f docker-compose.yml -f load/compose.load.yml down -v
```

The summary is saved to `load/results/summary.json` (not committed).
