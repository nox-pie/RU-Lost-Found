/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry project DSN; error tracking is off when absent. */
  readonly VITE_SENTRY_DSN?: string;
  /** Version tag on error reports (the Git commit on Vercel). */
  readonly VITE_RELEASE?: string;
}
