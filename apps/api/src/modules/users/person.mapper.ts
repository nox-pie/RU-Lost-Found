import type { PersonSummaryDto } from '@ru-lost-found/shared';
import type { User } from './domain/User';

/**
 * How other users see a person: name and picture only. Email, phone and enrollment number are
 * never shown in lists; they are shared only through a claim the person takes part in.
 */
export function toPersonSummary(userId: string, user: User | undefined): PersonSummaryDto {
  if (!user) return { id: userId, name: 'Former member', avatarUrl: null };
  return { id: user.id, name: user.fullName, avatarUrl: user.profile.avatar?.url ?? null };
}
