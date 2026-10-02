import type { ItemDto } from '@ru-lost-found/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PackageOpen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi, type AdminItemFilters } from '../../lib/api/endpoints';
import { CATEGORY_LABELS, ITEM_STATUS, timeAgo } from '../../lib/format';
import { useDebouncedValue } from '../../lib/hooks';
import { queryKeys } from '../../lib/queryClient';
import { RemovePostDialog } from '../moderation/RemovePostDialog';

/** Every post of the university, removed ones included, with removal for any of them. */
export default function PostsPage() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState<'' | 'LOST' | 'FOUND'>('');
  const q = useDebouncedValue(text.trim(), 300);
  const filters: AdminItemFilters = {
    q: q || undefined,
    status: status || undefined,
    type: type || undefined,
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.admin.items(filters),
    queryFn: ({ pageParam }) => adminApi.items(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const posts = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_12rem_10rem]">
        <Input
          label="Search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Title, place or description"
          maxLength={100}
        />
        <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Every status</option>
          <option value="OPEN">Open</option>
          <option value="RESERVED">Handover arranged</option>
          <option value="RESOLVED">Returned</option>
          <option value="REMOVED">Removed</option>
        </Select>
        <Select
          label="Type"
          value={type}
          onChange={(event) => setType(event.target.value as '' | 'LOST' | 'FOUND')}
        >
          <option value="">Lost and found</option>
          <option value="LOST">Lost</option>
          <option value="FOUND">Found</option>
        </Select>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState icon={<PackageOpen className="h-10 w-10" />} title="No posts found">
            Try another search, or clear the filters.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl bg-white shadow-sm">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} />
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

function PostRow({ post }: { post: ItemDto }) {
  const [removing, setRemoving] = useState(false);
  const status = ITEM_STATUS[post.status];
  const removed = post.status === 'REMOVED';

  const summary = (
    <>
      {post.photos[0] ? (
        <img src={post.photos[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-xl bg-gray-100" />
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-900">{post.title}</p>
        <p className="truncate text-sm text-gray-500">
          {post.type === 'LOST' ? 'Lost' : 'Found'} · {CATEGORY_LABELS[post.category]} · by{' '}
          {post.isMine ? 'you' : post.reporter.name} · {timeAgo(post.createdAt)}
        </p>
        <div className="mt-1">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>
    </>
  );

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      {removed ? (
        // Removed posts can't be opened any more.
        <div className="flex min-w-0 flex-grow items-center gap-3">{summary}</div>
      ) : (
        <Link
          to={`/items/${post.id}`}
          className="flex min-w-0 flex-grow items-center gap-3 hover:opacity-90"
        >
          {summary}
        </Link>
      )}
      {!removed && (
        <Button
          variant="danger"
          size="sm"
          className="self-start sm:self-auto"
          onClick={() => setRemoving(true)}
        >
          <Trash2 className="h-4 w-4" /> Remove
        </Button>
      )}
      <RemovePostDialog post={post} open={removing} onClose={() => setRemoving(false)} />
    </li>
  );
}
