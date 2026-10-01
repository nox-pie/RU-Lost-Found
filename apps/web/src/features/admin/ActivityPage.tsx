import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditEntryDto,
  type ReportReason,
  type Role,
} from '@ru-lost-found/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Avatar, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi } from '../../lib/api/endpoints';
import {
  AUDIT_ACTION_LABELS,
  REPORT_REASON_LABELS,
  ROLE_LABELS,
  formatDateTime,
} from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

const LOGIN_FAILURES: Record<string, string> = {
  UNKNOWN_EMAIL: 'no account with that email',
  WRONG_PASSWORD: 'wrong password',
  SUSPENDED: 'account suspended',
};

/** One line of extra detail from an entry's metadata, where it helps. */
function detailOf(entry: AuditEntryDto): string | null {
  const m = entry.metadata;
  const text = (key: string) => (typeof m[key] === 'string' ? m[key] : null);
  switch (entry.action) {
    case 'USER_ROLE_CHANGED': {
      const from = text('from') as Role | null;
      const to = text('to') as Role | null;
      return from && to ? `${ROLE_LABELS[from]} → ${ROLE_LABELS[to]}` : null;
    }
    case 'USER_SUSPENDED':
      return text('reason') && `Reason: ${text('reason')}`;
    case 'LOGIN_FAILED':
      return LOGIN_FAILURES[text('reason') ?? ''] ?? null;
    case 'ITEM_FLAGGED': {
      const reason = text('reason') as ReportReason | null;
      return reason ? REPORT_REASON_LABELS[reason] : null;
    }
    case 'REPORT_RESOLVED':
      return text('decision') === 'REMOVE_ITEM' ? 'Post removed' : 'Post kept';
    case 'ITEM_REMOVED':
      return m.byModerator === true
        ? `By an admin${text('reason') ? ` · ${text('reason')}` : ''}`
        : 'By the person who posted it';
    case 'CLAIM_REJECTED':
    case 'CLAIM_CANCELLED':
      return m.automatic === true ? 'Automatically' : null;
    default:
      return null;
  }
}

export default function ActivityPage() {
  const [action, setAction] = useState<AuditAction | ''>('');
  const filters = { action: action || undefined };

  const query = useInfiniteQuery({
    queryKey: queryKeys.admin.activity(filters),
    queryFn: ({ pageParam }) => adminApi.activity(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const entries = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-md text-sm text-gray-600">
          Security-relevant actions in the last year: sign-ins, posts, claims and admin decisions.
        </p>
        <div className="w-full sm:w-64">
          <Select
            label="Show"
            value={action}
            onChange={(event) => setAction(event.target.value as AuditAction | '')}
          >
            <option value="">Everything</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState icon={<History className="h-10 w-10" />} title="No activity yet" />
        ) : (
          <>
            <ol className="divide-y overflow-hidden rounded-2xl bg-white shadow-sm">
              {entries.map((entry) => {
                const detail = detailOf(entry);
                const who =
                  entry.actor?.name ?? (entry.action === 'LOGIN_FAILED' ? 'Someone' : 'System');
                return (
                  <li key={entry.id} className="flex gap-3 p-4">
                    <Avatar name={who} url={entry.actor?.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-grow text-sm">
                      <p className="text-gray-900">
                        <span className="font-medium">{who}</span> ·{' '}
                        {AUDIT_ACTION_LABELS[entry.action]}
                      </p>
                      {detail && <p className="mt-0.5 break-words text-gray-600">{detail}</p>}
                      <p className="mt-0.5 text-xs text-gray-500">
                        <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt)}</time>
                        {entry.ip && <> · {entry.ip}</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {query.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  loading={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
