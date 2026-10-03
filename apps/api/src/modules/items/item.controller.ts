import type { Request, RequestHandler } from 'express';
import type {
  CreateItemInput,
  ItemCountsDto,
  ItemCountsQuery,
  ItemDto,
  ListItemsQuery,
  Page,
  PageQuery,
  UpdateItemInput,
} from '@ru-lost-found/shared';
import { actorOf, authOf, scopeOf } from '../../core/http/auth';
import type { PageResult } from '../../core/persistence/Pagination';
import { toItemDto, type ItemView } from './item.mapper';
import type { ItemService } from './item.service';

const idOf = (req: Request) => (req.params as { id: string }).id;

export class ItemController {
  constructor(private readonly items: ItemService) {}

  list: RequestHandler = async (req, res) => {
    const page = await this.items.search(scopeOf(req), req.query as unknown as ListItemsQuery);
    res.json(this.toPage(page, authOf(req).userId));
  };

  counts: RequestHandler = async (req, res) => {
    const body: ItemCountsDto = await this.items.countByTab(
      scopeOf(req),
      req.query as unknown as ItemCountsQuery,
    );
    res.json(body);
  };

  listMine: RequestHandler = async (req, res) => {
    const page = await this.items.listMine(
      actorOf(req),
      scopeOf(req),
      req.query as unknown as PageQuery,
    );
    res.json(this.toPage(page, authOf(req).userId));
  };

  create: RequestHandler = async (req, res) => {
    const view = await this.items.report(
      actorOf(req),
      scopeOf(req),
      req.body as CreateItemInput,
      req.images ?? [],
    );
    res
      .status(201)
      .location(`/api/v1/items/${view.item.id}`)
      .json(toItemDto(view, authOf(req).userId));
  };

  get: RequestHandler = async (req, res) => {
    const view = await this.items.get(scopeOf(req), idOf(req));
    res.json(toItemDto(view, authOf(req).userId));
  };

  update: RequestHandler = async (req, res) => {
    const view = await this.items.edit(
      actorOf(req),
      scopeOf(req),
      idOf(req),
      req.body as UpdateItemInput,
    );
    res.json(toItemDto(view, authOf(req).userId));
  };

  remove: RequestHandler = async (req, res) => {
    await this.items.remove(actorOf(req), scopeOf(req), idOf(req));
    res.status(204).end();
  };

  private toPage(page: PageResult<ItemView>, viewerId: string): Page<ItemDto> {
    return {
      data: page.items.map((view) => toItemDto(view, viewerId)),
      nextCursor: page.nextCursor,
    };
  }
}
