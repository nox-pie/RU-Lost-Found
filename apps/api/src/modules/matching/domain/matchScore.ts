import type { ItemCategory } from '@ru-lost-found/shared';

/** What matching looks at in a post. */
export interface MatchablePost {
  category: ItemCategory;
  title: string;
  description: string;
  location: string;
  place: string | null;
  occurredOn: Date;
}

/** From this score a found post is shown to the owner of a lost one (and the other way round). */
export const SHOW_MATCH = 0.45;
/** From this score the owner of a lost post is told about a new found post. */
export const STRONG_MATCH = 0.65;

const DAY_MS = 24 * 60 * 60 * 1000;
/** An item is found at most this long after it was lost, to be suggested. */
export const MATCH_WINDOW_DAYS = 30;
/** Dates are picked by hand: allow a find dated a little before the loss. */
export const DATE_SLACK_DAYS = 2;

const WEIGHTS = { words: 0.45, date: 0.3, place: 0.25 };

/** Words that say nothing about the item itself. */
const FILLER = new Set(
  (
    'the and with without for from into onto near next inside outside this that these those ' +
    'its his her their our your my mine has have had was were are been being one some any ' +
    'lost found left someone somebody please item thing things handed back also very really'
  ).split(' '),
);

/** The distinctive words of a text: lower case, no filler, no plural "s" ("keys" = "key"). */
function keywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(
    words
      .filter((word) => (word.length >= 3 || /^\d+$/.test(word)) && !FILLER.has(word))
      .map((word) =>
        word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word,
      ),
  );
}

/** Shared words relative to the shorter text, so a terse post isn't penalised: 0 to 1. */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  const smaller = Math.min(a.size, b.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / smaller;
}

/**
 * How likely a found post is the item of a lost post, from 0 to 1; null when it can't be
 * (another category, or found before it was lost or long after). Rule-based on purpose: the
 * reasons are easy to explain to a student and to test, and there are only a few hundred posts.
 */
export function scoreMatch(lost: MatchablePost, found: MatchablePost): number | null {
  if (lost.category !== found.category) return null;
  const days = (found.occurredOn.getTime() - lost.occurredOn.getTime()) / DAY_MS;
  if (days < -DATE_SLACK_DAYS || days > MATCH_WINDOW_DAYS) return null;

  const words = wordOverlap(
    keywords(`${lost.title} ${lost.description}`),
    keywords(`${found.title} ${found.description}`),
  );
  const date = 1 - Math.min(Math.abs(days), MATCH_WINDOW_DAYS) / MATCH_WINDOW_DAYS;
  // Unknown on either side: neither for nor against.
  const place = lost.place && found.place ? (lost.place === found.place ? 1 : 0) : 0.5;

  const score = WEIGHTS.words * words + WEIGHTS.date * date + WEIGHTS.place * place;
  return Math.round(score * 100) / 100;
}
