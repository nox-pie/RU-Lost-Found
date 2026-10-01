import { zodResolver } from '@hookform/resolvers/zod';
import {
  ITEM_CATEGORIES,
  MAX_ITEM_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_VERIFICATION_QUESTIONS,
  dateOnlySchema,
} from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { itemsApi } from '../../lib/api/endpoints';
import { CATEGORY_LABELS, todayIso } from '../../lib/format';
import { showFormError } from '../../lib/forms';
import { queryKeys } from '../../lib/queryClient';
import { PhotoPicker } from './PhotoPicker';

/** Same rules as the API's createItemSchema, shaped for the form. */
const reportSchema = z.object({
  type: z.enum(['LOST', 'FOUND']),
  category: z.enum(ITEM_CATEGORIES, { message: 'Choose a category' }),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80),
  description: z.string().trim().min(10, 'Describe the item in at least 10 characters').max(1000),
  location: z.string().trim().min(2, 'Enter where it was lost or found').max(100),
  occurredOn: dateOnlySchema,
  heldAtSecurityDesk: z.boolean(),
  questions: z
    .array(z.object({ text: z.string().trim().min(5, 'At least 5 characters').max(150) }))
    .max(MAX_VERIFICATION_QUESTIONS),
});
type ReportForm = z.infer<typeof reportSchema>;

export function ReportItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Report an item" size="lg">
      {open && <ReportItemForm onDone={onClose} />}
    </Modal>
  );
}

function ReportItemForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string>();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      type: 'LOST',
      occurredOn: todayIso(),
      heldAtSecurityDesk: false,
      questions: [],
    },
  });
  const questions = useFieldArray({ control, name: 'questions' });
  const type = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    if (photos.length === 0) {
      setPhotoError('Add at least one photo so the owner can recognise it.');
      return;
    }
    const form = new FormData();
    form.append('type', values.type);
    form.append('category', values.category);
    form.append('title', values.title);
    form.append('description', values.description);
    form.append('location', values.location);
    form.append('occurredOn', values.occurredOn);
    form.append('heldAtSecurityDesk', String(values.heldAtSecurityDesk));
    if (values.type === 'FOUND') {
      values.questions.forEach((question) => form.append('questions', question.text));
    }
    photos.forEach((photo) => form.append('photos', photo));

    try {
      const item = await itemsApi.create(form);
      await queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      toast.success('Your report is live.');
      onDone();
      navigate(`/items/${item.id}`);
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">What happened?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          {(['LOST', 'FOUND'] as const).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg py-2 text-center text-sm font-medium transition ${type === value ? (value === 'LOST' ? 'bg-primary text-white shadow' : 'bg-secondary text-white shadow') : 'text-gray-600'}`}
            >
              <input type="radio" value={value} className="sr-only" {...register('type')} />
              {value === 'LOST' ? 'I lost something' : 'I found something'}
            </label>
          ))}
        </div>
      </fieldset>

      <PhotoPicker
        files={photos}
        onChange={(files) => {
          setPhotos(files);
          setPhotoError(undefined);
        }}
        max={MAX_ITEM_PHOTOS}
        maxBytes={MAX_PHOTO_BYTES}
        error={photoError}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Item name"
          placeholder="e.g. Black iPhone 13"
          error={errors.title?.message}
          {...register('title')}
        />
        <Select
          label="Category"
          defaultValue=""
          error={errors.category?.message}
          {...register('category')}
        >
          <option value="" disabled>
            Choose…
          </option>
          {ITEM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </div>

      <Textarea
        label="Description"
        placeholder="Colour, brand, stickers, what's inside… anything that helps identify it."
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={type === 'LOST' ? 'Where did you lose it?' : 'Where did you find it?'}
          placeholder="e.g. Library, 2nd floor"
          error={errors.location?.message}
          {...register('location')}
        />
        <Input
          label="When?"
          type="date"
          max={todayIso()}
          error={errors.occurredOn?.message}
          {...register('occurredOn')}
        />
      </div>

      {type === 'FOUND' && (
        <>
          <Checkbox
            label="I've handed it in at the security desk"
            {...register('heldAtSecurityDesk')}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">
              Verification questions (recommended)
            </p>
            <p className="mb-2 text-xs text-gray-500">
              Ask something only the owner would know, e.g. "What is the lock-screen wallpaper?".
              Anyone claiming it must answer.
            </p>
            <div className="space-y-2">
              {questions.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-grow">
                    <Input
                      label={`Question ${index + 1}`}
                      error={errors.questions?.[index]?.text?.message}
                      {...register(`questions.${index}.text`)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => questions.remove(index)}
                    aria-label={`Remove question ${index + 1}`}
                    className="mt-7 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {questions.fields.length < MAX_VERIFICATION_QUESTIONS && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => questions.append({ text: '' })}
              >
                <Plus className="h-4 w-4" /> Add a question
              </Button>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          variant={type === 'LOST' ? 'primary' : 'secondary'}
        >
          Publish report
        </Button>
      </div>
    </form>
  );
}
