import { describe, expect, it } from 'vitest';
import type { Actor } from '../../../core/domain/Actor';
import { ForbiddenError, InvalidStateTransitionError } from '../../../core/errors/AppError';
import { T0, minutesAfter } from '../../../testing/builders';
import { ModerationReport } from './ModerationReport';

const LATER = minutesAfter(T0, 5);
const admin: Actor = { userId: 'a'.repeat(24), role: 'UNIVERSITY_ADMIN' };
const item = { id: 'b'.repeat(24), reporterId: 'c'.repeat(24) };

const aReport = (details?: string) =>
  ModerationReport.file({
    id: 'd'.repeat(24),
    universityId: 'e'.repeat(24),
    item,
    flaggedBy: 'f'.repeat(24),
    reason: 'SPAM',
    details,
    now: T0,
  });

describe('ModerationReport', () => {
  it('is filed open, with blank details treated as none', () => {
    const report = aReport('   ');

    expect(report.status).toBe('OPEN');
    expect(report.details).toBeNull();
    expect(report.pullEvents()).toMatchObject([
      { type: 'ItemFlagged', payload: { itemId: item.id, reason: 'SPAM' } },
    ]);
  });

  it('cannot be filed by the post’s own reporter', () => {
    expect(() =>
      ModerationReport.file({
        id: 'd'.repeat(24),
        universityId: 'e'.repeat(24),
        item,
        flaggedBy: item.reporterId,
        reason: 'SPAM',
        now: T0,
      }),
    ).toThrow(ForbiddenError);
  });

  it('is decided once, by an admin', () => {
    const report = aReport();

    expect(() =>
      report.resolve('DISMISS', { userId: 'g'.repeat(24), role: 'SECURITY_DESK' }, null, LATER),
    ).toThrow(ForbiddenError);

    report.resolve('REMOVE_ITEM', admin, ' Advert ', LATER);
    expect(report).toMatchObject({
      status: 'ACTIONED',
      resolvedBy: admin.userId,
      resolvedAt: LATER,
      resolutionNote: 'Advert',
    });
    expect(() => report.resolve('DISMISS', admin, null, LATER)).toThrow(
      InvalidStateTransitionError,
    );
  });
});
