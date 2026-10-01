import { z } from 'zod';
import { otpCodeSchema } from './auth';
import {
  CLAIM_STATUSES,
  type ClaimKind,
  type ClaimStatus,
  type ItemStatus,
  type ItemType,
} from './enums';
import { MAX_VERIFICATION_QUESTIONS, type PersonSummaryDto } from './items';

export const submitClaimSchema = z
  .object({
    message: z.string().trim().max(500, 'Keep the message under 500 characters').default(''),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(10),
            answer: z.string().trim().min(1, 'Answer every question').max(300),
          })
          .strict(),
      )
      .max(MAX_VERIFICATION_QUESTIONS)
      .default([]),
    /** Let the reporter see my phone number once they approve. */
    sharePhone: z.boolean().default(false),
  })
  .strict();

export const approveClaimSchema = z
  .object({
    /** Let the claimant see my phone number. */
    sharePhone: z.boolean().default(false),
  })
  .strict();

export const rejectClaimSchema = z
  .object({ reason: z.string().trim().max(300).optional() })
  .strict();

export const handoverSchema = z.object({ code: otpCodeSchema }).strict();

export const claimIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id'),
});

export const listClaimsQuerySchema = z
  .object({
    /** Comma-separated statuses, e.g. `REQUESTED,APPROVED`. All statuses when absent. */
    status: z
      .string()
      .transform((value) => value.split(',').map((status) => status.trim()))
      .pipe(z.array(z.enum(CLAIM_STATUSES)).min(1))
      .optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;
export type ApproveClaimInput = z.infer<typeof approveClaimSchema>;
export type RejectClaimInput = z.infer<typeof rejectClaimSchema>;
export type HandoverInput = z.infer<typeof handoverSchema>;
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;

export type ClaimRole = 'CLAIMANT' | 'REPORTER' | 'STAFF';

export interface ContactDto {
  email: string;
  phone: string | null;
}

export interface ClaimDto {
  id: string;
  kind: ClaimKind;
  status: ClaimStatus;
  /** How the viewer relates to this claim. */
  myRole: ClaimRole;
  message: string;
  answers: { questionId: string; question: string; answer: string }[];
  item: { id: string; type: ItemType; title: string; status: ItemStatus; photo: string | null };
  claimant: PersonSummaryDto;
  reporter: PersonSummaryDto;
  /**
   * The other person's contact details. Only sent to the two people involved,
   * and only once the claim is approved (phone only if they chose to share it).
   */
  contact: ContactDto | null;
  /** Present while a handover is pending or done. `code` is only sent to the item's owner. */
  handover: {
    deadline: string;
    code: string | null;
    attemptsLeft: number;
    locked: boolean;
    /** True if the viewer is the one who enters the code. */
    viewerEntersCode: boolean;
  } | null;
  rejectionReason: string | null;
  history: { status: ClaimStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
}
