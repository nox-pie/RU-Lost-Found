import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Spinner } from '../../components/ui/Spinner';
import { isAdmin, useAuth } from './authContext';
import { brand } from '../../brand/brand.config';

/**
 * Shown while the session is being restored. The free hosting tier can take ~30 s to wake up,
 * so after a moment the message explains the wait instead of showing a blank page.
 */
function SessionLoader() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center"
      role="status"
    >
      <img src={brand.images.symbol} alt="" className="mb-6 h-14 w-14" />
      <Spinner className="h-8 w-8 text-primary" />
      {slow && (
        <div className="mt-4 max-w-sm animate-fade-in">
          <p className="font-medium text-gray-800">Waking up the server…</p>
          <p className="mt-1 text-sm text-gray-500">
            This can take up to 30 seconds after a quiet period. Thanks for your patience.
          </p>
        </div>
      )}
    </div>
  );
}

/** Only for signed-in users; others are sent to sign in and brought back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <SessionLoader />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Admin pages; anyone else is sent back to browsing. Must be inside <RequireAuth>. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !isAdmin(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Sign-in and sign-up pages: signed-in users go straight to the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoader />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}
