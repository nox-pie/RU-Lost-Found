import type { ItemDto } from '@ru-lost-found/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/misc';
import { itemsApi } from '../../lib/api/endpoints';
import { formatDay, whereOf } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

/**
 * For the reporter of an open post: posts on the other side (lost ↔ found) that may be the
 * same item, best first. Worked out by the API when asked; nothing to set up.
 */
export function PossibleMatches({ item }: { item: ItemDto }) {
  const matches = useQuery({
    queryKey: queryKeys.items.matches(item.id),
    queryFn: () => itemsApi.matches(item.id),
  });
  const list = matches.data?.data ?? [];
  const lost = item.type === 'LOST';

  return (
    <section className="rounded-2xl bg-white p-4 shadow-xs" aria-labelledby="matches-heading">
      <h2
        id="matches-heading"
        className="flex items-center gap-2 font-display text-lg font-semibold"
      >
        <Sparkles className="h-4 w-4 text-secondary-dark" aria-hidden /> Possible matches
      </h2>
      {matches.isPending ? (
        <p className="mt-2 text-sm text-gray-500">Looking…</p>
      ) : list.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          {lost
            ? 'No found post looks like yours yet. If one is posted, you’ll get a notification and an email.'
            : 'No lost post looks like this item yet.'}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">
            {lost
              ? 'Found posts that may be your item. Check the photos, then claim it if it’s yours.'
              : 'Lost posts this item may belong to. Their owners may claim it.'}
          </p>
          <ul className="mt-3 divide-y">
            {list.map(({ item: match, strong }) => (
              <MatchRow key={match.id} match={match} strong={strong} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MatchRow({ match, strong }: { match: ItemDto; strong: boolean }) {
  return (
    <li>
      <Link
        to={`/items/${match.id}`}
        className="-mx-2 flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50"
      >
        {match.photos[0] ? (
          <img
            src={match.photos[0]}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" aria-hidden />
        )}
        <span className="min-w-0 grow">
          <span className="block truncate text-sm font-medium text-gray-900">{match.title}</span>
          <span className="block truncate text-xs text-gray-500">
            {whereOf(match)} · {formatDay(match.occurredOn)}
          </span>
        </span>
        <Badge tone={strong ? 'success' : 'info'}>
          {strong ? 'Strong match' : 'Possible match'}
        </Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </Link>
    </li>
  );
}
