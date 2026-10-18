import type { ClaimDto, ItemDto } from '@ru-lost-found/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Handshake, Lock, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { deskApi } from '../../lib/api/endpoints';
import { ITEM_STATUS, formatDateTime, formatDay } from '../../lib/format';
import { useDebouncedValue } from '../../lib/hooks';
import { queryKeys } from '../../lib/queryClient';

/**
 * The desk keeps this page open while people come and go, so its lists are always fetched again
 * when shown and refresh themselves every half minute.
 */
const LIVE = { staleTime: 0, refetchInterval: 30_000 } as const;

const VIEWS = [
  { id: 'handovers', label: 'Handovers waiting' },
  { id: 'items', label: 'Items at the desk' },
] as const;

/**
 * The security desk console: approved claims waiting for their handover, and the found items
 * handed in at the desk. Confirming a handover happens on the claim's page.
 */
export default function DeskPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'items' ? 'items' : 'handovers';

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Security desk</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-gray-900">Desk console</h1>
      <p className="mt-1 text-gray-600">
        Hand items back in person. Open a handover to check who is collecting, then confirm it once
        the item is in its owner’s hands.
      </p>

      <div role="tablist" className="mt-6 inline-flex rounded-full bg-white p-1 shadow-sm">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            onClick={() => setParams(v.id === 'handovers' ? {} : { view: v.id })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${view === v.id ? 'bg-primary text-white' : 'text-gray-600'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt-6">{view === 'items' ? <ItemsAtDesk /> : <HandoversWaiting />}</div>
    </div>
  );
}

function HandoversWaiting() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.claims.desk,
    queryFn: ({ pageParam }) => deskApi.handovers(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    ...LIVE,
  });
  const claims = query.data?.pages.flatMap((page) => page.data) ?? [];

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (claims.length === 0) {
    return (
      <EmptyState icon={<Handshake className="h-10 w-10" />} title="No handovers waiting">
        When a claim is approved, it shows up here until the item is handed over.
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl bg-white shadow-sm">
        {claims.map((claim) => (
          <HandoverRow key={claim.id} claim={claim} />
        ))}
      </ul>
      <LoadMore query={query} />
    </>
  );
}

function HandoverRow({ claim }: { claim: ClaimDto }) {
  return (
    <li>
      <Link to={`/claims/${claim.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50">
        <Thumbnail url={claim.item.photo} />
        <div className="min-w-0 flex-grow">
          <p className="truncate font-medium text-gray-900">{claim.item.title}</p>
          <p className="truncate text-sm text-gray-500">
            {claim.claimant.name} and {claim.reporter.name}
          </p>
          {claim.handover && (
            <p className="text-xs text-gray-500">
              Meet by {formatDateTime(claim.handover.deadline)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {claim.handover?.locked && (
            <Badge tone="danger">
              <Lock className="mr-1 inline h-3 w-3" aria-hidden />
              Code locked
            </Badge>
          )}
          <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

function ItemsAtDesk() {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300) || undefined;
  const query = useInfiniteQuery({
    queryKey: queryKeys.items.desk(q ?? ''),
    queryFn: ({ pageParam }) => deskApi.items(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    ...LIVE,
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <Input
          label="Search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Title, place or description"
          maxLength={100}
        />
      </div>
      <div className="mt-4">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<PackageOpen className="h-10 w-10" />} title="Nothing at the desk">
            {q
              ? 'No item at the desk matches this search.'
              : 'Found items handed in at the desk show up here until they go back to their owner.'}
          </EmptyState>
        ) : (
          <>
            <ul
              className={`divide-y overflow-hidden rounded-2xl bg-white shadow-sm transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}
              aria-busy={query.isPlaceholderData}
            >
              {items.map((item) => (
                <DeskItemRow key={item.id} item={item} />
              ))}
            </ul>
            <LoadMore query={query} />
          </>
        )}
      </div>
    </>
  );
}

function DeskItemRow({ item }: { item: ItemDto }) {
  const status = ITEM_STATUS[item.status];
  return (
    <li>
      <Link to={`/items/${item.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50">
        <Thumbnail url={item.photos[0] ?? null} />
        <div className="min-w-0 flex-grow">
          <p className="truncate font-medium text-gray-900">{item.title}</p>
          <p className="truncate text-sm text-gray-500">
            Found {formatDay(item.occurredOn)} · {item.location}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={status.tone}>
            {item.status === 'OPEN' ? 'Waiting for owner' : status.label}
          </Badge>
          <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  return url ? (
    <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
  ) : (
    <span className="h-14 w-14 shrink-0 rounded-xl bg-gray-100" aria-hidden />
  );
}

function LoadMore({
  query,
}: {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
}) {
  if (!query.hasNextPage) return null;
  return (
    <div className="mt-6 flex justify-center">
      <Button
        variant="outline"
        loading={query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
      >
        Load more
      </Button>
    </div>
  );
}
