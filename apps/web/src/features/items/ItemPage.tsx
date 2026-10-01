import type { ClaimDto, ItemDto } from '@ru-lost-found/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Flag, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar, Badge, ErrorState, PageLoader } from '../../components/ui/misc';
import { claimsApi, itemsApi } from '../../lib/api/endpoints';
import { CATEGORY_LABELS, CLAIM_STATUS, ITEM_STATUS, formatDay, timeAgo } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';
import { isAdmin, useCurrentUser } from '../auth/authContext';
import { ClaimDialog } from '../claims/ClaimDialog';
import { FlagItemDialog } from '../moderation/FlagItemDialog';

export default function ItemPage() {
  const { id = '' } = useParams();
  const item = useQuery({ queryKey: queryKeys.items.detail(id), queryFn: () => itemsApi.get(id) });

  if (item.isPending) return <PageLoader />;
  if (item.isError) return <ErrorState error={item.error} onRetry={() => void item.refetch()} />;
  return <ItemView item={item.data} />;
}

function ItemView({ item }: { item: ItemDto }) {
  const [photo, setPhoto] = useState(0);
  const status = ITEM_STATUS[item.status];

  return (
    <div>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browsing
      </Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 shadow-card">
            <img src={item.photos[photo]} alt={item.title} className="h-full w-full object-cover" />
          </div>
          {item.photos.length > 1 && (
            <div className="mt-3 flex gap-3">
              {item.photos.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPhoto(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={photo === index}
                  className={`h-20 w-20 overflow-hidden rounded-xl ring-2 ${photo === index ? 'ring-primary' : 'ring-transparent'}`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${item.type === 'LOST' ? 'bg-primary' : 'bg-secondary'}`}
            >
              {item.type === 'LOST' ? 'Lost' : 'Found'}
            </span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-xs text-gray-500">{CATEGORY_LABELS[item.category]}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold text-gray-900">{item.title}</h1>
          <p className="mt-4 whitespace-pre-line text-gray-700">{item.description}</p>

          <dl className="mt-6 space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> <dt className="sr-only">Place</dt>
              <dd>{item.location}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> <dt className="sr-only">Date</dt>
              <dd>
                {item.type === 'LOST' ? 'Lost' : 'Found'} on {formatDay(item.occurredOn)}
              </dd>
            </div>
            {item.heldAtSecurityDesk && (
              <div className="flex items-center gap-2 text-green-700">
                <ShieldCheck className="h-4 w-4" />
                <dd>Handed in at the security desk</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <Avatar name={item.reporter.name} url={item.reporter.avatarUrl} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {item.isMine ? 'You' : item.reporter.name}
              </p>
              <p className="text-xs text-gray-500">Reported {timeAgo(item.createdAt)}</p>
            </div>
          </div>

          <div className="mt-6">
            {item.isMine ? <ReporterActions item={item} /> : <ClaimantActions item={item} />}
          </div>
          {!item.isMine && <ModerationActions item={item} />}
        </div>
      </div>
    </div>
  );
}

/** For everyone except the reporter: claim it, or see the claim they already made. */
function ClaimantActions({ item }: { item: ItemDto }) {
  const [claiming, setClaiming] = useState(false);
  const mine = useQuery({
    queryKey: queryKeys.claims.mine('REQUESTED,APPROVED'),
    queryFn: () => claimsApi.mine({ status: 'REQUESTED,APPROVED' }),
  });
  const existing = mine.data?.data.find((claim) => claim.item.id === item.id);

  if (existing) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        You've already made a claim on this item (
        {CLAIM_STATUS[existing.status].label.toLowerCase()}).{' '}
        <Link to={`/claims/${existing.id}`} className="font-semibold underline">
          View your claim
        </Link>
      </div>
    );
  }
  if (item.status === 'RESERVED') {
    return (
      <p className="text-sm text-gray-600">A handover is already being arranged for this item.</p>
    );
  }
  if (item.status === 'RESOLVED') {
    return <p className="text-sm text-green-700">This item has been returned to its owner. 🎉</p>;
  }
  return (
    <>
      <Button size="lg" className="w-full sm:w-auto" onClick={() => setClaiming(true)}>
        {item.type === 'FOUND' ? 'This is mine' : 'I found this'}
      </Button>
      <p className="mt-2 text-xs text-gray-500">
        {item.type === 'FOUND'
          ? 'You may be asked a few questions to prove it belongs to you.'
          : 'The owner will be told and can arrange to meet you.'}
      </p>
      <ClaimDialog item={item} open={claiming} onClose={() => setClaiming(false)} />
    </>
  );
}

/** For everyone but the reporter: report the post; admins can also remove it straight away. */
function ModerationActions({ item }: { item: ItemDto }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [flagging, setFlagging] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = useMutation({
    mutationFn: () => itemsApi.remove(item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success('The post was removed.');
      navigate('/');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-4 text-sm">
      <button
        type="button"
        onClick={() => setFlagging(true)}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800"
      >
        <Flag className="h-4 w-4" /> Report this post
      </button>
      {isAdmin(user) && (
        <button
          type="button"
          onClick={() => setRemoving(true)}
          className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800"
        >
          <Trash2 className="h-4 w-4" /> Remove post (admin)
        </button>
      )}
      <FlagItemDialog item={item} open={flagging} onClose={() => setFlagging(false)} />
      <ConfirmDialog
        open={removing}
        title="Remove this post?"
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setRemoving(false)}
      >
        It will disappear from the site, its open claims will be closed and the poster will be told.
        To give them a reason, decide on it from the Reports page instead.
      </ConfirmDialog>
    </div>
  );
}

/** For the reporter: the claims on this item, and removing the report. */
function ReporterActions({ item }: { item: ItemDto }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const claims = useQuery({
    queryKey: queryKeys.claims.forItem(item.id),
    queryFn: () => claimsApi.forItem(item.id),
  });

  const remove = useMutation({
    mutationFn: () => itemsApi.remove(item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success('Your report was removed.');
      navigate('/my-items');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Claims on this item</h2>
        {claims.isPending ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : claims.data?.data.length ? (
          <ul className="mt-3 divide-y">
            {claims.data.data.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No claims yet. You'll get a notification and an email when someone makes one.
          </p>
        )}
      </section>
      {item.status !== 'RESOLVED' && (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" /> Remove report
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Remove this report?"
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirming(false)}
      >
        It will disappear from the site and any open claims on it will be closed.
      </ConfirmDialog>
    </div>
  );
}

function ClaimRow({ claim }: { claim: ClaimDto }) {
  const status = CLAIM_STATUS[claim.status];
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={claim.claimant.name} url={claim.claimant.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{claim.claimant.name}</p>
          <p className="text-xs text-gray-500">{timeAgo(claim.createdAt)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Link
          to={`/claims/${claim.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {claim.status === 'REQUESTED' ? 'Review' : 'Open'}
        </Link>
      </div>
    </li>
  );
}
