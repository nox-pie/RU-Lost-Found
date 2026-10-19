import type { Router } from 'express';
import type { EventHandler } from '../events/EventHandler';
import type { ScheduledJob } from '../jobs/ScheduledJob';

/** A router mounted under the API prefix; `path: ''` mounts it at the API root. */
export interface ModuleRoute {
  path: string;
  router: Router;
}

/**
 * A business module as the application sees it: the routes it serves, the events it reacts to
 * and the jobs it runs. Each module builds itself in its `*.module.ts`; the composition root only
 * lists the modules, and the HTTP app, the event worker and the scheduler collect from that list.
 * Adding a module therefore touches neither app.ts nor any other module.
 */
export interface AppModule {
  readonly name: string;
  readonly routes?: readonly ModuleRoute[];
  readonly handlers?: readonly EventHandler[];
  readonly jobs?: readonly ScheduledJob[];
}
