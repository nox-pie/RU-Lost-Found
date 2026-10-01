import { zodResolver } from '@hookform/resolvers/zod';
import { profileFieldsSchema, type MeDto } from '@ru-lost-found/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Avatar } from '../../components/ui/misc';
import { usersApi } from '../../lib/api/endpoints';
import { emptyToUndefined, showFormError } from '../../lib/forms';
import { queryKeys } from '../../lib/queryClient';
import { useAuth, useCurrentUser } from '../auth/authContext';

type ProfileInput = z.input<typeof profileFieldsSchema>;
type Profile = z.output<typeof profileFieldsSchema>;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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
      <AvatarSection user={user} onChange={setUser} />
      <DetailsForm user={user} onSaved={setUser} />
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

  function pick(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Choose an image under 2 MB.');
      return;
    }
    upload.mutate(file);
  }

  return (
    <section className="mt-8 flex items-center gap-5 rounded-2xl bg-white p-5 shadow-sm">
      <Avatar name={`${user.firstName} ${user.lastName}`} url={user.avatarUrl} size="lg" />
      <div>
        <p className="font-medium text-gray-900">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-sm text-gray-500">{user.email}</p>
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
            pick(event.target.files?.[0]);
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
      className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Year" error={errors.year?.message} {...register('year')}>
          {[1, 2, 3, 4, 5].map((year) => (
            <option key={year} value={year}>
              Year {year}
            </option>
          ))}
        </Select>
        <Input
          label="Enrollment no."
          error={errors.enrollmentNumber?.message}
          {...register('enrollmentNumber')}
        />
      </div>
      <Select
        label={university.data ? `School · ${university.data.name}` : 'School'}
        error={errors.school?.message}
        {...register('school')}
      >
        {schools.map((school) => (
          <option key={school} value={school}>
            {school}
          </option>
        ))}
      </Select>
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
