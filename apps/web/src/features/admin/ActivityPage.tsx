import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditEntryDto,
  type ReportReason,
  type Role,
} from '@ru-lost-found/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Avatar, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi, type ActivityFilters } from '../../lib/api/endpoints';
import {
  AUDIT_ACTION_LABELS,
  REPORT_REASON_LABELS,
  ROLE_LABELS,
  formatDateTime,
  todayIso,
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

/** "2026-10-03" (a day in the viewer's time zone) → the moment it starts, as an ISO string. */
function startOfLocalDay(day: string, plusDays = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, (date ?? 1) + plusDays).toISOString();
}

export default function ActivityPage() {
  // Filters live in the URL, so a filtered view can be shared or opened from the People tab.
  const [params, setParams] = useSearchParams();
  const action = (params.get('action') ?? '') as AuditAction | '';
  const actorId = params.get('actor') ?? '';
  const actorName = params.get('name') ?? 'this person';
  const fromDay = params.get('from') ?? '';
  const toDay = params.get('to') ?? '';
  const backwards = Boolean(fromDay && toDay && toDay < fromDay);

  const update = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });

  const filters: ActivityFilters = {
    action: action || undefined,
    actorId: actorId || undefined,
    from: fromDay ? startOfLocalDay(fromDay) : undefined,
    // "To" is inclusive for people: everything before the next day starts.
    until: toDay ? startOfLocalDay(toDay, 1) : undefined,
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.admin.activity(filters),
    queryFn: ({ pageParam }) => adminApi.activity(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !backwards,
  });
  const entries = query.data?.pages.flatMap((page) => page.data) ?? [];
  const filtered = Boolean(action || actorId || fromDay || toDay);

  return (
    <div className="max-w-3xl">
      <p className="max-w-xl text-sm text-gray-600">
        Security-relevant actions in the last year: sign-ins, posts, claims and admin decisions.
        Click a name to see everything that person did.
      </p>
      <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <Select
          label="Show"
          value={action}
          onChange={(event) => update({ action: event.target.value })}
        >
          <option value="">Everything</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <Input
          label="From"
          type="date"
          value={fromDay}
          max={toDay || todayIso()}
          onChange={(event) => update({ from: event.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={toDay}
          min={fromDay || undefined}
          max={todayIso()}
          onChange={(event) => update({ to: event.target.value })}
          error={backwards ? '"To" must be on or after "From"' : undefined}
        />
      </div>
      {(actorId || filtered) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {actorId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
              By {actorName}
              <button
                type="button"
                onClick={() => update({ actor: null, name: null })}
                aria-label={`Stop showing only ${actorName}`}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setParams({})}
            className="text-gray-500 underline hover:text-gray-800"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<History className="h-10 w-10" />}
            title={filtered ? 'Nothing matches these filters' : 'No activity yet'}
          />
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
                        {entry.actor ? (
                          <button
                            type="button"
                            onClick={() =>
                              update({
                                actor: entry.actor?.id ?? null,
                                name: entry.actor?.name ?? null,
                              })
                            }
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {who}
                          </button>
                        ) : (
                          <span className="font-medium">{who}</span>
                        )}{' '}
                        · {AUDIT_ACTION_LABELS[entry.action]}
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
