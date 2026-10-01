import { REPORT_REASONS, type ItemDto, type ReportReason } from '@ru-lost-found/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { itemsApi } from '../../lib/api/endpoints';
import { REPORT_REASON_LABELS } from '../../lib/format';

/** Lets anyone tell the admins a post breaks the rules (spam, scam, ...). */
export function FlagItemDialog({
  item,
  open,
  onClose,
}: {
  item: ItemDto;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Report this post">
      {open && <FlagForm item={item} onDone={onClose} />}
    </Modal>
  );
}

function FlagForm({ item, onDone }: { item: ItemDto; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();

  const flag = useMutation({
    mutationFn: (chosen: ReportReason) =>
      itemsApi.flag(item.id, { reason: chosen, details: details.trim() || undefined }),
    onSuccess: (response) => {
      toast.success(response.message);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason) return setError('Choose a reason');
        if (reason === 'OTHER' && details.trim().length < 5) {
          return setError('Tell us what is wrong with this post');
        }
        setError(undefined);
        flag.mutate(reason);
      }}
      noValidate
      className="space-y-4"
    >
      <p className="text-sm text-gray-600">
        What’s wrong with “{item.title}”? An admin will review it. The person who posted it won’t
        see who reported it.
      </p>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">Reason</legend>
        <div className="space-y-2">
          {REPORT_REASONS.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${reason === option ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
              />
              {REPORT_REASON_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        label={reason === 'OTHER' ? 'What’s wrong?' : 'Anything else? (optional)'}
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={500}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={flag.isPending}>
          Send report
        </Button>
      </div>
    </form>
  );
}
