/**
 * The parts of Sentry the app uses, loaded on demand by monitoring.ts. Naming them here, instead
 * of importing the whole package, lets the build leave the rest out (session replay included).
 */
export { captureException, init } from '@sentry/react';
