import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@ru-lost-found/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { authApi } from '../../lib/api/endpoints';
import { emptyToUndefined, showFormError } from '../../lib/forms';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';
import { CodeStep, EmailStep } from './CodeSteps';
import { useCodeFlow } from './useCodeFlow';
import { brand } from '../../brand/brand.config';

const detailsSchema = registerSchema.omit({ verificationToken: true });
type DetailsInput = z.input<typeof detailsSchema>;
type Details = z.output<typeof detailsSchema>;

const YEARS = [1, 2, 3, 4, 5];

export default function SignupPage() {
  const flow = useCodeFlow('SIGNUP');
  const step = flow.verified ? 3 : flow.codeSent ? 2 : 1;

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <span>
          Step {step} of 3 · {['Your email', 'Verify it', 'About you'][step - 1]}
        </span>
      }
    >
      {step === 1 && (
        <EmailStep flow={flow} hint={`${brand.emailHint} We'll send a code to check it's yours.`} />
      )}
      {step === 2 && <CodeStep flow={flow} />}
      {step === 3 && flow.verified && (
        <DetailsStep
          verificationToken={flow.verified.verificationToken}
          schools={flow.verified.university?.schools ?? []}
          universityName={flow.verified.university?.name}
        />
      )}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function DetailsStep({
  verificationToken,
  schools,
  universityName,
}: {
  verificationToken: string;
  schools: string[];
  universityName?: string;
}) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DetailsInput, unknown, Details>({ resolver: zodResolver(detailsSchema) });

  const onSubmit = handleSubmit(async (details) => {
    try {
      signIn(await authApi.register({ ...details, verificationToken }));
      toast.success(`Welcome to ${brand.productName}, ${details.firstName}!`);
      navigate('/', { replace: true });
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {universityName && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
          Email verified · {universityName}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="First name"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="Last name"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Year" defaultValue="" error={errors.year?.message} {...register('year')}>
          <option value="" disabled>
            Select
          </option>
          {YEARS.map((year) => (
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
      <Select label="School" defaultValue="" error={errors.school?.message} {...register('school')}>
        <option value="" disabled>
          Select your school
        </option>
        {schools.map((school) => (
          <option key={school} value={school}>
            {school}
          </option>
        ))}
      </Select>
      <Input
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        placeholder="+91 98765 43210"
        hint="Only shared with someone if you choose to, when a claim is approved."
        error={errors.phone?.message}
        {...register('phone', { setValueAs: emptyToUndefined })}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
