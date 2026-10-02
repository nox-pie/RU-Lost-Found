import type { MeDto } from '@ru-lost-found/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSessionExpired, refreshSession, setAccessToken } from '../../lib/api/client';
import { authApi } from '../../lib/api/endpoints';
import { AuthContext, type AuthContextValue, type Status } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<MeDto | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // On load, the refresh cookie (if any) restores the session after a page reload.
  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      if (session) {
        setUserState(session.user);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });
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
        setAccessToken(session.accessToken);
        setUserState(session.user);
        setStatus('authenticated');
      },
      signOut: async () => {
        try {
          await authApi.logout();
        } catch {
          // Signing out locally must always work; the server session expires on its own anyway.
        } finally {
          clearSession();
        }
      },
      setUser: setUserState,
    }),
    [status, user, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
