import type { UpdateProfileInput } from '@ru-lost-found/shared';
import type { Clock } from '../../core/domain/Clock';
import type { ImageRef } from '../../core/domain/ImageRef';
import { NotFoundError, ValidationError } from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { ImageUpload, StorageProvider } from '../../core/storage/StorageProvider';
import type { UniversityRepository } from '../universities/domain/UniversityRepository';
import type { User } from './domain/User';
import type { UserRepository } from './domain/UserRepository';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly universities: UniversityRepository,
    private readonly storage: StorageProvider,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async getById(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async updateProfile(userId: string, changes: UpdateProfileInput): Promise<User> {
    const user = await this.getById(userId);

    if (changes.school !== undefined) {
      const university = await this.universities.findById(user.universityId);
      if (university && university.schools.length > 0 && !university.hasSchool(changes.school)) {
        throw new ValidationError('The request is invalid.', [
          { path: 'body.school', message: `Choose a school of ${university.name}` },
        ]);
      }
    }

    user.updateProfile(changes, this.clock.now());
    await this.users.update(user);
    return user;
  }

  /** Uploads the new picture, saves it, then deletes the old file. */
  async changeAvatar(userId: string, image: ImageUpload | undefined): Promise<User> {
    if (!image) {
      throw new ValidationError('Choose a picture to upload.', [
        { path: 'avatar', message: 'A picture is required' },
      ]);
    }
    const user = await this.getById(userId);
    user.assertEditable(); // before uploading, so a refused change leaves no file behind
    const uploaded = await this.storage.upload(image, 'avatars');

    let previous: ImageRef | null;
    try {
      previous = user.changeAvatar(uploaded, this.clock.now());
      await this.users.update(user);
    } catch (error) {
      await this.deleteQuietly(uploaded);
      throw error;
    }

    if (previous) await this.deleteQuietly(previous);
    return user;
  }

  async removeAvatar(userId: string): Promise<User> {
    const user = await this.getById(userId);
    const previous = user.removeAvatar(this.clock.now());
    if (previous) {
      await this.users.update(user);
      await this.deleteQuietly(previous);
    }
    return user;
  }

  /** Storage clean-up must never fail the user's request; a leftover file is only a small cost. */
  private async deleteQuietly(image: ImageRef): Promise<void> {
    try {
      await this.storage.delete(image.publicId);
    } catch (err) {
      this.logger.warn({ err, publicId: image.publicId }, 'Could not delete old image');
    }
  }
}
