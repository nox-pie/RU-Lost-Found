import type { ItemDto } from '@ru-lost-found/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { itemsApi } from '../../lib/api/endpoints';
import { CLOSE_REASON_LABELS, formatDateTime } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

/** The reporter is reminded this long before an open post closes (as the API does). */
const REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

/** Saves the post the API answered with, and marks lists stale (they refresh when shown). */
function useSavePost(item: ItemDto) {
  const queryClient = useQueryClient();
  return (updated: ItemDto) => {
    queryClient.setQueryData(queryKeys.items.detail(item.id), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.items.all, refetchType: 'none' });
    void queryClient.invalidateQueries({ queryKey: queryKeys.claims.forItem(item.id) });
  };
}

/**
 * For the reporter: a closed post can be opened again, and an open post closing within a week
 * can be kept open. Nothing otherwise.
 */
export function PostLifecycleNotice({ item }: { item: ItemDto }) {
  const [now] = useState(Date.now);
  const save = useSavePost(item);
  const keepOpen = useMutation({
    mutationFn: () => itemsApi.keepOpen(item.id),
    onSuccess: (updated) => {
      save(updated);
      toast.success(
        item.status === 'CLOSED' ? 'Your post is open again.' : 'Your post stays open.',
      );
    },
    onError: (error) => toast.error(error.message),
  });

  if (item.status === 'CLOSED' && item.closeReason) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-gray-100 p-4 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold">This post is closed:</span>{' '}
          {CLOSE_REASON_LABELS[item.closeReason].toLowerCase()}. It no longer appears in the feed.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 whitespace-nowrap"
          loading={keepOpen.isPending}
          onClick={() => keepOpen.mutate()}
        >
          <RotateCcw className="h-4 w-4" /> Open it again
        </Button>
      </section>
    );
  }

  const closesSoon = new Date(item.expiresAt).getTime() - now <= REMINDER_MS;
  if (item.status !== 'OPEN' || !closesSoon) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          This post closes on{' '}
          <span className="font-semibold">{formatDateTime(item.expiresAt)}</span>. Still looking?
        </span>
      </p>
      <Button
        size="sm"
        className="shrink-0 whitespace-nowrap"
        loading={keepOpen.isPending}
        onClick={() => keepOpen.mutate()}
      >
        Keep it open
      </Button>
    </section>
  );
}

/** The reporter closes their open post, saying why. */
export function ClosePostDialog({
  item,
  open,
  onClose,
}: {
  item: ItemDto;
  open: boolean;
  onClose: () => void;
}) {
  const save = useSavePost(item);
  const [reason, setReason] = useState<'RETURNED' | 'WITHDRAWN'>('RETURNED');
  const close = useMutation({
    mutationFn: () => itemsApi.close(item.id, reason),
    onSuccess: (updated) => {
      save(updated);
      toast.success('Your post was closed.');
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  const options = [
    {
      value: 'RETURNED' as const,
      label: item.type === 'LOST' ? 'I got it back' : 'It’s back with its owner',
      hint: 'Outside the portal, without a handover here.',
    },
    {
      value: 'WITHDRAWN' as const,
      label: item.type === 'LOST' ? 'I’m no longer looking for it' : 'I no longer have it',
      hint: 'For example, handed to someone else or no longer needed.',
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Close this post?">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-gray-600">
          It disappears from the feed and any open claims on it are closed. You can open it again
          later.
        </legend>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${reason === option.value ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
          >
            <input
              type="radio"
              name="close-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{option.label}</span>
              <span className="block text-xs text-gray-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={close.isPending}>
          Cancel
        </Button>
        <Button loading={close.isPending} onClick={() => close.mutate()}>
          Close post
        </Button>
      </div>
    </Modal>
  );
}
