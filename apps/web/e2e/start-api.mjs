// Starts everything the end-to-end tests need behind the web app: an in-memory MongoDB replica
// set, the seed data, and the real API (with its background worker). Emails are written as JSON
// files to e2e/.emails so tests can read sign-up codes, like a local mail catcher.
import { spawn, execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { E2E_API_PORT, E2E_WEB_PORT } from './ports.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '../../api');
export const EMAIL_DIR = path.join(here, '.emails');
/** Lets tests run API scripts (e.g. set-role) against the same database. */
const RUNTIME_FILE = path.join(here, '.runtime.json');

rmSync(EMAIL_DIR, { recursive: true, force: true });
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(E2E_API_PORT),
  LOG_LEVEL: 'warn',
  MONGODB_URI: mongo.getUri('ru-lost-found-e2e'),
  APP_SECRET: 'e2e-secret-that-is-at-least-32-characters',
  BCRYPT_ROUNDS: '4',
  DEV_EMAIL_DIR: EMAIL_DIR,
  CORS_ORIGINS: `http://localhost:${E2E_WEB_PORT}`,
  APP_URL: `http://localhost:${E2E_WEB_PORT}`,
  // Sample posts and one-click demo sign-in, as on the live site.
  DEMO_MODE: 'true',
};

execFileSync('npx', ['tsx', 'src/scripts/seed.ts'], { cwd: apiDir, env, stdio: 'inherit' });
writeFileSync(
  RUNTIME_FILE,
  JSON.stringify({ MONGODB_URI: env.MONGODB_URI, APP_SECRET: env.APP_SECRET }),
);
const api = spawn('npx', ['tsx', 'src/main.ts'], { cwd: apiDir, env, stdio: 'inherit' });

async function stop() {
  api.kill('SIGTERM');
  rmSync(RUNTIME_FILE, { force: true });
  await mongo.stop();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
api.on('exit', async (code) => {
  await mongo.stop();
  process.exit(code ?? 1);
});
