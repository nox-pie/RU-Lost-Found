import type { HealthIndicator } from '../../core/health/HealthIndicator';

export type ComponentStatus = 'up' | 'down';

export interface LivenessReport {
  status: 'ok';
  uptimeSeconds: number;
}

export interface ReadinessReport {
  status: 'ok' | 'unavailable';
  checks: Record<string, ComponentStatus>;
}

const CHECK_TIMEOUT_MS = 3000;

function withTimeout(check: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([check.catch(() => false), timeout]).finally(() => clearTimeout(timer));
}

export class HealthService {
  constructor(
    private readonly indicators: readonly HealthIndicator[],
    private readonly checkTimeoutMs: number = CHECK_TIMEOUT_MS,
  ) {}

  /** Liveness: the process is running and can answer. Never touches dependencies, so it stays cheap. */
  live(): LivenessReport {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: every dependency answers within the timeout. Checks run in parallel. */
  async ready(): Promise<ReadinessReport> {
    const results = await Promise.all(
      this.indicators.map(
        async (indicator) =>
          [indicator.name, await withTimeout(indicator.isHealthy(), this.checkTimeoutMs)] as const,
      ),
    );

    const checks: Record<string, ComponentStatus> = {};
    for (const [name, healthy] of results) {
      checks[name] = healthy ? 'up' : 'down';
    }

    const allUp = results.every(([, healthy]) => healthy);
    return { status: allUp ? 'ok' : 'unavailable', checks };
  }
}
