import type { ClaimDto } from '@ru-lost-found/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, KeyRound, Lock, Mail, Phone, ShieldCheck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Checkbox, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Avatar, Badge, ErrorState, PageLoader } from '../../components/ui/misc';
import { ApiError } from '../../lib/api/client';
import { claimsApi } from '../../lib/api/endpoints';
import { CLAIM_STATUS, formatDateTime, timeAgo } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';
import { ClaimProgress } from './ClaimProgress';

export default function ClaimPage() {
  const { id = '' } = useParams();
  const claim = useQuery({
    queryKey: queryKeys.claims.detail(id),
    queryFn: () => claimsApi.get(id),
    // While a handover is pending, keep the page in sync with the other person's actions.
    refetchInterval: (query) => (query.state.data?.status === 'APPROVED' ? 15_000 : false),
  });

  if (claim.isPending) return <PageLoader />;
  if (claim.isError) return <ErrorState error={claim.error} onRetry={() => void claim.refetch()} />;
  return <ClaimView claim={claim.data} />;
}

/** Runs a claim action, then refreshes everything it could have changed. */
function useClaimAction<T>(
  claimId: string,
  action: (input: T) => Promise<ClaimDto>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.claims.detail(claimId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.claims.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success(success);
    },
    onError: (error) => {
      // The attempt count may have changed even though the action failed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.claims.detail(claimId) });
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong.');
    },
  });
}

function ClaimView({ claim }: { claim: ClaimDto }) {
  const status = CLAIM_STATUS[claim.status];
  const other = claim.myRole === 'CLAIMANT' ? claim.reporter : claim.claimant;
  const otherRole =
    claim.myRole === 'CLAIMANT'
      ? 'Reported by'
      : claim.kind === 'OWNERSHIP'
        ? 'Claimed by'
        : 'Found by';

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/claims"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All claims
      </Link>

      <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        {claim.item.photo && (
          <img
            src={claim.item.photo}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-grow">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {claim.kind === 'OWNERSHIP' ? 'Ownership claim' : 'Found report'}
          </p>
          <Link
            to={`/items/${claim.item.id}`}
            className="block truncate font-display text-xl font-semibold text-gray-900 hover:text-primary"
          >
            {claim.item.title}
          </Link>
          <div className="mt-1">
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        </div>
      </section>

      <ClaimProgress claim={claim} />

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <HandoverPanel claim={claim} />
          <DecisionPanel claim={claim} />

          {(claim.message || claim.answers.length > 0) && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">
                {claim.myRole === 'CLAIMANT' ? 'What you sent' : 'What they said'}
              </h2>
              <dl className="mt-3 space-y-3 text-sm">
                {claim.answers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt className="text-gray-500">{answer.question}</dt>
                    <dd className="font-medium text-gray-900">{answer.answer}</dd>
                  </div>
                ))}
                {claim.message && (
                  <div>
                    <dt className="text-gray-500">Message</dt>
                    <dd className="whitespace-pre-line text-gray-900">{claim.message}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {claim.rejectionReason && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              <span className="font-medium">Reason: </span>
              {claim.rejectionReason}
            </p>
          )}
        </div>

        <aside className="space-y-6 md:col-span-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {claim.myRole === 'STAFF' ? 'People involved' : otherRole}
            </p>
            {claim.myRole === 'STAFF' ? (
              <div className="mt-3 space-y-3">
                <Person name={claim.reporter.name} url={claim.reporter.avatarUrl} note="Reporter" />
                <Person name={claim.claimant.name} url={claim.claimant.avatarUrl} note="Claimant" />
              </div>
            ) : (
              <div className="mt-3">
                <Person name={other.name} url={other.avatarUrl} />
                {claim.contact ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <a
                      href={`mailto:${claim.contact.email}`}
                      className="flex items-center gap-2 break-all text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4 shrink-0" /> {claim.contact.email}
                    </a>
                    {claim.contact.phone && (
                      <a
                        href={`tel:${claim.contact.phone}`}
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4 shrink-0" /> {claim.contact.phone}
                      </a>
                    )}
                  </div>
                ) : (
                  claim.status === 'REQUESTED' && (
                    <p className="mt-3 text-xs text-gray-500">
                      Contact details are shared once the claim is approved.
                    </p>
                  )
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xs uppercase tracking-wide text-gray-500">Timeline</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-gray-100 pl-4">
              {claim.history.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="relative text-sm">
                  <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="font-medium text-gray-900">{CLAIM_STATUS[entry.status].label}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ol>
          </section>

          <CancelAction claim={claim} />
        </aside>
      </div>
    </div>
  );
}

function Person({ name, url, note }: { name: string; url: string | null; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} url={url} />
      <div>
        <p className="font-medium text-gray-900">{name}</p>
        {note && <p className="text-xs text-gray-500">{note}</p>}
      </div>
    </div>
  );
}

/** The reporter decides on a new claim. */
function DecisionPanel({ claim }: { claim: ClaimDto }) {
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [reason, setReason] = useState('');
  const approve = useClaimAction(
    claim.id,
    () => claimsApi.approve(claim.id, sharePhone),
    'Approved. Arrange to meet and hand it over.',
  );
  const reject = useClaimAction(
    claim.id,
    () => claimsApi.reject(claim.id, reason.trim() || undefined),
    'Claim declined.',
  );

  if (claim.myRole !== 'REPORTER' || claim.status !== 'REQUESTED') return null;

  return (
    <section className="rounded-2xl border-2 border-primary/20 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">
        {claim.kind === 'OWNERSHIP' ? 'Is this the owner?' : 'Did they find your item?'}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {claim.kind === 'OWNERSHIP'
          ? 'Compare their answers with what you know about the item. Approving shares your email with them and starts a 7-day handover window.'
          : 'Approving shares your email with them and gives you a code to show when they hand it over.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setApproving(true)}>
          <Check className="h-4 w-4" /> Approve
        </Button>
        <Button variant="outline" onClick={() => setDeclining(true)}>
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>

      <ConfirmDialog
        open={approving}
        title="Approve this claim?"
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => approve.mutate(undefined, { onSettled: () => setApproving(false) })}
        onClose={() => setApproving(false)}
      >
        <p>The item will be reserved for this person and other claims will wait.</p>
        <div className="mt-4">
          <Checkbox
            label="Also share my phone number with them"
            checked={sharePhone}
            onChange={(event) => setSharePhone(event.target.checked)}
          />
        </div>
      </ConfirmDialog>

      <Modal open={declining} onClose={() => setDeclining(false)} title="Decline this claim?">
        <Textarea
          label="Reason (optional, shown to them)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="e.g. The wallpaper doesn't match."
        />
        <p className="mt-2 text-xs text-gray-500">They won't be able to claim this item again.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeclining(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={reject.isPending}
            onClick={() => reject.mutate(undefined, { onSettled: () => setDeclining(false) })}
          >
            Decline claim
          </Button>
        </div>
      </Modal>
    </section>
  );
}

/** While approved: the owner sees the code; the finder enters it; staff can confirm in person. */
function HandoverPanel({ claim }: { claim: ClaimDto }) {
  const [code, setCode] = useState('');
  const confirm = useClaimAction(
    claim.id,
    (value: string) => claimsApi.handover(claim.id, value),
    'Handover confirmed. Thank you!',
  );
  const staffConfirm = useClaimAction(
    claim.id,
    () => claimsApi.handoverAsStaff(claim.id),
    'Handover confirmed by the security desk.',
  );
  const handover = claim.handover;

  if (claim.status === 'COMPLETED') {
    return (
      <section className="flex items-center gap-3 rounded-2xl bg-green-50 p-5 text-green-800">
        <ShieldCheck className="h-8 w-8 shrink-0" />
        <p className="text-sm">
          <span className="font-semibold">Handed over.</span> This item is back with its owner.
        </p>
      </section>
    );
  }
  if (claim.status !== 'APPROVED' || !handover) return null;

  const deadline = formatDateTime(handover.deadline);

  if (claim.myRole === 'STAFF') {
    return (
      <section className="rounded-2xl border-2 border-secondary/40 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Security desk</h2>
        <p className="mt-1 text-sm text-gray-600">
          Confirm only if you saw the item handed to its owner in person.
          {handover.locked && ' The code was locked after too many wrong attempts.'}
        </p>
        <Button
          className="mt-4"
          loading={staffConfirm.isPending}
          onClick={() => staffConfirm.mutate(undefined)}
        >
          <ShieldCheck className="h-4 w-4" /> Confirm handover
        </Button>
      </section>
    );
  }

  if (handover.code) {
    return (
      <section className="rounded-2xl border-2 border-primary/30 bg-white p-5 text-center shadow-sm">
        <KeyRound className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-2 font-display text-lg font-semibold">Your handover code</h2>
        <p
          className="mt-3 font-mono text-4xl font-bold tracking-[0.35em] text-primary"
          aria-label={`Code ${handover.code.split('').join(' ')}`}
        >
          {handover.code}
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Show this to the person handing it over, only once you have the item in your hands. Meet
          before {deadline}.
        </p>
      </section>
    );
  }

  if (handover.viewerEntersCode) {
    if (handover.locked) {
      return (
        <section className="flex gap-3 rounded-2xl bg-amber-50 p-5 text-amber-900">
          <Lock className="h-6 w-6 shrink-0" />
          <p className="text-sm">
            Too many incorrect codes. Please meet at the{' '}
            <span className="font-semibold">security desk</span> so staff can confirm the handover.
          </p>
        </section>
      );
    }
    const submit = (event: FormEvent) => {
      event.preventDefault();
      confirm.mutate(code, { onError: () => setCode('') });
    };
    return (
      <section className="rounded-2xl border-2 border-primary/30 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Confirm the handover</h2>
        <p className="mt-1 text-sm text-gray-600">
          When you give the item back, ask the owner for the 6-digit code in their app and enter it
          here. Meet before {deadline}.
        </p>
        <form onSubmit={submit} className="mt-4 flex items-end gap-2">
          <div className="flex-grow">
            <Input
              label="Owner's code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              className="font-mono text-lg tracking-[0.4em]"
              hint={`${handover.attemptsLeft} attempt${handover.attemptsLeft === 1 ? '' : 's'} left`}
            />
          </div>
          <Button
            type="submit"
            className="mb-5"
            disabled={code.length !== 6}
            loading={confirm.isPending}
          >
            Confirm
          </Button>
        </form>
      </section>
    );
  }
  return null;
}

/** Either person can withdraw while the claim is still active. */
function CancelAction({ claim }: { claim: ClaimDto }) {
  const [open, setOpen] = useState(false);
  const cancel = useClaimAction(claim.id, () => claimsApi.cancel(claim.id), 'Claim cancelled.');
  const active = claim.status === 'REQUESTED' || claim.status === 'APPROVED';
  if (!active || claim.myRole === 'STAFF') return null;

  return (
    <>
      <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>
        {claim.myRole === 'CLAIMANT' ? 'Withdraw my claim' : 'Cancel this claim'}
      </Button>
      <ConfirmDialog
        open={open}
        title="Cancel this claim?"
        confirmLabel="Yes, cancel"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setOpen(false) })}
        onClose={() => setOpen(false)}
      >
        {claim.status === 'APPROVED'
          ? 'The handover will be called off and the item opened to other claims again.'
          : 'This claim will be closed.'}{' '}
        Last update {timeAgo(claim.updatedAt)}.
      </ConfirmDialog>
    </>
  );
}
