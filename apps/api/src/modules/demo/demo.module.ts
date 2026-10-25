import type { AppModule } from '../../core/modules/AppModule';
import { createClaimService } from '../claims/claims.module';
import { createModerationService } from '../moderation/moderation.module';
import type { Kernel } from '../kernel';
import { DemoClock } from './DemoClock';
import { DEMO_RESET_INTERVAL_SECONDS, DemoSeeder } from './DemoSeeder';
import { MongoDemoDataStore } from './infrastructure/MongoDemoDataStore';

/** Sample data for visitors (DEMO_MODE): reset every hour while the demo is on. */
export function createDemoModule(kernel: Kernel) {
  const { env, repositories, connection, storage, passwords, ids, logger, clock } = kernel;
  // Claims and reports are played through services on its own clock, so the demo history is
  // dated over past weeks.
  const demoClock = new DemoClock();
  const seeder = new DemoSeeder({
    universities: repositories.universities,
    users: repositories.users,
    items: repositories.items,
    claims: createClaimService(kernel, demoClock),
    moderation: createModerationService(kernel, demoClock),
    clock: demoClock,
    store: new MongoDemoDataStore(connection),
    storage,
    passwords,
    ids,
    logger,
    universitySlug: 'rishihood',
  });
  const module: AppModule = {
    name: 'demo',
    jobs: env.DEMO_MODE
      ? [
          {
            name: 'reset-demo-data',
            intervalSeconds: DEMO_RESET_INTERVAL_SECONDS,
            // Start-up already sets up the sample data; a reset right after a deploy would only
            // throw away what visitors were in the middle of.
            runAtStart: false,
            run: () => seeder.reset(clock.now()),
          },
        ]
      : [],
  };
  return { module, seeder };
}
