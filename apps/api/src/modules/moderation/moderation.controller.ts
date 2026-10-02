import type { Request, RequestHandler } from 'express';
import type {
  FlagItemInput,
  ListReportsQuery,
  MessageResponse,
  ModerateItemInput,
  ModerationReportDto,
  Page,
  RemovePostInput,
} from '@ru-lost-found/shared';
import { actorOf, scopeOf } from '../../core/http/auth';
import { toModerationReportDto } from './moderation.mapper';
import type { ModerationService } from './moderation.service';

const idOf = (req: Request) => (req.params as { id: string }).id;

export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  flag: RequestHandler = async (req, res) => {
    await this.moderation.flag(actorOf(req), scopeOf(req), idOf(req), req.body as FlagItemInput);
    res.status(201).json({
      message: 'Thanks for telling us. An admin will review this post.',
    } satisfies MessageResponse);
  };

  list: RequestHandler = async (req, res) => {
    const page = await this.moderation.list(scopeOf(req), req.query as unknown as ListReportsQuery);
    res.json({
      data: page.items.map(toModerationReportDto),
      nextCursor: page.nextCursor,
    } satisfies Page<ModerationReportDto>);
  };

  removePost: RequestHandler = async (req, res) => {
    const { reason } = req.body as RemovePostInput;
    const result = await this.moderation.removePost(
      actorOf(req),
      scopeOf(req),
      idOf(req),
      reason ?? null,
    );
    res.json(result);
  };

  moderateItem: RequestHandler = async (req, res) => {
    const result = await this.moderation.moderateItem(
      actorOf(req),
      scopeOf(req),
      idOf(req),
      req.body as ModerateItemInput,
    );
    res.json(result);
  };
}
