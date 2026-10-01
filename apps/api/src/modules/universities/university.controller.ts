import { Router, type RequestHandler } from 'express';
import type { UniversityDto } from '@ru-lost-found/shared';
import { NotFoundError } from '../../core/errors/AppError';
import { scopeOf } from '../../core/http/auth';
import type { UniversityRepository } from './domain/UniversityRepository';

export class UniversityController {
  constructor(private readonly universities: UniversityRepository) {}

  /** The signed-in user's university: its name and the schools shown in forms. */
  current: RequestHandler = async (req, res) => {
    const university = await this.universities.findById(scopeOf(req).universityId);
    if (!university) throw new NotFoundError('University');
    const body: UniversityDto = {
      id: university.id,
      name: university.name,
      schools: [...university.schools],
    };
    res.json(body);
  };
}

export function createUniversityRouter(
  controller: UniversityController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get('/current', authenticate, controller.current);
  return router;
}
