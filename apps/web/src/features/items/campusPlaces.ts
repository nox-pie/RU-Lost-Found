import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

/** The value of "Other" in the place dropdown: the post names no campus place. */
export const ELSEWHERE = '';

/** The university's campus places, for the report and edit forms (empty while loading or none). */
export function useCampusPlaces(): readonly string[] {
  const university = useQuery({
    queryKey: queryKeys.university,
    queryFn: usersApi.university,
    staleTime: Infinity,
  });
  return university.data?.places ?? [];
}

export const placeOptions = (places: readonly string[]) => [
  ...places.map((place) => ({ value: place, label: place })),
  { value: ELSEWHERE, label: 'Other' },
];

/**
 * The free-text box next to the place dropdown: the exact spot inside a listed place, or the
 * place itself for "Other". The hint steers a room in a listed building to that building, so the
 * post counts towards it in the breakdowns and matching.
 */
export function spotField(
  places: readonly string[],
  place: string,
  whereLabel: string,
): { label: string; placeholder: string; hint?: string } {
  if (places.length === 0) return { label: whereLabel, placeholder: 'e.g. Library, 2nd floor' };
  if (place !== ELSEWHERE) return { label: 'Exact spot', placeholder: 'e.g. Room 408, 2nd floor' };
  return {
    label: 'Which place?',
    placeholder: 'Type the place',
    hint: 'Inside a place on the list, like a room in a block? Pick that place, then type the room here.',
  };
}
