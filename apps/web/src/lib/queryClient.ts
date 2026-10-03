import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network hiccups, never client errors (a 404 won't fix itself).
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: true,
    },
  },
});

/** Every cache key in one place, so invalidation after a change is easy to get right. */
export const queryKeys = {
  me: ['me'] as const,
  university: ['university'] as const,
  demoStatus: ['demo-status'] as const,
  items: {
    all: ['items'] as const,
    list: (filters: object) => ['items', 'list', filters] as const,
    counts: (filters: object) => ['items', 'counts', filters] as const,
    mine: ['items', 'mine'] as const,
    detail: (id: string) => ['items', 'detail', id] as const,
  },
  claims: {
    all: ['claims'] as const,
    forItem: (itemId: string) => ['claims', 'item', itemId] as const,
    mine: (status: string) => ['claims', 'mine', status] as const,
    received: (status: string) => ['claims', 'received', status] as const,
    detail: (id: string) => ['claims', 'detail', id] as const,
  },
  notifications: ['notifications'] as const,
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    users: (filters: object) => ['admin', 'users', filters] as const,
    reports: (status: string) => ['admin', 'reports', status] as const,
    activity: (filters: object) => ['admin', 'activity', filters] as const,
    items: (filters: object) => ['admin', 'items', filters] as const,
  },
};
