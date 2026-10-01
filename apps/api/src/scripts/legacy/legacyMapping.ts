import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { ImageRef } from '../../core/domain/ImageRef';
import { withDeliveryTransformation } from '../../infrastructure/storage/CloudinaryStorageProvider';
import { Item } from '../../modules/items/domain/Item';
import type { University } from '../../modules/universities/domain/University';
import { User, normalizeEmail } from '../../modules/users/domain/User';

/** A user document of the first version (backend/models/User.js). */
export interface LegacyUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  year: string;
  school: string;
  enrollmentNumber: string;
  phone?: string;
  profilePicture?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** An item document of the first version (backend/models/Item.js). */
export interface LegacyItem {
  _id: Types.ObjectId;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  /** "YYYY-MM-DD" */
  date: string;
  reporterId: Types.ObjectId;
  status: 'open' | 'claimed';
  image?: string;
  /** Free-text contact details of whoever claimed it; not migrated (personal data). */
  claimedBy?: { name?: string; contact?: string; details?: string };
  createdAt?: Date;
  updatedAt?: Date;
}

export type Mapped<T> = { ok: T } | { skip: string };

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;
const CLOUDINARY_UPLOAD =
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:.+\/)?v\d+\/(.+)\.\w+$/;

/**
 * A stored image URL as an ImageRef. Cloudinary URLs keep their public id (so the clean-up job
 * can delete them later) and get the same delivery optimisation as new uploads.
 */
export function imageFromUrl(url: string | undefined): ImageRef | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const publicId = CLOUDINARY_UPLOAD.exec(trimmed)?.[1];
  if (publicId) return { url: withDeliveryTransformation(trimmed), publicId };
  // Not ours to delete: a recognisable id that no storage provider owns.
  return { url: trimmed, publicId: `legacy/${createHash('sha1').update(trimmed).digest('hex')}` };
}

function yearOf(value: string): number {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year >= 1 && year <= 6 ? year : 1;
}

/**
 * Old accounts keep their id (so their items stay linked) and their password: both versions
 * hash with bcrypt, so people sign in exactly as before.
 */
export function mapUser(doc: LegacyUser, university: University): Mapped<User> {
  const email = normalizeEmail(doc.email ?? '');
  if (!university.allowsEmail(email)) return { skip: 'email is not a university address' };
  if (!BCRYPT_HASH.test(doc.password ?? '')) return { skip: 'password is not a bcrypt hash' };

  const createdAt = doc.createdAt ?? doc._id.getTimestamp();
  return {
    ok: User.restore({
      id: doc._id.toHexString(),
      universityId: university.id,
      email,
      passwordHash: doc.password,
      profile: {
        firstName: doc.firstName?.trim() || 'Member',
        lastName: doc.lastName?.trim() || '',
        year: yearOf(doc.year),
        school: doc.school?.trim() || (university.schools[0] ?? 'Not specified'),
        enrollmentNumber: doc.enrollmentNumber?.trim() || 'Not specified',
        phone: doc.phone?.trim() || null,
        avatar: imageFromUrl(doc.profilePicture),
      },
      role: 'STUDENT',
      status: 'ACTIVE',
      createdAt,
      updatedAt: doc.updatedAt ?? createdAt,
      version: 0,
    }),
  };
}

function dayOf(value: string | undefined, fallback: Date): Date {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? new Date(`${value}T00:00:00.000Z`) : null;
  return day && Number.isFinite(day.getTime())
    ? day
    : new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate()));
}

/**
 * Old items had no category, questions or claims workflow: they become OTHER, without questions,
 * and "claimed" ones count as returned.
 */
export function mapItem(doc: LegacyItem, universityId: string, reporterId: string): Mapped<Item> {
  if (doc.type !== 'lost' && doc.type !== 'found') return { skip: `unknown type "${doc.type}"` };
  const createdAt = doc.createdAt ?? doc._id.getTimestamp();
  const updatedAt = doc.updatedAt ?? createdAt;
  const returned = doc.status === 'claimed';
  const image = imageFromUrl(doc.image);

  return {
    ok: Item.restore({
      id: doc._id.toHexString(),
      universityId,
      reporterId,
      type: doc.type === 'lost' ? 'LOST' : 'FOUND',
      category: 'OTHER',
      title: doc.title?.trim() || 'Untitled item',
      description: doc.description?.trim() || '',
      location: doc.location?.trim() || 'Not specified',
      occurredOn: dayOf(doc.date, createdAt),
      images: image ? [image] : [],
      verificationQuestions: [],
      heldAtSecurityDesk: false,
      status: returned ? 'RESOLVED' : 'OPEN',
      createdAt,
      updatedAt,
      resolvedAt: returned ? updatedAt : null,
      version: 0,
    }),
  };
}
