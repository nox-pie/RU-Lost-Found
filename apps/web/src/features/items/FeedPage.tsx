import { FEED_TABS, type FeedTab, type ItemCategory } from '@ru-lost-found/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CalendarDays, LayoutGrid, MapPin, PackageSearch, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Input } from '../../components/ui/Field';
import { EmptyState, ErrorState } from '../../components/ui/misc';
import { itemsApi, type FeedFilters, type ItemFilters } from '../../lib/api/endpoints';
import { CATEGORY_OPTIONS } from '../../lib/categories';
import { daysAgoIso, todayIso } from '../../lib/format';
import { useDebouncedValue } from '../../lib/hooks';
import { queryKeys } from '../../lib/queryClient';
import { useCampusPlaces } from './campusPlaces';
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

/** "When" is about the day the item was lost or found, not when it was posted. */
type When = '' | 'today' | 'week' | 'month' | 'custom';

const WHEN_OPTIONS: readonly DropdownOption<When>[] = [
  { value: '', label: 'Any time', icon: CalendarDays },
  { value: 'today', label: 'Today', icon: CalendarDays },
  { value: 'week', label: 'Last 7 days', icon: CalendarDays },
  { value: 'month', label: 'Last 30 days', icon: CalendarDays },
  { value: 'custom', label: 'Choose dates…', icon: CalendarDays },
];

/** How many days before today each quick choice starts (today is one of the days). */
const DAYS_BACK = { today: 0, week: 6, month: 29 } as const;

/** The day range of a "When" choice; "Choose dates…" takes the From and To boxes. */
function dayRange(when: When, from: string, to: string): FeedFilters {
  if (when === 'custom') {
    return { ...(from && { occurredFrom: from }), ...(to && { occurredTo: to }) };
  }
  return when ? { occurredFrom: daysAgoIso(DAYS_BACK[when]) } : {};
}

export default function FeedPage() {
  // Filters live in the URL, so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'all';
  const category = (params.get('category') ?? '') as ItemCategory | '';
  const place = params.get('place') ?? '';
  const when = WHEN_OPTIONS.find((option) => option.value === params.get('when'))?.value ?? '';
  const fromDay = params.get('from') ?? '';
  const toDay = params.get('to') ?? '';
  const backwards = when === 'custom' && Boolean(fromDay && toDay && toDay < fromDay);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim());
  const [reporting, setReporting] = useState(false);
  const places = useCampusPlaces();

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const searchFilters: FeedFilters = {
    ...(category ? { category } : {}),
    ...(q ? { q } : {}),
    ...(place ? { place } : {}),
    ...dayRange(when, fromDay, toDay),
  };
  const filters: ItemFilters = { ...tabFilters(tab), ...searchFilters };
  const filtered = Boolean(q || category || place || when);

  const clearFilters = () => {
    setSearch('');
    update({ q: '', category: '', place: '', when: '', from: '', to: '' });
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.items.list(filters),
    queryFn: ({ pageParam }) => itemsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !backwards,
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  // Tab counts for the same filters (a separate, cheap query; the list keeps its cursor
  // pagination).
  const counts = useQuery({
    queryKey: queryKeys.items.counts(searchFilters),
    queryFn: () => itemsApi.counts(searchFilters),
    enabled: !backwards,
  });
  const total = counts.data?.[tab];

  return (
    <>
      <section className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold leading-tight text-gray-900 sm:text-5xl sm:leading-none">
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
              update({ q: event.target.value.trim() });
            }}
            placeholder="Search by name, place or description"
            aria-label="Search items"
            className="w-full rounded-full border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/60"
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
                onClick={() => update({ tab: t.id === 'all' ? '' : t.id })}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 shadow-xs hover:bg-gray-50'}`}
              >
                {t.label}
                {counts.data && (
                  <span
                    className={`ml-1.5 tabular-nums ${tab === t.id ? 'text-white' : 'text-gray-500'}`}
                  >
                    {counts.data[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Dropdown<ItemCategory | ''>
            label="Category"
            hideLabel
            look="pill"
            className="w-44 sm:w-52"
            value={category}
            onChange={(value) => update({ category: value })}
            options={[
              { value: '', label: 'All categories', icon: LayoutGrid },
              ...CATEGORY_OPTIONS,
            ]}
          />
          {places.length > 0 && (
            <Dropdown
              label="Place"
              hideLabel
              look="pill"
              className="w-44 sm:w-52"
              value={place}
              onChange={(value) => update({ place: value })}
              options={[
                { value: '', label: 'All places', icon: MapPin },
                ...places.map((name) => ({ value: name, label: name, icon: MapPin })),
              ]}
            />
          )}
          <Dropdown<When>
            label="When"
            hideLabel
            look="pill"
            className="w-48"
            value={when}
            // Only "Choose dates…" uses the From and To boxes.
            onChange={(value) =>
              update({ when: value, ...(value !== 'custom' && { from: '', to: '' }) })
            }
            options={WHEN_OPTIONS}
          />
        </div>
        {when === 'custom' && (
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
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
        )}
      </section>

      {backwards ? null : query.isPending ? (
        <ItemGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<PackageSearch className="h-10 w-10" />} title="No items found">
          {filtered || tab !== 'all' ? (
            <>
              <p>Try a different search or filter.</p>
              {filtered && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </>
          ) : (
            'Nothing has been reported yet. Lost or found something? Be the first to report it.'
          )}
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
