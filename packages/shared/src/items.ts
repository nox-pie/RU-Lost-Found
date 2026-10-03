import { z } from 'zod';
import {
  ITEM_CATEGORIES,
  ITEM_TYPES,
  type ItemCategory,
  type ItemStatus,
  type ItemType,
} from './enums';

export const MAX_ITEM_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VERIFICATION_QUESTIONS = 3;

/** Statuses that can be listed; removed items never appear in lists. */
export const LISTABLE_ITEM_STATUSES = [
  'OPEN',
  'RESERVED',
  'RESOLVED',
] as const satisfies readonly ItemStatus[];

/** A calendar date, e.g. "2026-10-01", as sent by an <input type="date">. */
export const dateOnlySchema = z
  .string()
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    'Enter a valid date (YYYY-MM-DD)',
  );

/** Multipart forms send booleans as text. */
const formBoolean = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean(),
);

/** A repeated form field arrives as a string (one value) or an array (several). Blank values are dropped. */
const formStringList = (item: z.ZodString, max: number, label: string) =>
  z.preprocess(
    (value) =>
      (value === undefined ? [] : Array.isArray(value) ? value : [value]).filter(
        (entry) => typeof entry !== 'string' || entry.trim() !== '',
      ),
    z.array(item).max(max, `Add at most ${max} ${label}`),
  );

const itemTextFields = {
  category: z.enum(ITEM_CATEGORIES),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80),
  description: z.string().trim().min(10, 'Describe the item in at least 10 characters').max(1000),
  location: z.string().trim().min(2, 'Enter where it was lost or found').max(100),
  occurredOn: dateOnlySchema,
};

/** Text fields of the multipart "report an item" form (photos travel in the `photos` field). */
export const createItemSchema = z
  .object({
    type: z.enum(ITEM_TYPES),
    ...itemTextFields,
    heldAtSecurityDesk: formBoolean.default(false),
    questions: formStringList(
      z.string().trim().min(5, 'Each question needs at least 5 characters').max(150),
      MAX_VERIFICATION_QUESTIONS,
      'verification questions',
    ).default([]),
  })
  .strict();

export const updateItemSchema = z
  .object({ ...itemTextFields, heldAtSecurityDesk: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const itemIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id'),
});

export const listItemsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    type: z.enum(ITEM_TYPES).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    /** Comma-separated, e.g. `OPEN,RESERVED` (the default: everything still in play). */
    status: z
      .string()
      .transform((value) => value.split(',').map((status) => status.trim()))
      .pipe(z.array(z.enum(LISTABLE_ITEM_STATUSES)).min(1))
      .default('OPEN,RESERVED'),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/**
 * The tabs of the browse page: which posts each shows. Shared, so the lists (filters sent by the
 * web app) and the counts (computed by the API) can't disagree.
 */
export const FEED_TABS = {
  all: { statuses: ['OPEN', 'RESERVED'] },
  lost: { type: 'LOST', statuses: ['OPEN'] },
  found: { type: 'FOUND', statuses: ['OPEN'] },
  returned: { statuses: ['RESOLVED'] },
} as const satisfies Record<
  string,
  { type?: ItemType; statuses: readonly (typeof LISTABLE_ITEM_STATUSES)[number][] }
>;

export type FeedTab = keyof typeof FEED_TABS;

/** How many posts each browse tab has for a search and category. */
export type ItemCountsDto = Record<FeedTab, number>;

export const itemCountsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
  })
  .strict();

export type ItemCountsQuery = z.infer<typeof itemCountsQuerySchema>;

export const pageQuerySchema = z
  .object({
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;

/** A page of results. Pass `nextCursor` back as `cursor` to get the next page; null means the end. */
export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface PersonSummaryDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ItemDto {
  id: string;
  type: ItemType;
  category: ItemCategory;
  title: string;
  description: string;
  location: string;
  /** YYYY-MM-DD */
  occurredOn: string;
  photos: string[];
  status: ItemStatus;
  heldAtSecurityDesk: boolean;
  verificationQuestions: { id: string; question: string }[];
  reporter: PersonSummaryDto;
  /** True when the signed-in user reported this item. */
  isMine: boolean;
  /** A sample post of the demo data: shown with a "Sample post" badge. */
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
