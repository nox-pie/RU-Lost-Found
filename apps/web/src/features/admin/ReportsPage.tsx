import type { ModerationReportDto } from '@ru-lost-found/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Avatar, Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi } from '../../lib/api/endpoints';
import { ITEM_STATUS, REPORT_REASON_LABELS, timeAgo } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

type View = 'OPEN' | 'RESOLVED';

/** Reports on one post; an admin decides on all of them at once. */
interface PostReports {
  item: ModerationReportDto['item'];
  reports: ModerationReportDto[];
}

function groupByPost(reports: ModerationReportDto[]): PostReports[] {
  const groups = new Map<string, PostReports>();
  for (const report of reports) {
    const group = groups.get(report.item.id) ?? { item: report.item, reports: [] };
    group.reports.push(report);
    groups.set(report.item.id, group);
  }
  return [...groups.values()];
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'decided' ? 'RESOLVED' : 'OPEN';

  const query = useInfiniteQuery({
    queryKey: queryKeys.admin.reports(view),
    queryFn: ({ pageParam }) => adminApi.reports(view, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const reports = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="max-w-3xl">
      <div role="tablist" className="inline-flex rounded-full bg-white p-1 shadow-sm">
        {(['OPEN', 'RESOLVED'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={view === tab}
            onClick={() => setParams(tab === 'OPEN' ? {} : { view: 'decided' })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${view === tab ? 'bg-primary text-white' : 'text-gray-600'}`}
          >
            {tab === 'OPEN' ? 'To review' : 'Decided'}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : reports.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="h-10 w-10" />} title="Nothing here">
            {view === 'OPEN'
              ? 'When someone reports a post, it shows up here for review.'
              : 'Reports you decide on are kept here.'}
          </EmptyState>
        ) : (
          <>
            <ul className="space-y-4">
              {view === 'OPEN'
                ? groupByPost(reports).map((group) => (
                    <OpenReportCard key={group.item.id} group={group} />
                  ))
                : reports.map((report) => <DecidedReportRow key={report.id} report={report} />)}
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

function PostSummary({ item }: { item: ModerationReportDto['item'] }) {
  const status = ITEM_STATUS[item.status];
  const content = (
    <>
      {item.photoUrl ? (
        <img src={item.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-100" />
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-900">{item.title}</p>
        <p className="truncate text-sm text-gray-500">
          {item.type === 'LOST' ? 'Lost' : 'Found'} · posted by {item.reporter.name}
        </p>
        <div className="mt-1">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>
    </>
  );
  // Removed posts can't be opened any more.
  return item.status === 'REMOVED' ? (
    <div className="flex items-center gap-3">{content}</div>
  ) : (
    <Link to={`/items/${item.id}`} className="flex items-center gap-3 hover:opacity-90">
      {content}
    </Link>
  );
}

function OpenReportCard({ group }: { group: PostReports }) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const [note, setNote] = useState('');

  const decide = useMutation({
    mutationFn: (decision: 'REMOVE_ITEM' | 'DISMISS') =>
      adminApi.moderate(group.item.id, { decision, note: note.trim() || undefined }),
    onSuccess: async (_result, decision) => {
      setRemoving(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success(decision === 'REMOVE_ITEM' ? 'Post removed.' : 'Post kept; reports closed.');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <PostSummary item={group.item} />
      <ul className="mt-4 space-y-3 border-t pt-4">
        {group.reports.map((report) => (
          <li key={report.id} className="flex gap-3">
            <Avatar name={report.flaggedBy.name} url={report.flaggedBy.avatarUrl} size="sm" />
            <div className="min-w-0 text-sm">
              <p className="text-gray-900">
                <span className="font-medium">{report.flaggedBy.name}</span> ·{' '}
                {REPORT_REASON_LABELS[report.reason]}
              </p>
              {report.details && (
                <p className="mt-0.5 break-words text-gray-600">“{report.details}”</p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">{timeAgo(report.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={decide.isPending && decide.variables === 'DISMISS'}
          disabled={decide.isPending}
          onClick={() => decide.mutate('DISMISS')}
        >
          <Check className="h-4 w-4" /> Keep post
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={decide.isPending}
          onClick={() => setRemoving(true)}
        >
          <Trash2 className="h-4 w-4" /> Remove post
        </Button>
      </div>

      <Modal open={removing} onClose={() => setRemoving(false)} title="Remove this post?">
        <p className="text-sm text-gray-600">
          “{group.item.title}” will disappear from the site, its open claims will be closed, and{' '}
          {group.item.reporter.name} will be told why.
        </p>
        <div className="mt-4">
          <Textarea
            label="Reason shown to the poster (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="e.g. Posts must be about lost or found items"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(false)} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={decide.isPending}
            onClick={() => decide.mutate('REMOVE_ITEM')}
          >
            Remove post
          </Button>
        </div>
      </Modal>
    </li>
  );
}

function DecidedReportRow({ report }: { report: ModerationReportDto }) {
  const removed = report.status === 'ACTIONED';
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <PostSummary item={report.item} />
      <div className="mt-3 border-t pt-3 text-sm text-gray-600">
        <p>
          <span className="font-medium text-gray-900">{report.flaggedBy.name}</span> reported it as{' '}
          {REPORT_REASON_LABELS[report.reason].toLowerCase()} {timeAgo(report.createdAt)}.
        </p>
        {report.resolution && (
          <p className="mt-1">
            <Badge tone={removed ? 'danger' : 'success'}>{removed ? 'Removed' : 'Kept'}</Badge> by{' '}
            {report.resolution.by.name} · {timeAgo(report.resolution.at)}
            {report.resolution.note && <> · “{report.resolution.note}”</>}
          </p>
        )}
      </div>
    </li>
  );
}
