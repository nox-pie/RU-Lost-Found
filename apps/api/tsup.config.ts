import { defineConfig } from 'tsup';

export default defineConfig({
  // The server, the standalone worker, and the operations scripts (run with plain `node` in
  // production, where dev tools such as tsx aren't installed).
  entry: {
    main: 'src/main.ts',
    worker: 'src/worker.ts',
    'scripts/seed': 'src/scripts/seed.ts',
    'scripts/set-role': 'src/scripts/set-role.ts',
    'scripts/migrate-legacy': 'src/scripts/migrate-legacy.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared workspace package ships TypeScript source, so bundle it into the output.
  noExternal: ['@ru-lost-found/shared'],
});
