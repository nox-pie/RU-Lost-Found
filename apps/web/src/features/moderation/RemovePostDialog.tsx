import type { ItemDto } from '@ru-lost-found/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { adminApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

/** Asks for an optional reason (shown to the poster) before removing a post. */
export function RemovePostDialog({
  post,
  open,
  onClose,
  onRemoved,
}: {
  post: ItemDto;
  open: boolean;
  onClose: () => void;
  onRemoved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const remove = useMutation({
    mutationFn: () => adminApi.removePost(post.id, reason.trim() || undefined),
    onSuccess: async () => {
      onClose();
      setReason('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success('The post was removed.');
      onRemoved?.();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Remove this post?">
      <p className="text-sm text-gray-600">
        “{post.title}” will disappear from the site and any open claims on it will be closed.
        {post.isMine ? '' : ` ${post.reporter.name} will be told, with your reason.`}
      </p>
      {!post.isMine && (
        <div className="mt-4">
          <Textarea
            label="Reason shown to the poster (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="e.g. Posts must be about lost or found items"
          />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
          Remove post
        </Button>
      </div>
    </Modal>
  );
}
