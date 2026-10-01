import type { AuthResponse, MeDto, Role } from '@ru-lost-found/shared';
import { createContext, useContext } from 'react';

export type Status = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: Status;
  user: MeDto | null;
  /** Stores the session returned by login or register. */
  signIn: (session: AuthResponse) => void;
  signOut: () => Promise<void>;
  /** Replaces the cached profile after the user edits it. */
  setUser: (user: MeDto) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in user; only for components rendered behind <RequireAuth>. */
export function useCurrentUser(): MeDto {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}

const ADMIN_ROLES: readonly Role[] = ['UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'];

/** Admins see the admin area. The API checks again on every request; this only shapes the UI. */
export function isAdmin(user: Pick<MeDto, 'role'>): boolean {
  return ADMIN_ROLES.includes(user.role);
}
