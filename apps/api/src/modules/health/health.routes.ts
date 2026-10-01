import { Router } from 'express';
import type { HealthController } from './health.controller';

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get('/live', controller.live);
  router.get('/ready', controller.ready);
  router.get('/client', controller.client);
  return router;
}
