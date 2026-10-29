// Checks the built app (dist/) for code that should never reach visitors. Run after `vite build`
// (CI does): each rule names what it catches and why, and the check fails if any file has it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist/assets');

const RULES = [
  {
    what: "Sentry's session replay recorder (rrweb)",
    why: 'the app never records sessions; importing all of @sentry/react pulls it in (about 100 KB compressed)',
    pattern: /rrweb/,
  },
];

const files = readdirSync(ASSETS).filter((file) => file.endsWith('.js'));
let failed = false;
for (const rule of RULES) {
  const found = files.filter((file) =>
    rule.pattern.test(readFileSync(path.join(ASSETS, file), 'utf8')),
  );
  if (found.length > 0) {
    failed = true;
    console.error(`✗ ${rule.what} is in ${found.join(', ')}: ${rule.why}.`);
  } else {
    console.log(`✓ no ${rule.what}`);
  }
}
const largest = files
  .map((file) => ({ file, kb: statSync(path.join(ASSETS, file)).size / 1024 }))
  .sort((a, b) => b.kb - a.kb)
  .slice(0, 3)
  .map(({ file, kb }) => `${file} ${kb.toFixed(0)} KB`);
console.log(`Largest scripts: ${largest.join(', ')}`);
process.exit(failed ? 1 : 0);
