import type { ItemCategory } from '@ru-lost-found/shared';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Dropdown } from '../../components/ui/Dropdown';
import { Input, Textarea } from '../../components/ui/Field';
import { CATEGORY_OPTIONS } from '../../lib/categories';
import { todayIso } from '../../lib/format';
import { placeOptions, spotField, useCampusPlaces } from './campusPlaces';
import type { ItemDetailsForm } from './itemForm';

/**
 * The details of a post that the report and edit forms both ask for: name, category,
 * description, campus place with the exact spot, and the day. Reads the surrounding form through
 * react-hook-form's FormProvider, so each form keeps its own fields around these.
 */
export function ItemDetailsFields({ whereLabel }: { whereLabel: string }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ItemDetailsForm>();
  const places = useCampusPlaces();
  const spot = spotField(places, useWatch({ control, name: 'place' }), whereLabel);

  return (
    <>
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
    </>
  );
}
