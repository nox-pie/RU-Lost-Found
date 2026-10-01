import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api/client';

/**
 * Shows an API error in the right place: field errors next to their inputs (the API reports
 * paths like "body.title"), anything else as a toast.
 */
export function showFormError<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>,
) {
  if (error instanceof ApiError && setError && error.details.length > 0) {
    let placed = false;
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (!field || field === 'body') continue;
      setError(field as Path<T>, { type: 'server', message });
      placed = true;
    }
    if (placed) return;
  }
  toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}

/** Treats an empty text input as "not provided" instead of an empty string. */
export const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
