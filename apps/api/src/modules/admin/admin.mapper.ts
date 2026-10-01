import type { AdminUserDto, AuditEntryDto } from '@ru-lost-found/shared';
import type { AuditRecord } from '../../core/audit/AuditTrail';
import type { User } from '../users/domain/User';
import { toPersonSummary } from '../users/person.mapper';

/** Admins see contact and enrolment details, never the password hash. */
export function toAdminUserDto(user: User): AdminUserDto {
  const { profile } = user;
  return {
    id: user.id,
    email: user.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatar?.url ?? null,
    role: user.role,
    status: user.status,
    school: profile.school,
    year: profile.year,
    enrollmentNumber: profile.enrollmentNumber,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAuditEntryDto(
  entry: AuditRecord,
  people: ReadonlyMap<string, User>,
): AuditEntryDto {
  return {
    id: entry.id,
    action: entry.action,
    actor: entry.actorId ? toPersonSummary(entry.actorId, people.get(entry.actorId)) : null,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    ip: entry.ip,
    occurredAt: entry.occurredAt.toISOString(),
  };
}
