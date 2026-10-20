import type { Actor } from '../../core/domain/Actor';
import { ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import type { TenantScope } from '../../core/persistence/Repository';
import type { Item } from '../items/domain/Item';
import type { ItemRepository } from '../items/domain/ItemRepository';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import {
  DATE_SLACK_DAYS,
  MATCH_WINDOW_DAYS,
  SHOW_MATCH,
  STRONG_MATCH,
  scoreMatch,
} from './domain/matchScore';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Posts compared per request: the most recent open ones of the category and dates. */
const CANDIDATES = 50;
/** Suggestions shown on a post's page. */
const SHOWN = 5;

export interface MatchView {
  item: Item;
  reporter: User | undefined;
  score: number;
  strong: boolean;
}

/**
 * Finds the posts on the other side (lost ↔ found) that may be the same item, scored by the
 * rules in domain/matchScore. Computed when asked, from open posts only: nothing is stored, so
 * a suggestion disappears as soon as either post is no longer open.
 */
export class MatchingService {
  constructor(
    private readonly items: ItemRepository,
    private readonly users: UserRepository,
  ) {}

  /** Likely matches for the reporter's own open post, best first. */
  async matchesFor(actor: Actor, scope: TenantScope, itemId: string): Promise<MatchView[]> {
    const item = await this.items.findById(scope, itemId);
    if (!item || item.status === 'REMOVED') throw new NotFoundError('Item');
    if (!item.isReportedBy(actor.userId)) {
      throw new ForbiddenError('Only the person who reported this item can see its matches.');
    }
    return (await this.matches(scope, item, SHOW_MATCH)).slice(0, SHOWN);
  }

  /** Lost posts a new found post strongly matches (for telling their owners), best first. */
  async strongMatchesFor(scope: TenantScope, item: Item): Promise<MatchView[]> {
    return this.matches(scope, item, STRONG_MATCH);
  }

  private async matches(scope: TenantScope, item: Item, threshold: number): Promise<MatchView[]> {
    if (item.status !== 'OPEN') return [];
    const lost = item.type === 'LOST';
    const day = (n: number) => new Date(item.occurredOn.getTime() + n * DAY_MS);
    const candidates = await this.items.findMatchCandidates(
      scope,
      {
        type: lost ? 'FOUND' : 'LOST',
        category: item.category,
        // Found from shortly before the loss until the end of the window, seen from either side.
        occurredFrom: lost ? day(-DATE_SLACK_DAYS) : day(-MATCH_WINDOW_DAYS),
        occurredTo: lost ? day(MATCH_WINDOW_DAYS) : day(DATE_SLACK_DAYS),
        excludeReporterId: item.reporterId,
      },
      CANDIDATES,
    );

    const people = await this.users.findByIds([
      item.reporterId,
      ...candidates.map((candidate) => candidate.reporterId),
    ]);
    const byId = new Map(people.map((person) => [person.id, person]));
    // Sample posts (the demo) and real ones never meet.
    const isDemo = (post: Item) => byId.get(post.reporterId)?.isDemo ?? false;

    return candidates
      .filter((candidate) => isDemo(candidate) === isDemo(item))
      .map((candidate) => {
        const score = lost ? scoreMatch(item, candidate) : scoreMatch(candidate, item);
        return { item: candidate, reporter: byId.get(candidate.reporterId), score: score ?? 0 };
      })
      .filter((match) => match.score >= threshold)
      .map((match) => ({ ...match, strong: match.score >= STRONG_MATCH }))
      .sort((a, b) => b.score - a.score);
  }
}
