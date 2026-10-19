import { describe, expect, it } from 'vitest';
import type { StoredEvent } from '../core/events/EventHandler';
import { domainEvent, payloadOf } from './events';

const stored = (type: string, payload: Record<string, unknown>): StoredEvent => ({
  id: 'e1',
  type,
  aggregateId: 'a1',
  occurredAt: new Date('2026-10-01T00:00:00Z'),
  payload,
});

describe('domain event contracts', () => {
  it('give handlers the payload their event promises', () => {
    const event = domainEvent('UserSuspended', 'u1', new Date(), {
      universityId: 'uni',
      actorId: 'admin',
      reason: 'Spam',
    });

    expect(payloadOf({ ...event, id: 'e1' }, 'UserSuspended')).toEqual({
      universityId: 'uni',
      actorId: 'admin',
      reason: 'Spam',
    });
  });

  it('refuse a payload that breaks the contract, instead of passing on a half event', () => {
    expect(() =>
      payloadOf(stored('UserSuspended', { universityId: 'uni' }), 'UserSuspended'),
    ).toThrow();
    expect(() => payloadOf(stored('ItemRemoved', {}), 'UserSuspended')).toThrow(
      'Expected a UserSuspended event, got ItemRemoved',
    );
  });

  it('still read events written before a field was added', () => {
    expect(payloadOf(stored('PasswordChanged', {}), 'PasswordChanged')).toEqual({ via: 'RESET' });
  });
});
