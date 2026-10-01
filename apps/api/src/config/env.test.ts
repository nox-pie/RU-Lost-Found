import { describe, expect, it } from 'vitest';
import { InvalidEnvironmentError, loadEnv } from './env';

const valid = {
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/db',
  APP_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults for optional settings', () => {
    const env = loadEnv(valid);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5001,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
    });
    expect(env.TRUST_PROXY_HOPS).toBeUndefined();
  });

  it('coerces numbers and splits comma-separated origins', () => {
    const env = loadEnv({
      ...valid,
      PORT: '8080',
      TRUST_PROXY_HOPS: '1',
      CORS_ORIGINS: 'https://a.example , https://b.example,',
    });

    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('reports every problem at once when configuration is invalid', () => {
    try {
      loadEnv({ ...valid, MONGODB_URI: 'postgres://nope', PORT: 'abc' });
      expect.unreachable('loadEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvironmentError);
      const { problems } = error as InvalidEnvironmentError;
      expect(problems).toHaveLength(2);
      expect(problems.join()).toMatch(/MONGODB_URI/);
      expect(problems.join()).toMatch(/PORT/);
    }
  });

  it('requires MONGODB_URI and a long APP_SECRET', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
    expect(() => loadEnv({ ...valid, APP_SECRET: 'short' })).toThrow(/APP_SECRET/);
  });

  it('brands emails as RU Lost & Found unless configured otherwise', () => {
    expect(loadEnv(valid)).toMatchObject({
      BRAND_NAME: 'RU Lost & Found',
      BRAND_PRIMARY_COLOR: '#e63946',
      BRAND_BACKGROUND_COLOR: '#fcf1e8',
    });
    expect(loadEnv({ ...valid, BRAND_NAME: 'Acme Lost Property' }).BRAND_NAME).toBe(
      'Acme Lost Property',
    );
  });

  it('accepts only hex brand colours, since they are placed inside email markup', () => {
    expect(() => loadEnv({ ...valid, BRAND_PRIMARY_COLOR: 'red;background:url(x)' })).toThrow(
      /BRAND_PRIMARY_COLOR/,
    );
  });

  it('accepts only a plain redis:// or rediss:// URL, and never echoes it in the error', () => {
    const quoted = '"rediss://default:s3cr3t@host.upstash.io:6379"';

    expect(() => loadEnv({ ...valid, REDIS_URL: quoted })).toThrow(/REDIS_URL/);
    expect(() => loadEnv({ ...valid, REDIS_URL: quoted })).not.toThrow(/s3cr3t/);
    expect(loadEnv({ ...valid, REDIS_URL: 'rediss://default:pw@host:6379' }).REDIS_URL).toBe(
      'rediss://default:pw@host:6379',
    );
  });

  it('accepts a Sentry DSN only as a URL', () => {
    expect(loadEnv({ ...valid, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
    expect(() => loadEnv({ ...valid, SENTRY_DSN: 'not a url' })).toThrow(/SENTRY_DSN/);
    expect(loadEnv({ ...valid, SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1' }).SENTRY_DSN).toBe(
      'https://key@o1.ingest.sentry.io/1',
    );
  });

  it('treats blank optional settings as missing', () => {
    const env = loadEnv({ ...valid, REDIS_URL: '  ', BREVO_API_KEY: '' });

    expect(env.REDIS_URL).toBeUndefined();
    expect(env.BREVO_API_KEY).toBeUndefined();
  });

  it('requires email and image providers in production', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      BREVO_API_KEY: 'xkeysib-123',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'abc',
      TRUST_PROXY_HOPS: '2',
    };

    expect(() => loadEnv(production)).not.toThrow();
    expect(() => loadEnv({ ...production, BREVO_API_KEY: '' })).toThrow(/BREVO_API_KEY/);
    expect(() => loadEnv({ ...production, CLOUDINARY_API_SECRET: '' })).toThrow(
      /CLOUDINARY_API_SECRET/,
    );
    expect(() => loadEnv({ ...production, TRUST_PROXY_HOPS: undefined })).toThrow(
      /TRUST_PROXY_HOPS/,
    );
  });
});
