import type { Request, RequestHandler } from 'express';
import type {
  ApproveClaimInput,
  ClaimDto,
  HandoverInput,
  ListClaimsQuery,
  Page,
  RejectClaimInput,
  SubmitClaimInput,
} from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import { actorOf, scopeOf } from '../../core/http/auth';
import type { PageResult } from '../../core/persistence/Pagination';
import { toClaimDto, type ClaimView } from './claim.mapper';
import type { ClaimService } from './claim.service';

const idOf = (req: Request) => (req.params as { id: string }).id;
const queryOf = (req: Request) => req.query as unknown as ListClaimsQuery;

export class ClaimController {
  constructor(private readonly claims: ClaimService) {}

  submit: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const view = await this.claims.submit(
      actor,
      scopeOf(req),
      idOf(req),
      req.body as SubmitClaimInput,
    );
    res.status(201).location(`/api/v1/claims/${view.claim.id}`).json(toClaimDto(view, actor));
  };

  listForItem: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const page = await this.claims.listForItem(actor, scopeOf(req), idOf(req), queryOf(req));
    res.json(this.toPage(page, actor));
  };

  listMine: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    res.json(this.toPage(await this.claims.listMine(actor, scopeOf(req), queryOf(req)), actor));
  };

  listReceived: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    res.json(this.toPage(await this.claims.listReceived(actor, scopeOf(req), queryOf(req)), actor));
  };

  get: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    res.json(toClaimDto(await this.claims.get(actor, scopeOf(req), idOf(req)), actor));
  };

  approve: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const view = await this.claims.approve(
      actor,
      scopeOf(req),
      idOf(req),
      req.body as ApproveClaimInput,
    );
    res.json(toClaimDto(view, actor));
  };

  reject: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const { reason } = req.body as RejectClaimInput;
    res.json(toClaimDto(await this.claims.reject(actor, scopeOf(req), idOf(req), reason), actor));
  };

  cancel: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    res.json(toClaimDto(await this.claims.cancel(actor, scopeOf(req), idOf(req)), actor));
  };

  confirmHandover: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const { code } = req.body as HandoverInput;
    const view = await this.claims.confirmHandover(actor, scopeOf(req), idOf(req), code);
    res.json(toClaimDto(view, actor));
  };

  confirmHandoverAsStaff: RequestHandler = async (req, res) => {
    const actor = actorOf(req);
    const view = await this.claims.confirmHandoverAsStaff(actor, scopeOf(req), idOf(req));
    res.json(toClaimDto(view, actor));
  };

  private toPage(page: PageResult<ClaimView>, viewer: Actor): Page<ClaimDto> {
    return {
      data: page.items.map((view) => toClaimDto(view, viewer)),
      nextCursor: page.nextCursor,
    };
  }
}
