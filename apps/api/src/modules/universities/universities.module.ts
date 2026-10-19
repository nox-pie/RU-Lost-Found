import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { UniversityController, createUniversityRouter } from './university.controller';

export function createUniversitiesModule(kernel: Kernel): AppModule {
  const controller = new UniversityController(kernel.repositories.universities);
  return {
    name: 'universities',
    routes: [
      {
        path: '/universities',
        router: createUniversityRouter(controller, kernel.http.authenticate),
      },
    ],
  };
}
