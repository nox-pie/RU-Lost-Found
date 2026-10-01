import type { ItemDto } from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ApiError } from '../../lib/api/client';
import { claimsApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

/** "This is mine" (found item: answer the finder's questions) or "I found this" (lost item). */
export function ClaimDialog({
  item,
  open,
  onClose,
}: {
  item: ItemDto;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item.type === 'FOUND' ? 'Claim this item' : 'Tell the owner you found it'}
    >
      {open && <ClaimForm item={item} onDone={onClose} />}
    </Modal>
  );
}

function ClaimForm({ item, onDone }: { item: ItemDto; onDone: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sharePhone, setSharePhone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const isOwnershipClaim = item.type === 'FOUND';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const missing = Object.fromEntries(
      item.verificationQuestions
        .filter((q) => !answers[q.id]?.trim())
        .map((q) => [q.id, 'Please answer this question']),
    );
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;

    setBusy(true);
    try {
      const claim = await claimsApi.submit(item.id, {
        message: message.trim(),
        answers: item.verificationQuestions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id]?.trim() ?? '',
        })),
        sharePhone,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.claims.all });
      toast.success(
        isOwnershipClaim
          ? 'Claim sent. The finder will check your answers.'
          : 'Sent. The owner has been notified.',
      );
      onDone();
      navigate(`/claims/${claim.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send your claim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-gray-600">
        <span className="font-medium text-gray-900">{item.title}</span> ·{' '}
        {isOwnershipClaim
          ? 'Answer the finder’s questions so they can tell it’s really yours.'
          : 'Let the owner know where it is and how to get it back.'}
      </p>

      {item.verificationQuestions.map((question) => (
        <Input
          key={question.id}
          label={question.question}
          value={answers[question.id] ?? ''}
          onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
          error={errors[question.id]}
          maxLength={300}
        />
      ))}

      <Textarea
        label={isOwnershipClaim ? 'Anything else that proves it’s yours? (optional)' : 'Message'}
        placeholder={
          isOwnershipClaim
            ? 'e.g. there is a sticker of a cat on the back'
            : 'e.g. I found it in room 204; I can meet near the library after 4 pm'
        }
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={500}
      />

      <Checkbox
        label="Share my phone number once the claim is approved"
        checked={sharePhone}
        onChange={(event) => setSharePhone(event.target.checked)}
      />
      <p className="text-xs text-gray-500">
        Your name and picture are shown to the reporter now. Your email (and phone, if you tick the
        box) is only shared if they approve.
      </p>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Send
        </Button>
      </div>
    </form>
  );
}
