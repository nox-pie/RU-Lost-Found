import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

/** The value of "Somewhere else" in the place dropdown: the post names no campus place. */
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
  { value: ELSEWHERE, label: 'Somewhere else' },
];
