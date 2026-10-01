import { useInfiniteQuery } from '@tanstack/react-query';
import { PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { itemsApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';
import { ItemGrid } from './ItemCard';
import { ReportItemDialog } from './ReportItemDialog';

export default function MyItemsPage() {
  const [reporting, setReporting] = useState(false);
  const query = useInfiniteQuery({
    queryKey: queryKeys.items.mine,
    queryFn: ({ pageParam }) => itemsApi.mine(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">My items</h1>
          <p className="mt-1 text-gray-600">
            Everything you've reported. Open one to see its claims.
          </p>
        </div>
        <Button onClick={() => setReporting(true)}>Report an item</Button>
      </div>
      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-10 w-10" />}
          title="You haven't reported anything yet"
        >
          When you lose or find something, report it here with a photo.
        </EmptyState>
      ) : (
        <>
          <ItemGrid items={items} />
          {query.hasNextPage && (
            <div className="mt-10 flex justify-center">
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
      <ReportItemDialog open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}
