/**
 * Enumerations shared by the API and the web app.
 * Each is a readonly tuple so it can drive both a TypeScript union type and a Zod enum.
 */

export const ROLES = ['STUDENT', 'SECURITY_DESK', 'UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Higher rank = more authority. Admins manage only people ranked below them and give roles up
 * to their own rank (enforced by the API; the web app uses it to hide actions that would fail).
 */
export const ROLE_RANK: Readonly<Record<Role, number>> = {
  STUDENT: 0,
  SECURITY_DESK: 1,
  UNIVERSITY_ADMIN: 2,
  PLATFORM_ADMIN: 3,
};

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ITEM_TYPES = ['LOST', 'FOUND'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ['OPEN', 'RESERVED', 'RESOLVED', 'REMOVED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_CATEGORIES = [
  'ELECTRONICS',
  'ID_CARD',
  'KEYS',
  'WALLET',
  'BAG',
  'CLOTHING',
  'BOOKS',
  'BOTTLE',
  'ACCESSORIES',
  'OTHER',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** OWNERSHIP: "this found item is mine". FINDER: "I found this lost item". */
export const CLAIM_KINDS = ['OWNERSHIP', 'FINDER'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
