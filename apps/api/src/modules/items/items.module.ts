import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { ItemController } from './item.controller';
import { createItemRouter } from './item.routes';
import { ItemService } from './item.service';

export function createItemsModule(kernel: Kernel) {
  const { repositories, storage, ids, clock, logger, http } = kernel;
  const service = new ItemService(
    repositories.items,
    repositories.users,
    storage,
    ids,
    clock,
    logger,
  );
  const module: AppModule = {
    name: 'items',
    routes: [
      {
        path: '/items',
        router: createItemRouter(new ItemController(service), {
          authenticate: http.authenticate,
          limiter: http.rateLimiter,
          uploadSlot: http.uploadSlot,
        }),
      },
    ],
    jobs: [
      {
        name: 'purge-removed-item-photos',
        intervalSeconds: 60 * 60,
        run: () => service.purgeRemovedPhotos(30),
      },
    ],
  };
  return { module, service };
}
