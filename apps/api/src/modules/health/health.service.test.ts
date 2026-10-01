import { describe, expect, it } from 'vitest';
import type { HealthIndicator } from '../../core/health/HealthIndicator';
import { FakeHealthIndicator } from '../../testing/testApp';
import { HealthService } from './health.service';

const never: HealthIndicator = { name: 'slow', isHealthy: () => new Promise(() => {}) };
const throwing: HealthIndicator = {
  name: 'broken',
  isHealthy: () => Promise.reject(new Error('boom')),
};

describe('HealthService', () => {
  it('is live without checking dependencies', () => {
    const service = new HealthService([throwing]);

    expect(service.live()).toMatchObject({ status: 'ok' });
  });

  it('is ready when every dependency is up', async () => {
    const service = new HealthService([
      new FakeHealthIndicator('mongodb'),
      new FakeHealthIndicator('redis'),
    ]);

    await expect(service.ready()).resolves.toEqual({
      status: 'ok',
      checks: { mongodb: 'up', redis: 'up' },
    });
  });

  it('is unavailable when any dependency is down', async () => {
    const service = new HealthService([
      new FakeHealthIndicator('mongodb'),
      new FakeHealthIndicator('redis', false),
    ]);

    await expect(service.ready()).resolves.toEqual({
      status: 'unavailable',
      checks: { mongodb: 'up', redis: 'down' },
    });
  });

  it('treats a check that throws or hangs as down', async () => {
    const service = new HealthService([throwing, never], 20);

    await expect(service.ready()).resolves.toEqual({
      status: 'unavailable',
      checks: { broken: 'down', slow: 'down' },
    });
  });
});
