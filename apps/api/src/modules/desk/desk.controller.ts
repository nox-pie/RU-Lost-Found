import type { RequestHandler } from 'express';
import type { ClaimDto, DeskItemsQuery, ItemDto, Page, PageQuery } from '@ru-lost-found/shared';
import { actorOf, scopeOf } from '../../core/http/auth';
import { toClaimDto } from '../claims/claim.mapper';
import type { ClaimService } from '../claims/claim.service';
import { toItemDto } from '../items/item.mapper';
import type { ItemService } from '../items/item.service';

/** The security desk console: what the desk is waiting to hand over. */
export class DeskController {
  constructor(
    private readonly claims: ClaimService,
    private readonly items: ItemService,
  ) {}

  /** Approved claims of the university, waiting for their handover. */
  listHandovers: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const page = await this.claims.listAwaitingHandover(
      scopeOf(req),
      req.query as unknown as PageQuery,
    );
    const body: Page<ClaimDto> = {
      data: page.items.map((view) => toClaimDto(view, actor)),
      nextCursor: page.nextCursor,
    };
    res.json(body);
  };

  /** Found items held at the desk. */
  listItems: RequestHandler = async (req, res) => {
    const viewerId = actorOf(req).userId;
    const page = await this.items.listAtDesk(scopeOf(req), req.query as unknown as DeskItemsQuery);
    const body: Page<ItemDto> = {
      data: page.items.map((view) => toItemDto(view, viewerId)),
      nextCursor: page.nextCursor,
    };
    res.json(body);
  };
}
