import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ItemCategory,
  MAX_ITEM_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_VERIFICATION_QUESTIONS,
} from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { itemsApi } from '../../lib/api/endpoints';
import { todayIso } from '../../lib/format';
import { showFormError } from '../../lib/forms';
import { queryKeys } from '../../lib/queryClient';
import { useCurrentUser } from '../auth/authContext';
import { DemoLimitNotice } from '../demo/DemoBanner';
import { PhotoPicker } from './PhotoPicker';
import { Dropdown } from '../../components/ui/Dropdown';
import { CATEGORY_OPTIONS } from '../../lib/categories';
import { ELSEWHERE, placeOptions, spotField, useCampusPlaces } from './campusPlaces';
import { itemDetailsFields } from './itemForm';

const questionSchema = z.string().trim().min(5, 'At least 5 characters').max(150);

/** Same rules as the API's createItemSchema, shaped for the form. */
const reportSchema = z
  .object({
    type: z.enum(['LOST', 'FOUND']),
    ...itemDetailsFields,
    questions: z.array(z.object({ text: z.string() })).max(MAX_VERIFICATION_QUESTIONS),
  })
  .superRefine((form, ctx) => {
    // Questions are only sent with found items, so only then are they checked: a question added
    // before switching to "I lost something" is hidden, and must not block the form unseen.
    if (form.type !== 'FOUND') return;
    form.questions.forEach((question, index) => {
      const result = questionSchema.safeParse(question.text);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', index, 'text'],
          message: result.error.issues[0]?.message ?? 'Check this question',
        });
      }
    });
  });
type ReportForm = z.infer<typeof reportSchema>;

export function ReportItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  return (
    <Modal open={open} onClose={onClose} title="Report an item" size="lg">
      {open &&
        (user.isDemo ? (
          <DemoLimitNotice action="post new items" />
        ) : (
          <ReportItemForm onDone={onClose} />
        ))}
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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      type: 'LOST',
      occurredOn: todayIso(),
      place: ELSEWHERE,
      heldAtSecurityDesk: false,
      questions: [],
    },
  });
  const questions = useFieldArray({ control, name: 'questions' });
  const type = useWatch({ control, name: 'type' });
  const places = useCampusPlaces();
  const whereLabel = type === 'LOST' ? 'Where did you lose it?' : 'Where did you find it?';
  const spot = spotField(places, useWatch({ control, name: 'place' }), whereLabel);

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
    if (values.place) form.append('place', values.place);
    form.append('occurredOn', values.occurredOn);
    form.append('heldAtSecurityDesk', String(values.heldAtSecurityDesk));
    if (values.type === 'FOUND') {
      values.questions.forEach((question) => form.append('questions', question.text.trim()));
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
              className={`cursor-pointer rounded-lg py-2 text-center text-sm font-medium transition ${type === value ? (value === 'LOST' ? 'bg-primary text-white shadow-sm' : 'bg-secondary text-secondary-contrast shadow-sm') : 'text-gray-600'}`}
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
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Dropdown<ItemCategory | ''>
              label="Category"
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={CATEGORY_OPTIONS}
              error={errors.category?.message}
            />
          )}
        />
      </div>

      <Textarea
        label="Description"
        placeholder="Colour, brand, stickers, what's inside… anything that helps identify it."
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {places.length > 0 && (
          <Controller
            name="place"
            control={control}
            render={({ field }) => (
              <Dropdown
                label={whereLabel}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={placeOptions(places)}
                error={errors.place?.message}
              />
            )}
          />
        )}
        <Input
          label={spot.label}
          placeholder={spot.placeholder}
          hint={spot.hint}
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
                  <div className="grow">
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
