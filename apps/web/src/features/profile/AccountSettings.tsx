import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, type AccountExportDto, type MeDto } from '@ru-lost-found/shared';
import { useMutation } from '@tanstack/react-query';
import { Download, KeyRound, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { accountApi, authApi } from '../../lib/api/endpoints';
import { showFormError } from '../../lib/forms';
import { useAuth } from '../auth/authContext';

/** Password, data download and account deletion, below the profile details. */
export function AccountSettings({ user }: { user: MeDto }) {
  return (
    <>
      <ChangePasswordForm user={user} />
      <YourData />
      <DeleteAccount />
    </>
  );
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.newPassword === value.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
type ChangePassword = z.infer<typeof changePasswordSchema>;

function ChangePasswordForm({ user }: { user: MeDto }) {
  const { signIn } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePassword>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      // The old session ended with the change; the answer is this device's new one.
      signIn(await authApi.changePassword(currentPassword, newPassword));
      reset();
      toast.success('Password changed. You were signed out on your other devices.');
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
      aria-labelledby="password-heading"
      noValidate
    >
      <SectionHeading id="password-heading" icon={<KeyRound className="h-5 w-5" />}>
        Password
      </SectionHeading>
      {/* Lets password managers know which account the new password belongs to. */}
      <input type="email" autoComplete="username" value={user.email} readOnly hidden />
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
      </div>
      <div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs text-gray-500">
          You stay signed in here; every other device is signed out.
        </p>
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

/** Saves the export as a file on the device. */
function saveAsFile(data: AccountExportDto) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lost-and-found-data-${data.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function YourData() {
  const download = useMutation({
    mutationFn: accountApi.exportData,
    onSuccess: saveAsFile,
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm" aria-labelledby="data-heading">
      <SectionHeading id="data-heading" icon={<Download className="h-5 w-5" />}>
        Your data
      </SectionHeading>
      <p className="mt-2 text-sm text-gray-600">
        Download everything this account holds: your profile, every post, the claims you made and
        received, and your notifications, as one JSON file. Read the{' '}
        <Link to="/privacy" className="font-medium text-primary hover:underline">
          privacy policy
        </Link>{' '}
        to see how it is used.
      </p>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" loading={download.isPending} onClick={() => download.mutate()}>
          <Download className="h-4 w-4" /> Download my data
        </Button>
      </div>
    </section>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="mt-6 rounded-2xl border border-red-200 bg-white p-5 shadow-sm"
      aria-labelledby="delete-heading"
    >
      <SectionHeading id="delete-heading" icon={<Trash2 className="h-5 w-5 text-red-600" />}>
        Delete account
      </SectionHeading>
      <p className="mt-2 text-sm text-gray-600">
        Deletes your account and personal details for good. This can’t be undone.
      </p>
      <div className="mt-4 flex justify-end">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete my account
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        {open && <DeleteAccountForm onCancel={() => setOpen(false)} />}
      </Modal>
    </section>
  );
}

const deleteAccountSchema = z.object({ password: z.string().min(1, 'Enter your password') });
type DeleteAccountForm = z.infer<typeof deleteAccountSchema>;

function DeleteAccountForm({ onCancel }: { onCancel: () => void }) {
  const { signOut } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountForm>({ resolver: zodResolver(deleteAccountSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await accountApi.remove(password);
      await signOut('/');
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-600">
        <li>Your open posts are removed, and people who claimed them are told.</li>
        <li>Your active claims are withdrawn.</li>
        <li>
          Handovers you finished stay in the other person’s history, shown as “Former member”.
        </li>
        <li>Your profile, picture, notifications and sessions are deleted.</li>
      </ul>
      <p className="text-sm text-gray-600">
        Want a copy first? Close this and choose “Download my data”.
      </p>
      <Input
        label="Your password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={isSubmitting}>
          Delete my account
        </Button>
      </div>
    </form>
  );
}

function SectionHeading({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 font-display text-lg font-semibold text-gray-900"
    >
      <span className="text-gray-400" aria-hidden>
        {icon}
      </span>
      {children}
    </h2>
  );
}
