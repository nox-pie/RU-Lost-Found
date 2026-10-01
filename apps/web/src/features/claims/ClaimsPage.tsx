import type { ClaimDto } from '@ru-lost-found/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Inbox } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { claimsApi } from '../../lib/api/endpoints';
import { CLAIM_STATUS, timeAgo } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

const VIEWS = [
  { id: 'received', label: 'On my items' },
  { id: 'mine', label: 'Made by me' },
] as const;
const ACTIVE = 'REQUESTED,APPROVED';

export default function ClaimsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'mine' ? 'mine' : 'received';
  const showAll = params.get('show') === 'all';
  const status = showAll ? '' : ACTIVE;

  const update = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });

  const query = useInfiniteQuery({
    queryKey: view === 'mine' ? queryKeys.claims.mine(status) : queryKeys.claims.received(status),
    queryFn: ({ pageParam }) =>
      view === 'mine'
        ? claimsApi.mine({ status: status || undefined }, pageParam)
        : claimsApi.received({ status: status || undefined }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const claims = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-gray-900">Claims</h1>
      <p className="mt-1 text-gray-600">Follow every claim from request to handover.</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex rounded-full bg-white p-1 shadow-sm">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={view === v.id}
              onClick={() => update('view', v.id === 'received' ? null : v.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${view === v.id ? 'bg-primary text-white' : 'text-gray-600'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => update('show', event.target.checked ? 'all' : null)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Include closed claims
        </label>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : claims.length === 0 ? (
          <EmptyState icon={<Inbox className="h-10 w-10" />} title="No claims here">
            {view === 'received'
              ? 'When someone claims an item you reported, it shows up here.'
              : 'Found your lost item on the site? Open it and claim it.'}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl bg-white shadow-sm">
              {claims.map((claim) => (
                <ClaimListRow key={claim.id} claim={claim} />
              ))}
            </ul>
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

function ClaimListRow({ claim }: { claim: ClaimDto }) {
  const status = CLAIM_STATUS[claim.status];
  const person = claim.myRole === 'CLAIMANT' ? claim.reporter : claim.claimant;
  const needsMe =
    (claim.myRole === 'REPORTER' && claim.status === 'REQUESTED') || claim.status === 'APPROVED';

  return (
    <li>
      <Link to={`/claims/${claim.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50">
        {claim.item.photo ? (
          <img
            src={claim.item.photo}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <Avatar name={person.name} url={person.avatarUrl} />
        )}
        <div className="min-w-0 flex-grow">
          <p className="truncate font-medium text-gray-900">{claim.item.title}</p>
          <p className="truncate text-sm text-gray-500">
            {claim.myRole === 'CLAIMANT' ? `Reported by ${person.name}` : `From ${person.name}`} ·{' '}
            {timeAgo(claim.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {needsMe && (
            <span
              className="hidden h-2 w-2 rounded-full bg-primary sm:block"
              aria-label="Needs attention"
            />
          )}
          <Badge tone={status.tone}>{status.label}</Badge>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </Link>
    </li>
  );
}
