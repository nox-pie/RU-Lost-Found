import { z } from 'zod';
import type { MeDto } from './auth';
import type { ClaimDto } from './claims';
import type { ItemDto } from './items';
import type { NotificationDto } from './notifications';

/** Deleting an account can't be undone, so the password is asked again. */
export const deleteAccountSchema = z
  .object({ password: z.string().min(1, 'Enter your password').max(200) })
  .strict();

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** Everything the platform holds about the signed-in person ("Download my data"). */
export interface AccountExportDto {
  exportedAt: string;
  account: MeDto;
  /** Every post they made, removed ones included, newest first. */
  posts: ItemDto[];
  claimsMade: ClaimDto[];
  /** Claims other people made on their posts. */
  claimsReceived: ClaimDto[];
  notifications: NotificationDto[];
}
