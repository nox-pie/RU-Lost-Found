import type { Clock } from '../../core/domain/Clock';
import type { AppModule } from '../../core/modules/AppModule';
import { generateNumericCode } from '../../core/security/randomCode';
import type { Kernel } from '../kernel';
import { ClaimController } from './claim.controller';
import { createClaimRouter } from './claim.routes';
import { ClaimService } from './claim.service';
import { CloseClaimsOnItemRemoved } from './handlers/CloseClaimsOnItemRemoved';

/** A ClaimService on a given clock (the demo plays its sample claims on a clock of its own). */
export function createClaimService(kernel: Kernel, clock: Clock = kernel.clock): ClaimService {
  const { repositories, unitOfWork, ids, logger, audit } = kernel;
  return new ClaimService({
    claims: repositories.claims,
    items: repositories.items,
    users: repositories.users,
    unitOfWork,
    ids,
    clock,
    generateHandoverCode: () => generateNumericCode(6),
    logger,
    audit,
  });
}

export function createClaimsModule(kernel: Kernel) {
  const { http } = kernel;
  const service = createClaimService(kernel);
  const module: AppModule = {
    name: 'claims',
    // Claims are created under their item (/items/:id/claims), then addressed as /claims/:id.
    routes: [
      {
        path: '',
        router: createClaimRouter(
          new ClaimController(service),
          http.authenticate,
          http.rateLimiter,
        ),
      },
    ],
    handlers: [new CloseClaimsOnItemRemoved(service)],
    jobs: [{ name: 'expire-claims', intervalSeconds: 5 * 60, run: () => service.expireOverdue() }],
  };
  return { module, service };
}
