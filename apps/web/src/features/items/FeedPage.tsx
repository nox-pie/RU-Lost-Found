import { FEED_TABS, ITEM_CATEGORIES, type FeedTab, type ItemCategory } from '@ru-lost-found/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PackageSearch, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/misc';
import { itemsApi, type ItemFilters } from '../../lib/api/endpoints';
import { CATEGORY_LABELS } from '../../lib/format';
import { useDebouncedValue } from '../../lib/hooks';
import { queryKeys } from '../../lib/queryClient';
import { ItemGrid, ItemGridSkeleton } from './ItemCard';
import { ReportItemDialog } from './ReportItemDialog';

const TABS: readonly { id: FeedTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lost', label: 'Lost' },
  { id: 'found', label: 'Found' },
  { id: 'returned', label: 'Returned' },
];

/** The list filters of a tab, from the definition the API also counts with. */
function tabFilters(tab: FeedTab): ItemFilters {
  const definition: { type?: 'LOST' | 'FOUND'; statuses: readonly string[] } = FEED_TABS[tab];
  return { type: definition.type, status: definition.statuses.join(',') };
}

export default function FeedPage() {
  // Filters live in the URL, so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'all';
  const category = (params.get('category') ?? '') as ItemCategory | '';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim());
  const [reporting, setReporting] = useState(false);

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const searchFilters = {
    ...(category ? { category } : {}),
    ...(q ? { q } : {}),
  };
  const filters: ItemFilters = { ...tabFilters(tab), ...searchFilters };

  const query = useInfiniteQuery({
    queryKey: queryKeys.items.list(filters),
    queryFn: ({ pageParam }) => itemsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  // Tab counts for the same search and category (a separate, cheap query; the list keeps its
  // cursor pagination).
  const counts = useQuery({
    queryKey: queryKeys.items.counts(searchFilters),
    queryFn: () => itemsApi.counts(searchFilters),
  });
  const total = counts.data?.[tab];

  return (
    <>
      <section className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold leading-tight text-gray-900 sm:text-5xl">
          Lost something? Found something?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-gray-600 sm:text-lg">
          Report it with a photo, find it here, and get it back through a verified handover.
        </p>
        <Button size="lg" className="mt-6 rounded-full px-8" onClick={() => setReporting(true)}>
          <Plus className="h-5 w-5" /> Report an item
        </Button>
      </section>

      <section aria-label="Filters" className="mb-8 space-y-4">
        <div className="relative mx-auto max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setParam('q', event.target.value.trim());
            }}
            placeholder="Search by name, place or description"
            aria-label="Search items"
            className="w-full rounded-full border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setParam('tab', t.id === 'all' ? '' : t.id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-primary text-white shadow' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}
              >
                {t.label}
                {counts.data && (
                  <span
                    className={`ml-1.5 tabular-nums ${tab === t.id ? 'text-white/80' : 'text-gray-400'}`}
                  >
                    {counts.data[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(event) => setParam('category', event.target.value)}
            aria-label="Category"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            <option value="">All categories</option>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </section>

      {query.isPending ? (
        <ItemGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<PackageSearch className="h-10 w-10" />} title="No items found">
          {q || category || tab !== 'all'
            ? 'Try a different search or filter.'
            : 'Nothing has been reported yet. Lost or found something? Be the first to report it.'}
        </EmptyState>
      ) : (
        <>
          <ItemGrid items={items} />
          {total !== undefined && (
            <p className="mt-8 text-center text-sm text-gray-500" aria-live="polite">
              Showing {Math.min(items.length, total)} of {total}
            </p>
          )}
          {query.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <ReportItemDialog open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}
