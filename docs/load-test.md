# Load test

**Question:** can one API instance serve a campus of about 10,000 students on a busy day, and where does it stop coping?

**Answer:** yes, with a lot of room. At 200 people using the site at the same moment, 95% of page reads took under 9 ms and no request failed. One instance kept working without a single error up to 1,000 simultaneous users (~360 requests/second); beyond roughly 300 requests/second the slowest requests start to wait, which is the point to add a second instance.

The test also found and fixed one real problem: password checks were blocking the server (see "What the test changed").

## Method

- **Tool:** [k6](https://k6.io) (`load/load-test.js`), run in Docker next to the stack from `docker-compose.yml` (API, MongoDB replica set, Redis), with the production password cost (bcrypt 12) and request logging on.
- **Data:** 300 accounts and 600 posts (`load/seed-load-data.mts`).
- **Every simulated person has their own client IP**, like real visitors. From a single IP, the per-IP rate limits would (correctly) stop the test.
- **Machine:** Apple M2, 8 GB (Docker: 8 CPUs, 4 GB). The API is one Node.js process.

| Scenario   | What it does                                                                           | Rate                                                |
| ---------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Browsing   | Feed → an item → a search → notifications → my claims, with 1–5 s pauses like a person | Ramps to 200 people (stress run: 1,000), held 3 min |
| Posting    | Reports an item with a photo (decoded, resized, re-encoded)                            | 1 every 2 s                                         |
| Claiming   | Claims a found item (a repeat claim is an expected 409)                                | 1 per second                                        |
| Signing in | Email + password                                                                       | 1 per second                                        |

Why 200: if about 2% of 10,000 students are active in the same minute at the busiest time of day, that's 200. Each one makes a request every few seconds, so ~80 requests/second.

## Results

**Target load: 200 simultaneous users, 5½ minutes, 27,398 requests (80/s)**

| Request type                                      | Median | 95th percentile | Target (p95) |
| ------------------------------------------------- | ------ | --------------- | ------------ |
| Reads (feed, item, search, notifications, claims) | 2.3 ms | **8.3 ms**      | < 300 ms ✓   |
| Writes (claims)                                   | 14 ms  | **36 ms**       | < 1,000 ms ✓ |
| Posts with a photo                                | 18 ms  | **58 ms**       | < 2,000 ms ✓ |
| Sign-in                                           | 386 ms | **431 ms**      | < 2,000 ms ✓ |
| Failed requests                                   |        | **0**           | < 1% ✓       |

Sign-in is slow on purpose: bcrypt with cost 12 makes every password guess expensive for an attacker. It no longer slows anything else down (below).

**Stress: 1,000 simultaneous users, 123,978 requests (360/s)**

| Request type       | Median | 90th percentile | 95th percentile |
| ------------------ | ------ | --------------- | --------------- |
| Reads              | 3.4 ms | 124 ms          | 461 ms          |
| Writes             | 21 ms  | 533 ms          | 2.2 s           |
| Posts with a photo | 34 ms  | 696 ms          | 2.5 s           |
| Failed requests    |        |                 | **0**           |

Nothing failed, but the slowest 10% of requests now queue: a single Node.js process is near its limit. API memory stayed at about 270 MB.

## What the test changed

The first run failed its read target (p95 355 ms), and every write took at least 430 ms. The cause: password hashing used `bcryptjs`, a pure-JavaScript bcrypt that does its ~0.5 s of work on Node's main thread, so **every request that arrived during a sign-in waited for it**. Switching the `PasswordHasher` implementation to the native `bcrypt` library (same hash format, runs on libuv's thread pool) gave:

|                         | Before | After |
| ----------------------- | ------ | ----- |
| Reads, p95              | 355 ms | 8 ms  |
| Writes, p95             | 601 ms | 36 ms |
| Posts with a photo, p95 | 693 ms | 58 ms |

Only one class changed (`BcryptPasswordHasher`), because the rest of the code depends on the `PasswordHasher` interface. A unit test checks that hashes made by the first version (bcryptjs, `$2b$` and `$2a$`) still verify, so nobody's password broke.

## What this means in production

- **Free tier:** Render's free instance has a fraction of a CPU, so expect several times less headroom than these numbers. That is still above the expected 80 requests/second at peak for reads, but sign-ins (about 0.4 s of CPU each) would be the first thing to queue. The first upgrade is Render Starter (a full instance, no sleeping).
- **Scaling out:** the API keeps no state in memory between requests (sessions, codes, rate limits and job leases are in MongoDB and Redis), so more instances behind Render's load balancer add capacity directly. The background worker can move to its own process (`dist/worker.js`, `WORKER_ENABLED=false` on the API).
- **Don't run this against production on free tiers:** a 5-minute run makes tens of thousands of Redis commands, several times Upstash's free daily allowance, and would trip the real rate limits.

## Running it

```bash
docker compose -f docker-compose.yml -f load/compose.load.yml up -d --build
MONGODB_URI='mongodb://127.0.0.1:27018/ru-lost-found-v2?directConnection=true' npx tsx load/seed-load-data.mts
docker compose -f docker-compose.yml -f load/compose.load.yml run --rm k6              # 200 people
PEAK=1000 docker compose -f docker-compose.yml -f load/compose.load.yml run --rm k6    # stress
docker compose -f docker-compose.yml -f load/compose.load.yml down -v
```

The summary is saved to `load/results/summary.json` (not committed).
