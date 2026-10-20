import type { Request, RequestHandler } from 'express';
import type { MatchDto } from '@ru-lost-found/shared';
import { actorOf, scopeOf } from '../../core/http/auth';
import { toItemDto } from '../items/item.mapper';
import type { MatchingService } from './matching.service';

const idOf = (req: Request) => (req.params as { id: string }).id;

export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  /** Likely matches for the signed-in reporter's own post. */
  forItem: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const matches = await this.matching.matchesFor(actor, scopeOf(req), idOf(req));
    const body: { data: MatchDto[] } = {
      data: matches.map(({ item, reporter, score, strong }) => ({
        item: toItemDto({ item, reporter }, actor.userId),
        score,
        strong,
      })),
    };
    res.json(body);
  };
}
