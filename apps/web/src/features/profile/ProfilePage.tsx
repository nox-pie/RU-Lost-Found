import { zodResolver } from '@hookform/resolvers/zod';
import { profileFieldsSchema, type MeDto } from '@ru-lost-found/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { YEAR_OPTIONS } from '../../lib/format';
import { Input } from '../../components/ui/Field';
import { Avatar } from '../../components/ui/misc';
import { usersApi } from '../../lib/api/endpoints';
import { emptyToUndefined, showFormError } from '../../lib/forms';
import { prepareImage } from '../../lib/images';
import { queryKeys } from '../../lib/queryClient';
import { useAuth, useCurrentUser } from '../auth/authContext';
import { DemoLimitNotice } from '../demo/DemoBanner';
import { AccountSettings } from './AccountSettings';

type ProfileInput = z.input<typeof profileFieldsSchema>;
type Profile = z.output<typeof profileFieldsSchema>;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Longest side of a profile picture after shrinking on the device (shown at most 96 px). */
const AVATAR_DIMENSION = 512;

export default function ProfilePage() {
  const user = useCurrentUser();
  const { setUser, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-gray-900">Your profile</h1>
      <p className="mt-1 text-gray-600">
        Only your name and picture are shown to other students. Contact details are shared only when
        you approve or are approved for a claim.
      </p>
      {user.isDemo ? (
        <div className="mt-8">
          <DemoLimitNotice action="change their profile" />
        </div>
      ) : (
        <>
          <AvatarSection user={user} onChange={setUser} />
          <DetailsForm user={user} onSaved={setUser} />
          <AccountSettings user={user} />
        </>
      )}
      <div className="mt-8 flex justify-end">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function AvatarSection({ user, onChange }: { user: MeDto; onChange: (user: MeDto) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (updated) => {
      onChange(updated);
      toast.success('Profile picture updated.');
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => usersApi.removeAvatar(),
    onSuccess: (updated) => {
      onChange(updated);
      toast.success('Profile picture removed.');
    },
    onError: (error) => toast.error(error.message),
  });

  async function pick(file: File | undefined) {
    if (!file) return;
    // Phone photos are often several MB; a profile picture is shown at most 96 px wide, so it is
    // made small on the device first (which also keeps the upload fast on mobile data).
    const prepared = await prepareImage(file, { maxDimension: AVATAR_DIMENSION });
    if (!prepared) {
      toast.error('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (prepared.size > MAX_AVATAR_BYTES) {
      toast.error('Choose an image under 2 MB.');
      return;
    }
    upload.mutate(prepared);
  }

  return (
    <section className="mt-8 flex items-center gap-5 rounded-2xl bg-white p-5 shadow-xs">
      <Avatar name={`${user.firstName} ${user.lastName}`} url={user.avatarUrl} size="lg" />
      <div className="min-w-0">
        <p className="wrap-break-word font-medium text-gray-900">
          {user.firstName} {user.lastName}
        </p>
        <p className="wrap-break-word text-sm text-gray-500">{user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <Camera className="h-4 w-4" /> {user.avatarUrl ? 'Change picture' : 'Add picture'}
          </Button>
          {user.avatarUrl && (
            <Button
              size="sm"
              variant="ghost"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </section>
  );
}

function DetailsForm({ user, onSaved }: { user: MeDto; onSaved: (user: MeDto) => void }) {
  const university = useQuery({
    queryKey: queryKeys.university,
    queryFn: usersApi.university,
    staleTime: Infinity,
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput, unknown, Profile>({
    resolver: zodResolver(profileFieldsSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      year: user.year,
      school: user.school,
      enrollmentNumber: user.enrollmentNumber,
      phone: user.phone ?? undefined,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await usersApi.update({ ...values, phone: values.phone ?? null });
      onSaved(updated);
      reset(values);
      toast.success('Profile saved.');
    } catch (error) {
      showFormError(error, setError);
    }
  });

  const schools = university.data?.schools ?? [user.school];

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-xs"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="year"
          control={control}
          render={({ field }) => (
            <Dropdown
              label="Year"
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(value) => field.onChange(Number(value))}
              onBlur={field.onBlur}
              options={YEAR_OPTIONS}
              error={errors.year?.message}
            />
          )}
        />
        <Input
          label="Enrollment no."
          error={errors.enrollmentNumber?.message}
          {...register('enrollmentNumber')}
        />
      </div>
      <Controller
        name="school"
        control={control}
        render={({ field }) => (
          <Dropdown
            label={university.data ? `School · ${university.data.name}` : 'School'}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={schools.map((school) => ({ value: school, label: school }))}
            error={errors.school?.message}
          />
        )}
      />
      <Input
        label="Phone (optional)"
        type="tel"
        hint="Only shared with someone when you choose to, on an approved claim."
        error={errors.phone?.message}
        {...register('phone', { setValueAs: emptyToUndefined })}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
