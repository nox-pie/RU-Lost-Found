import type { AppModule } from '../../core/modules/AppModule';
import type { ClaimService } from '../claims/claim.service';
import type { ItemService } from '../items/item.service';
import type { Kernel } from '../kernel';
import { DeskController } from './desk.controller';
import { createDeskRouter } from './desk.routes';

/** The security desk console. */
export function createDeskModule(
  kernel: Kernel,
  deps: { claimService: ClaimService; itemService: ItemService },
): AppModule {
  const controller = new DeskController(deps.claimService, deps.itemService);
  return {
    name: 'desk',
    routes: [
      {
        path: '/desk',
        router: createDeskRouter(controller, {
          authenticate: kernel.http.authenticate,
          requireStaff: kernel.http.requireStaff,
        }),
      },
    ],
  };
}
