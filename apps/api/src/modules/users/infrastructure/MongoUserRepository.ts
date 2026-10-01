import { ROLES, USER_STATUSES, type Role, type UserStatus } from '@ru-lost-found/shared';
import { Schema, type Connection, type Types } from 'mongoose';
import type { ImageRef } from '../../../core/domain/ImageRef';
import {
  decodeCursor,
  toPage,
  type PageRequest,
  type PageResult,
} from '../../../core/persistence/Pagination';
import type { TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import {
  MongoRepository,
  modelFor,
  type DocumentFilter,
  type OutboxWriter,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import {
  fromObjectId,
  parseObjectId,
  toObjectId,
} from '../../../infrastructure/database/objectIds';
import {
  collectionOptions,
  defineSchema,
  imageRefSchema,
} from '../../../infrastructure/database/schemas';
import { User, normalizeEmail } from '../domain/User';
import type { UserRepository, UserSearchCriteria } from '../domain/UserRepository';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface UserDocument extends VersionedDocument {
  universityId: Types.ObjectId;
  email: string;
  passwordHash: string;
  profile: {
    firstName: string;
    lastName: string;
    year: number;
    school: string;
    enrollmentNumber: string;
    phone: string | null;
    avatar: ImageRef | null;
  };
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = defineSchema(
  {
    universityId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      year: { type: Number, required: true },
      school: { type: String, required: true },
      enrollmentNumber: { type: String, required: true },
      phone: { type: String, default: null },
      avatar: { type: imageRefSchema, default: null },
    },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  collectionOptions('users'),
);
userSchema.index({ email: 1 }, { unique: true, name: 'uniq_email' });
userSchema.index({ universityId: 1, role: 1 }, { name: 'by_university_role' });
userSchema.index({ universityId: 1, createdAt: -1, _id: -1 }, { name: 'by_university_newest' });

export class MongoUserRepository
  extends MongoRepository<User, UserDocument>
  implements UserRepository
{
  constructor(connection: Connection, outbox?: OutboxWriter) {
    super(modelFor(connection, 'User', userSchema), outbox);
  }

  findById(id: string, tx?: TransactionContext): Promise<User | null> {
    const _id = parseObjectId(id);
    return _id ? this.findOne({ _id }, tx) : Promise.resolve(null);
  }

  findByEmail(email: string, tx?: TransactionContext): Promise<User | null> {
    return this.findOne({ email: normalizeEmail(email) }, tx);
  }

  findByIds(ids: readonly string[]): Promise<User[]> {
    const objectIds = [...new Set(ids)].map(parseObjectId).filter((id) => id !== null);
    if (objectIds.length === 0) return Promise.resolve([]);
    return this.findMany({ _id: { $in: objectIds } });
  }

  async search(
    scope: TenantScope,
    criteria: UserSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<User>> {
    const and: DocumentFilter[] = [{ universityId: toObjectId(scope.universityId) }];
    if (criteria.role) and.push({ role: criteria.role });
    if (criteria.status) and.push({ status: criteria.status });
    // "asha ver" finds Asha Verma: each word is a case-insensitive prefix of some field.
    for (const word of criteria.text?.split(/\s+/).filter(Boolean).slice(0, 4) ?? []) {
      const prefix = new RegExp(`^${escapeRegex(word)}`, 'i');
      and.push({
        $or: [{ 'profile.firstName': prefix }, { 'profile.lastName': prefix }, { email: prefix }],
      });
    }
    if (page.cursor) {
      const after = decodeCursor(page.cursor);
      and.push({
        $or: [
          { createdAt: { $lt: after.createdAt } },
          { createdAt: after.createdAt, _id: { $lt: toObjectId(after.id) } },
        ],
      });
    }
    const rows = await this.findMany(
      { $and: and },
      { sort: { createdAt: -1, _id: -1 }, limit: page.limit + 1 },
    );
    return toPage(rows, page.limit);
  }

  protected override duplicateKeyMessage(): string {
    return 'An account with this email already exists.';
  }

  protected toEntity(doc: UserDocument): User {
    return User.restore({
      id: fromObjectId(doc._id),
      universityId: fromObjectId(doc.universityId),
      email: doc.email,
      passwordHash: doc.passwordHash,
      profile: {
        firstName: doc.profile.firstName,
        lastName: doc.profile.lastName,
        year: doc.profile.year,
        school: doc.profile.school,
        enrollmentNumber: doc.profile.enrollmentNumber,
        phone: doc.profile.phone ?? null,
        avatar: doc.profile.avatar
          ? { url: doc.profile.avatar.url, publicId: doc.profile.avatar.publicId }
          : null,
      },
      role: doc.role,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: doc.version,
    });
  }

  protected toDocument(user: User): Omit<UserDocument, 'version'> {
    return {
      _id: toObjectId(user.id),
      universityId: toObjectId(user.universityId),
      email: user.email,
      passwordHash: user.passwordHash,
      profile: { ...user.profile },
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
