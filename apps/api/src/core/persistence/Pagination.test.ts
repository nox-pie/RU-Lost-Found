import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { decodeCursor, encodeCursor, toPage } from './Pagination';

const id = '0123456789abcdef01234567';

describe('cursor pagination', () => {
  it('round-trips a position', () => {
    const position = { createdAt: new Date('2026-10-01T10:00:00.123Z'), id };

    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    'not-base64-json',
    Buffer.from('{"t":"yesterday","i":"x"}').toString('base64url'),
    Buffer.from(`{"t":1e300,"i":"${id}"}`).toString('base64url'),
    Buffer.from(`{"t":1,"i":"${id}","$where":"1"}`.replace(id, 'zz')).toString('base64url'),
  ])('rejects tampered cursors (%s)', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(ValidationError);
  });

  it('returns a next cursor only when there are more rows than the limit', () => {
    const rows = [1, 2, 3].map((n) => ({ id: `${id.slice(0, -1)}${n}`, createdAt: new Date(n) }));

    expect(toPage(rows, 3).nextCursor).toBeNull();
    const page = toPage(rows, 2);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor as string).id).toBe(rows[1]?.id);
  });
});
