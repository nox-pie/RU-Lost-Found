import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@ru-lost-found/shared';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { authApi } from '../../lib/api/endpoints';
import { showFormError } from '../../lib/forms';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';
import { brand } from '../../brand/brand.config';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      signIn(await authApi.login(email, password));
      navigate(returnTo, { replace: true });
    } catch (error) {
      showFormError(error, setError);
    }
  });

  return (
    <AuthLayout title={`Sign in to ${brand.productName}`} subtitle={brand.emailHint}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        New here?{' '}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
