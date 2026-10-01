import { useEffect } from 'react';
import { toast } from 'sonner';
import { onServerWaking } from '../lib/api/client';

const TOAST_ID = 'server-waking';

/** Explains the wait while the API starts up after a quiet period (free hosting tier). */
export function ServerWakeNotice() {
  useEffect(
    () =>
      onServerWaking((waking) => {
        if (waking) {
          toast.loading('Waking up the server…', {
            id: TOAST_ID,
            description: 'This can take up to a minute after a quiet period.',
          });
        } else {
          toast.dismiss(TOAST_ID);
        }
      }),
    [],
  );
  return null;
}
