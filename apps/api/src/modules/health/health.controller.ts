import type { RequestHandler } from 'express';
import type { HealthService } from './health.service';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  live: RequestHandler = (_req, res) => {
    res.json(this.healthService.live());
  };

  ready: RequestHandler = async (_req, res) => {
    const report = await this.healthService.ready();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  };
}
