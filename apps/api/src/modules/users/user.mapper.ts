import type { MeDto } from '@ru-lost-found/shared';
import type { User } from './domain/User';

/** The signed-in user's own view of their account. Never includes the password hash. */
export function toMeDto(user: User): MeDto {
  const { profile } = user;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    universityId: user.universityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    year: profile.year,
    school: profile.school,
    enrollmentNumber: profile.enrollmentNumber,
    phone: profile.phone,
    avatarUrl: profile.avatar?.url ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
