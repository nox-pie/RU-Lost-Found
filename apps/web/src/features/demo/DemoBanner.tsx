import { Info } from 'lucide-react';
import { useAuth, useCurrentUser } from '../auth/authContext';
import { personaOf } from './personas';

/** Leaves the demo account and opens sign-up. */
function useCreateOwnAccount() {
  const { signOut } = useAuth();
  return () => void signOut('/signup');
}

/** Reminds a visitor signed in as a sample person what this account is, and what to try. */
export function DemoBanner() {
  const user = useCurrentUser();
  const createAccount = useCreateOwnAccount();
  if (!user.isDemo) return null;
  const persona = personaOf(user.email);

  return (
    <div className="border-b border-secondary/30 bg-secondary/10" role="note">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary-dark" />
          <span>
            You’re exploring as{' '}
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            , a shared demo account that resets every hour.
            {persona && <> {persona.tryThis}</>}
          </span>
        </p>
        <button
          type="button"
          onClick={createAccount}
          className="shrink-0 self-start font-semibold text-primary hover:underline sm:self-auto"
        >
          Create your own account
        </button>
      </div>
    </div>
  );
}

/** Shown instead of a form that demo accounts can't use. */
export function DemoLimitNotice({ action }: { action: string }) {
  const createAccount = useCreateOwnAccount();
  return (
    <div className="rounded-xl bg-gray-50 p-5 text-center">
      <p className="text-gray-700">Demo accounts can’t {action}.</p>
      <p className="mt-1 text-sm text-gray-500">
        They’re shared by every visitor, so they can only work with the sample posts.
      </p>
      <button
        type="button"
        onClick={createAccount}
        className="mt-4 font-semibold text-primary hover:underline"
      >
        Create your own account
      </button>
    </div>
  );
}
