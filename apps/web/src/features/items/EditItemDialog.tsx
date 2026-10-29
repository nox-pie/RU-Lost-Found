import { zodResolver } from '@hookform/resolvers/zod';
import type { ItemDto, UpdateItemInput } from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { itemsApi } from '../../lib/api/endpoints';
import { showFormError } from '../../lib/forms';
import { queryKeys } from '../../lib/queryClient';
import { ELSEWHERE } from './campusPlaces';
import { ItemDetailsFields } from './ItemDetailsFields';
import { itemDetailsFields } from './itemForm';

const editSchema = z.object(itemDetailsFields);
type EditForm = z.infer<typeof editSchema>;

/** The reporter corrects the details of an open post. Photos and questions stay as posted. */
export function EditItemDialog({
  item,
  open,
  onClose,
}: {
  item: ItemDto;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Edit your post" size="lg">
      {open && <EditItemForm item={item} onDone={onClose} />}
    </Modal>
  );
}

function EditItemForm({ item, onDone }: { item: ItemDto; onDone: () => void }) {
  const queryClient = useQueryClient();
  const whereLabel = item.type === 'LOST' ? 'Where did you lose it?' : 'Where did you find it?';
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      category: item.category,
      title: item.title,
      description: item.description,
      location: item.location,
      place: item.place ?? ELSEWHERE,
      occurredOn: item.occurredOn,
      heldAtSecurityDesk: item.heldAtSecurityDesk,
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, isDirty, dirtyFields },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    // Only what changed is sent, so an edit never overwrites more than the reporter touched.
    const changes = Object.fromEntries(
      Object.entries(values)
        .filter(([field]) => dirtyFields[field as keyof EditForm])
        // "Other" clears the place.
        .map(([field, value]) => [field, field === 'place' && value === ELSEWHERE ? null : value]),
    ) as UpdateItemInput;
    try {
      const updated = await itemsApi.update(item.id, changes);
      queryClient.setQueryData(queryKeys.items.detail(item.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.items.all, refetchType: 'none' });
      toast.success('Your post was updated.');
      onDone();
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <ItemDetailsFields whereLabel={whereLabel} />
        {item.type === 'FOUND' && (
          <Checkbox
            label="I've handed it in at the security desk"
            {...register('heldAtSecurityDesk')}
          />
        )}
        <p className="text-xs text-gray-500">
          Photos and verification questions can’t be changed. To change them, remove this post and
          report the item again.
        </p>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
