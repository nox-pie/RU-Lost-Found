import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@ru-lost-found/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { authApi } from '../../lib/api/endpoints';
import { showFormError } from '../../lib/forms';
import { AuthLayout } from './AuthLayout';
import { CodeStep, EmailStep } from './CodeSteps';
import { useCodeFlow } from './useCodeFlow';

const newPasswordSchema = z
  .object({ newPassword: passwordSchema, confirm: z.string() })
  .refine((value) => value.newPassword === value.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  });
type NewPassword = z.infer<typeof newPasswordSchema>;

export default function ForgotPasswordPage() {
  const flow = useCodeFlow('PASSWORD_RESET');
  const step = flow.verified ? 3 : flow.codeSent ? 2 : 1;

  return (
    <AuthLayout title="Reset your password" subtitle={`Step ${step} of 3`}>
      {step === 1 && (
        <EmailStep flow={flow} hint="We'll email you a code to reset your password." />
      )}
      {step === 2 && <CodeStep flow={flow} />}
      {step === 3 && flow.verified && <NewPasswordStep token={flow.verified.verificationToken} />}
      <p className="mt-6 text-center text-sm text-gray-600">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function NewPasswordStep({ token }: { token: string }) {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPassword>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    try {
      await authApi.resetPassword(token, newPassword);
      toast.success('Password changed. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number. You'll be signed out on all devices."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}
