import type {
  AuditAction,
  ClaimStatus,
  ItemCategory,
  ItemStatus,
  ReportReason,
  Role,
} from '@ru-lost-found/shared';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  ELECTRONICS: 'Electronics',
  ID_CARD: 'ID card',
  KEYS: 'Keys',
  WALLET: 'Wallet',
  BAG: 'Bag',
  CLOTHING: 'Clothing',
  BOOKS: 'Books',
  BOTTLE: 'Bottle',
  ACCESSORIES: 'Accessories',
  OTHER: 'Other',
};

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'neutral' },
  RESERVED: { label: 'Handover arranged', tone: 'warning' },
  RESOLVED: { label: 'Returned', tone: 'success' },
  REMOVED: { label: 'Removed', tone: 'muted' },
};

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Waiting for reply', tone: 'info' },
  APPROVED: { label: 'Approved · meet up', tone: 'warning' },
  REJECTED: { label: 'Declined', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
  EXPIRED: { label: 'Expired', tone: 'muted' },
  COMPLETED: { label: 'Handed over', tone: 'success' },
};

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  SECURITY_DESK: 'Security desk',
  UNIVERSITY_ADMIN: 'Admin',
  PLATFORM_ADMIN: 'Platform admin',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam or advertising',
  INAPPROPRIATE: 'Offensive or inappropriate',
  SCAM: 'Scam or fake post',
  DUPLICATE: 'Duplicate post',
  OTHER: 'Something else',
};

/** How each audit entry reads in the activity log. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_REGISTERED: 'Created an account',
  LOGIN_SUCCEEDED: 'Signed in',
  LOGIN_FAILED: 'Failed sign-in',
  PASSWORD_CHANGED: 'Changed password',
  SESSION_REUSE_DETECTED: 'Stolen session blocked',
  ITEM_REPORTED: 'Posted an item',
  ITEM_REMOVED: 'Removed a post',
  CLAIM_SUBMITTED: 'Made a claim',
  CLAIM_APPROVED: 'Approved a claim',
  CLAIM_REJECTED: 'Declined a claim',
  CLAIM_CANCELLED: 'Cancelled a claim',
  HANDOVER_CONFIRMED: 'Confirmed a handover',
  HANDOVER_CONFIRMED_BY_STAFF: 'Confirmed a handover in person',
  HANDOVER_LOCKED: 'Handover code locked',
  CLAIM_EXPIRED: 'Claim expired',
  USER_ROLE_CHANGED: 'Changed a role',
  USER_SUSPENDED: 'Suspended an account',
  USER_REACTIVATED: 'Reactivated an account',
  ITEM_FLAGGED: 'Reported a post',
  REPORT_RESOLVED: 'Decided on a report',
};

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'muted';

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "2026-10-01" (a calendar day) → "1 Oct 2026". */
export function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  return dateFormat.format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function formatPercent(fraction: number | null): string {
  return fraction === null ? '–' : `${Math.round(fraction * 100)}%`;
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "just now", "5 min ago", "3 h ago", or a date for anything older than a week. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`;
  return dateFormat.format(new Date(iso));
}

/** Today as YYYY-MM-DD in the user's own time zone (what a date input expects). */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
