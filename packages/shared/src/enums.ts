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

export const ITEM_STATUSES = ['OPEN', 'RESERVED', 'RESOLVED', 'CLOSED', 'REMOVED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/**
 * Why a post was closed without a handover through the portal: back with its owner some other
 * way, no longer needed, or closed automatically after nobody kept it open.
 */
export const ITEM_CLOSE_REASONS = ['RETURNED', 'WITHDRAWN', 'EXPIRED'] as const;
export type ItemCloseReason = (typeof ITEM_CLOSE_REASONS)[number];

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

/** Years of study: up to 6, the longest programme (the PhD). Kept here, free of zod, for the web forms. */
export const MAX_YEAR_OF_STUDY = 6;
