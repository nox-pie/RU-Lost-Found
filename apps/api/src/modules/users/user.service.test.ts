import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../core/errors/AppError';
import { createLogger } from '../../core/logger/logger';
import { FixedClock, aUniversity, aUser } from '../../testing/builders';
import { InMemoryStorageProvider } from '../../testing/InMemoryStorageProvider';
import type { University } from '../universities/domain/University';
import type { UniversityRepository } from '../universities/domain/UniversityRepository';
import type { User } from './domain/User';
import type { UserRepository } from './domain/UserRepository';
import { toPersonSummary } from './person.mapper';
import { UserService } from './user.service';

/**
 * Unit tests with hand-written fakes instead of MongoDB: possible because UserService depends
 * only on interfaces (dependency inversion), so any implementation can be passed in.
 */
class FakeUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  failUpdates = false;

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findByIds(ids: readonly string[]) {
    return ids.flatMap((id) => this.users.get(id) ?? []);
  }
  async search() {
    return { items: [...this.users.values()], nextCursor: null };
  }
  async create(user: User) {
    this.users.set(user.id, user);
  }
  async update(user: User) {
    if (this.failUpdates) throw new Error('database unavailable');
    this.users.set(user.id, user);
  }
}

class FakeUniversityRepository implements UniversityRepository {
  constructor(private readonly university: University) {}
  async findById(id: string) {
    return id === this.university.id ? this.university : null;
  }
  async findBySlug() {
    return this.university;
  }
  async findByEmail() {
    return this.university;
  }
  async create() {}
  async update() {}
}

const image = { data: Buffer.from('img'), contentType: 'image/webp' as const };

function setup() {
  const university = aUniversity({ schools: ['Newton School of Technology'] });
  const user = aUser({ universityId: university.id });
  const users = new FakeUserRepository();
  users.users.set(user.id, user);
  const storage = new InMemoryStorageProvider();
  const service = new UserService(
    users,
    new FakeUniversityRepository(university),
    storage,
    new FixedClock(),
    createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
  );
  return { service, user, users, storage };
}

describe('UserService', () => {
  it('deletes the newly uploaded picture if saving the profile fails', async () => {
    const { service, user, users, storage } = setup();
    users.failUpdates = true;

    await expect(service.changeAvatar(user.id, image)).rejects.toThrow('database unavailable');

    expect(storage.stored.size).toBe(0);
    expect(storage.deleted).toHaveLength(1);
  });

  it('does nothing when removing a picture that was never set', async () => {
    const { service, user, storage } = setup();

    await service.removeAvatar(user.id);

    expect(storage.deleted).toEqual([]);
  });

  it('keeps the new picture even if deleting the old file fails', async () => {
    const { service, user, storage } = setup();
    await service.changeAvatar(user.id, image);
    storage.delete = async () => {
      throw new Error('storage unavailable');
    };

    const updated = await service.changeAvatar(user.id, image);

    expect(updated.profile.avatar?.publicId).toBe('avatars/test-2');
  });

  it('refuses a missing picture, unknown users and schools of other universities', async () => {
    const { service, user } = setup();

    await expect(service.changeAvatar(user.id, undefined)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.getById('unknown')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.updateProfile(user.id, { school: 'Hogwarts' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('toPersonSummary', () => {
  it('shows a placeholder for people whose account no longer exists', () => {
    expect(toPersonSummary('gone-id', undefined)).toEqual({
      id: 'gone-id',
      name: 'Former member',
      avatarUrl: null,
    });
  });
});
