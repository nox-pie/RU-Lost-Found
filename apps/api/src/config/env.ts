import { z } from 'zod';

const commaSeparatedList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

/** "#e63946": safe to place inside an HTML style attribute. */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex colour like #e63946');

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a MongoDB connection string'),
    CORS_ORIGINS: commaSeparatedList.default('http://localhost:5173'),
    /**
     * Number of proxies in front of the app, used to find the client's real IP for rate limits.
     * Too low: every request seems to come from the proxy, so one person can exhaust everyone's
     * limits. Too high: clients can fake their IP. Must be set explicitly in production.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),

    /** Public address of the web app, used for links in emails. */
    APP_URL: z
      .string()
      .url()
      .transform((url) => url.replace(/\/+$/, ''))
      .default('http://localhost:5173'),
    /**
     * Run the background worker (outbox delivery, scheduled jobs) in this process.
     * On a paid plan it can run as a separate process instead (npm run start:worker).
     */
    WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    /**
     * Branding used in emails. The web app has its own brand file (apps/web/src/brand), so a
     * deployment for another organisation is re-branded through configuration, not code.
     */
    BRAND_NAME: z.string().trim().min(1).default('RU Lost & Found'),
    BRAND_PRIMARY_COLOR: hexColor.default('#e63946'),
    BRAND_BACKGROUND_COLOR: hexColor.default('#fcf1e8'),

    /** Serve the OpenAPI document and Swagger UI at /api/v1/openapi.json and /api/v1/docs. */
    API_DOCS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    /** Sentry error tracking. Without a DSN, errors are only logged. */
    SENTRY_DSN: optionalString.pipe(z.string().url().optional()),
    /** Defaults to NODE_ENV. */
    SENTRY_ENVIRONMENT: optionalString,
    /** Version tag on error reports; defaults to RENDER_GIT_COMMIT, which Render sets itself. */
    SENTRY_RELEASE: optionalString,
    RENDER_GIT_COMMIT: optionalString,

    /**
     * Accounts of the deployment's owners (comma-separated emails): always platform admins,
     * appointed at startup or as soon as they sign up. Set it in the hosting dashboard, not in a
     * committed file (the repository is public).
     */
    ADMIN_EMAILS: commaSeparatedList
      .pipe(z.array(z.string().trim().toLowerCase().email('must be email addresses')))
      .default(''),

    /**
     * Sample data for visitors (modules/demo): when on, the API creates it at start-up if it is
     * missing and resets it every 24 hours. Turn off (and run `npm run demo -- remove`) before
     * real users arrive.
     */
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** Master secret. Separate keys for tokens and codes are derived from it. */
    APP_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** bcrypt work factor. Each +1 doubles the time to hash (and to brute-force). */
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    /** Redis for codes and rate limits. Without it they are kept in memory (single instance only). */
    REDIS_URL: optionalString.pipe(
      z
        .string()
        .regex(
          /^rediss?:\/\/\S+$/,
          'must start with rediss:// (or redis://) and contain nothing else; check for quotes or a copied code snippet',
        )
        .optional(),
    ),

    /** Brevo transactional email. Without it emails are printed to the log (development only). */
    BREVO_API_KEY: optionalString,
    EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@ru-lost-found.app'),
    /** Sender name on emails. Defaults to BRAND_NAME. */
    EMAIL_FROM_NAME: optionalString,
    /** Development/e2e only: write emails as files into this folder instead of sending them. */
    DEV_EMAIL_DIR: optionalString,

    /** Cloudinary image hosting. Without it, uploads are saved on local disk (development only). */
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.DEV_EMAIL_DIR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_EMAIL_DIR'],
        message: 'must not be set in production (emails would be written to disk, not sent)',
      });
    }
    if (env.TRUST_PROXY_HOPS === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY_HOPS'],
        message:
          'must be set in production (4 behind Vercel + Render; check with GET /api/v1/health/client)',
      });
    }
    if (!env.BREVO_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BREVO_API_KEY'],
        message: 'is required in production, otherwise users never receive their codes',
      });
    }
    for (const key of [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'is required in production: server disks are wiped on every deploy',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvironmentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/**
 * Validates environment variables once at startup.
 * The app refuses to start with missing or malformed configuration instead of failing later at runtime.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new InvalidEnvironmentError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
