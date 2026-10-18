import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

/**
 * Whether this deployment offers the demo. `available` stays false until the API confirms the
 * demo is switched on; while a sleeping server wakes up, `checking` is true.
 */
export function useDemoStatus() {
  const status = useQuery({
    queryKey: queryKeys.demoStatus,
    queryFn: authApi.demoStatus,
    staleTime: Infinity,
    retry: 1,
  });
  return { available: status.data?.enabled === true, checking: status.isPending };
}

/**
 * True unless the API says there is no demo: the landing page keeps its demo parts while a
 * sleeping server is still answering, so nothing jumps, and drops them once demo mode is off.
 */
export function useShowDemo(): boolean {
  const { available, checking } = useDemoStatus();
  return checking || available;
}
