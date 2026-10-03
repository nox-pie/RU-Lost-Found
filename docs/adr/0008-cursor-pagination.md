# ADR 0008: Cursor-based pagination

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The browse feed, "My items", claims, notifications and the admin lists are all newest-first lists that grow continuously while people scroll them: new posts arrive at the top all the time. The first version returned every item in one response.

## Decision

Every list endpoint uses **cursor pagination**: `?limit=20&cursor=<opaque>` returns `{ data, nextCursor }`.

- Order is `(createdAt desc, _id desc)`; `_id` breaks ties between documents created in the same millisecond.
- The cursor encodes the last item's `createdAt` and `_id` (base64url JSON); the next page asks for documents strictly "after" it, which a compound index answers directly.
- The repository fetches `limit + 1` rows to know whether there is a next page without counting.
- Limits are validated (1 to 50).
- The web app shows **"Load more"** (TanStack Query `useInfiniteQuery`), not page numbers.
- **Totals** are a separate, cheap query where the UI needs them: the browse tabs' counts and "Showing 12 of 17" come from `GET /items/counts` (one aggregation), defined by the same `FEED_TABS` as the lists.

## Alternatives considered

| Option                                                   | Why not                                                                                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offset pagination** (`?page=3` → `skip(40).limit(20)`) | Slower as the offset grows (the database still walks the skipped documents); and when new posts arrive between page loads, items shift: the user sees duplicates or misses posts. |
| **Return everything** (the first version)                | Response size and render time grow with the data.                                                                                                                                 |
| **Infinite scroll without a button**                     | Possible on top of the same API; "Load more" keeps the footer reachable and is easier to use with a keyboard and screen reader.                                                   |

## Consequences

**Good**

- Constant-time pages at any depth; stable results while new posts arrive.
- One `Page<T>` shape and one helper (`core/persistence/Pagination.ts`) for every list.

**Bad / accepted**

- No "jump to page 7"; acceptable for a feed.
- No total in the page response; where a total matters it costs one extra query (see counts above).
- Cursors are opaque but not signed: a crafted cursor can only move within lists the user may already read, so this is acceptable.

## In the code

`apps/api/src/core/persistence/Pagination.ts`, `modules/*/infrastructure/Mongo*Repository.ts` (`search`, `list…`), `apps/web/src/features/items/FeedPage.tsx`, [backend.md §10](../architecture/backend.md#10-api-design).
