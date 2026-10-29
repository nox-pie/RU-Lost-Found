import { ITEM_CATEGORIES, dateOnlySchema } from '@ru-lost-found/shared';
import { z } from 'zod';

/** The details of a post, as the report and edit forms check them (same rules as the API). */
export const itemDetailsFields = {
  category: z.enum(ITEM_CATEGORIES, { message: 'Choose a category' }),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80),
  description: z.string().trim().min(10, 'Describe the item in at least 10 characters').max(1000),
  location: z.string().trim().min(2, 'Enter where it was lost or found').max(100),
  /** A campus place, or '' for somewhere else. */
  place: z.string(),
  occurredOn: dateOnlySchema,
  heldAtSecurityDesk: z.boolean(),
};

export type ItemDetailsForm = z.infer<z.ZodObject<typeof itemDetailsFields>>;
