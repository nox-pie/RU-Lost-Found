// Load test (k6). Simulates a busy hour on a campus of ~10,000 students:
//   - 200 people browsing at the same time (PEAK) (feed, search, item pages, notifications, claims)
//   - new posts with a photo, claims and sign-ins arriving steadily
// Every simulated person has their own client IP (X-Forwarded-For), like real visitors.
// How to run it and the latest results: docs/load-test.md
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://api:5001/api/v1';
const USERS = 300;
const PASSWORD = 'Load-test-pass-1';
const WORDS = ['keys', 'phone', 'wallet', 'bottle', 'charger', 'umbrella', 'black', 'blue'];
const PHOTO = open('/fixtures/keys.png', 'b');
/** People browsing at the same time at the peak (`-e PEAK=1000` for a stress run). */
const PEAK = Number(__ENV.PEAK || 200);

export const options = {
  // Signing 300 people in takes a while: each sign-in is a deliberately slow password check.
  setupTimeout: '5m',
  scenarios: {
    browsing: {
      executor: 'ramping-vus',
      exec: 'browse',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: PEAK },
        { duration: '3m', target: PEAK },
        { duration: '30s', target: 0 },
      ],
    },
    posting: {
      executor: 'constant-arrival-rate',
      exec: 'post',
      rate: 1,
      timeUnit: '2s',
      duration: '4m',
      startTime: '1m',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
    claiming: {
      executor: 'constant-arrival-rate',
      exec: 'claim',
      rate: 1,
      timeUnit: '1s',
      duration: '4m',
      startTime: '1m',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
    signingIn: {
      executor: 'constant-arrival-rate',
      exec: 'signIn',
      rate: 1,
      timeUnit: '1s',
      duration: '4m',
      startTime: '1m',
      preAllocatedVUs: 5,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<1000'],
    'http_req_duration{kind:upload}': ['p(95)<2000'],
    'http_req_duration{kind:login}': ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

/** A stable, distinct "client IP" per simulated person. */
function ipOf(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

function login(n) {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: `load.user${n}@rishihood.edu.in`, password: PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipOf(100000 + n) },
      tags: { kind: 'login', name: 'POST /auth/login' },
    },
  );
  check(res, { 'signed in': (r) => r.status === 200 });
  return res.json('accessToken');
}

/** Everyone signs in once before the test (access tokens last 15 minutes). */
export function setup() {
  const tokens = [];
  for (let start = 0; start < USERS; start += 10) {
    const batch = [];
    for (let n = start; n < Math.min(start + 10, USERS); n++) {
      batch.push([
        'POST',
        `${BASE}/auth/login`,
        JSON.stringify({ email: `load.user${n}@rishihood.edu.in`, password: PASSWORD }),
        {
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipOf(200000 + n) },
          tags: { kind: 'setup' },
        },
      ]);
    }
    for (const res of http.batch(batch)) tokens.push(res.json('accessToken'));
  }
  const feed = http.get(`${BASE}/items?type=FOUND&limit=50`, {
    headers: { Authorization: `Bearer ${tokens[0]}` },
    tags: { kind: 'setup' },
  });
  return { tokens, found: feed.json('data').map((item) => ({ id: item.id })) };
}

function as(data, n, kind, name) {
  return {
    headers: {
      Authorization: `Bearer ${data.tokens[n % USERS]}`,
      'X-Forwarded-For': ipOf(n),
    },
    tags: { kind, name },
  };
}

const think = (min, max) => sleep(min + Math.random() * (max - min));

/** One person's visit: feed, an item, a search, the notification bell, their claims. */
export function browse(data) {
  const n = exec.vu.idInTest;
  const feed = http.get(`${BASE}/items?limit=12`, as(data, n, 'read', 'GET /items'));
  check(feed, { 'feed loaded': (r) => r.status === 200 });
  think(1, 3);

  const items = feed.json('data') || [];
  if (items.length > 0) {
    const item = items[Math.floor(Math.random() * items.length)];
    const page = http.get(`${BASE}/items/${item.id}`, as(data, n, 'read', 'GET /items/:id'));
    check(page, { 'item loaded': (r) => r.status === 200 });
    think(1, 3);
  }

  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const search = http.get(`${BASE}/items?q=${word}&limit=12`, as(data, n, 'read', 'GET /items?q='));
  check(search, { 'search answered': (r) => r.status === 200 });
  think(1, 2);

  const bell = http.get(`${BASE}/notifications?limit=15`, as(data, n, 'read', 'GET /notifications'));
  check(bell, { 'notifications loaded': (r) => r.status === 200 });
  const claims = http.get(
    `${BASE}/claims/mine?status=REQUESTED,APPROVED`,
    as(data, n, 'read', 'GET /claims/mine'),
  );
  check(claims, { 'claims loaded': (r) => r.status === 200 });
  think(2, 5);
}

/** Someone reports an item with a photo (resized and re-encoded by the API). */
export function post(data) {
  const n = 1000 + exec.scenario.iterationInTest;
  const res = http.post(
    `${BASE}/items`,
    {
      type: 'FOUND',
      category: 'ELECTRONICS',
      title: 'Grey power bank',
      description: 'Found on a bench outside the library.',
      location: 'Library',
      occurredOn: new Date().toISOString().slice(0, 10),
      photos: http.file(PHOTO, 'photo.png', 'image/png'),
    },
    as(data, n, 'upload', 'POST /items'),
  );
  check(res, { 'post created': (r) => r.status === 201 });
}

/**
 * Someone claims a found item. Expected refusals count as answers, not failures: claiming your
 * own post (403) and a second claim on the same item (409).
 */
export function claim(data) {
  const n = 5000 + exec.scenario.iterationInTest;
  const item = data.found[n % data.found.length];
  const params = as(data, n, 'write', 'POST /items/:id/claims');
  params.responseCallback = http.expectedStatuses(201, 403, 409);
  const res = http.post(
    `${BASE}/items/${item.id}/claims`,
    JSON.stringify({ message: 'I think this is mine.' }),
    { ...params, headers: { ...params.headers, 'Content-Type': 'application/json' } },
  );
  check(res, { 'claim answered': (r) => [201, 403, 409].includes(r.status) });
}

/** Someone signs in (bcrypt with cost 12: deliberately slow to guess, so the costliest call). */
export function signIn() {
  login(exec.scenario.iterationInTest % USERS);
}
