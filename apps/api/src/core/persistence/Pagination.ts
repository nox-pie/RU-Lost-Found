import { ValidationError } from '../errors/AppError';

export interface PageRequest {
  /** Opaque cursor from the previous page; absent for the first page. */
  cursor?: string;
  limit: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

/** Position of the last item of a page in a list sorted by `createdAt` desc, then id desc. */
export interface CursorPosition {
  createdAt: Date;
  id: string;
}

/**
 * Cursor (keyset) pagination: instead of "skip N rows", the next page starts after the last item
 * seen. It stays fast however deep you page, and doesn't repeat or skip items when new ones arrive.
 * The cursor is opaque to clients (base64url JSON), so its format can change freely.
 */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ t: position.createdAt.getTime(), i: position.id })).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): CursorPosition {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      't' in parsed &&
      'i' in parsed &&
      typeof parsed.t === 'number' &&
      Number.isFinite(new Date(parsed.t).getTime()) &&
      typeof parsed.i === 'string' &&
      /^[0-9a-f]{24}$/.test(parsed.i)
    ) {
      return { createdAt: new Date(parsed.t), id: parsed.i };
    }
  } catch {
    // fall through
  }
  throw new ValidationError('The page cursor is invalid.', [
    { path: 'query.cursor', message: 'Invalid cursor' },
  ]);
}

/** Splits an over-fetched list (limit + 1 rows) into a page and the cursor for the next one. */
export function toPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): PageResult<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}
