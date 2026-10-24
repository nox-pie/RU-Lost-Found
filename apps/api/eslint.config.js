import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Type-aware: a promise that is neither awaited nor handled loses its errors silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
    },
  },
  // Layers (see docs/architecture/backend.md). Tests are exempt: they build real repositories.
  {
    files: ['src/core/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/**', '**/infrastructure/**'],
              message:
                'core is the innermost layer: it may not depend on modules or infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts', 'src/core/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'mongoose', 'mongodb', 'ioredis', 'sharp', 'cloudinary'].map(
            (name) => ({
              name,
              message: 'Domain code holds business rules only: no frameworks or SDKs.',
            }),
          ),
          patterns: [
            {
              group: ['**/infrastructure/**', '**/*.controller', '**/*.routes', '**/*.service'],
              message:
                'Domain code may not depend on infrastructure, HTTP or application services.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    ignores: ['**/*.test.ts', 'src/modules/*/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // A module name, then /infrastructure/ (src/infrastructure itself is shared).
              regex: '^(\\.\\./)+[a-z]+/infrastructure/',
              message:
                "Use another module's repository interface (its domain/), not its MongoDB implementation.",
            },
          ],
        },
      ],
    },
  },
);
