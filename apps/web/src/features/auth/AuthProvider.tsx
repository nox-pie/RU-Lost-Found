import type { MeDto } from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSessionExpired, refreshSession, setAccessToken } from '../../lib/api/client';
import { authApi } from '../../lib/api/endpoints';
import { hasSessionHint, setSessionHint } from '../../lib/sessionHint';
import { AuthContext, type AuthContextValue, type Status } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Someone who never signed in on this device sees the public pages straight away.
  const [status, setStatus] = useState<Status>(() => (hasSessionHint() ? 'loading' : 'anonymous'));
  const [user, setUserState] = useState<MeDto | null>(null);

  const clearSession = useCallback(() => {
    setSessionHint(false);
    setAccessToken(null);
    setUserState(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // On load, the refresh cookie (if any) restores the session after a page reload.
  useEffect(() => {
    if (!hasSessionHint()) return;
    let cancelled = false;
    refreshSession().then(
      (session) => {
        if (cancelled) return;
        if (session) {
          setUserState(session.user);
          setStatus('authenticated');
        } else {
          // The API refused the session: this device is signed out.
          setSessionHint(false);
          setStatus('anonymous');
        }
      },
      () => {
        // No answer (offline, page being left, server trouble): show the public pages for now,
        // but keep the hint so the next visit tries again. The session may well be fine.
        if (!cancelled) setStatus('anonymous');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => onSessionExpired(clearSession), [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn: (session) => {
        setSessionHint(true);
        setAccessToken(session.accessToken);
        setUserState(session.user);
        setStatus('authenticated');
      },
      signOut: async (to = '/') => {
        try {
          await authApi.logout();
        } catch {
          // Signing out locally must always work; the server session expires on its own anyway.
        }
        // A full page load: nothing of the session survives in memory, and the guards can't
        // redirect to sign-in first (signing out on purpose leads home, to the landing page).
        setSessionHint(false);
        setAccessToken(null);
        window.location.assign(to);
      },
      setUser: setUserState,
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
