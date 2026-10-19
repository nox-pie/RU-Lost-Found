import type { HealthIndicator } from '../../core/health/HealthIndicator';
import type { AppModule } from '../../core/modules/AppModule';
import { HealthController } from './health.controller';
import { createHealthRouter } from './health.routes';
import { HealthService } from './health.service';

export function createHealthModule(indicators: HealthIndicator[]): AppModule {
  const controller = new HealthController(new HealthService(indicators));
  return { name: 'health', routes: [{ path: '/health', router: createHealthRouter(controller) }] };
}
