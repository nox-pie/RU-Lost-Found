import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/testing/globalSetup.ts'],
    env: { NODE_ENV: 'test' },
    // Starting MongoDB and building indexes can exceed the 5s default on a cold machine.
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      // The build fails if coverage drops below these (set just under the current numbers).
      thresholds: { statements: 93, branches: 84, functions: 95, lines: 95 },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/testing/**',
        'src/main.ts',
        'src/worker.ts',
        'src/scripts/**',
      ],
    },
  },
});
