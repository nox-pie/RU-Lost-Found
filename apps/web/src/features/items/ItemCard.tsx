import type { ItemDto } from '@ru-lost-found/shared';
import { Calendar, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/misc';
import { CATEGORY_LABELS, ITEM_STATUS, formatDay } from '../../lib/format';

function ItemCard({ item }: { item: ItemDto }) {
  const status = ITEM_STATUS[item.status];
  return (
    <Link
      to={`/items/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {item.photos[0] && (
          <img
            src={item.photos[0]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        )}
        <span
          className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow ${item.type === 'LOST' ? 'bg-primary' : 'bg-secondary'}`}
        >
          {item.type === 'LOST' ? 'Lost' : 'Found'}
        </span>
        {item.status !== 'OPEN' && (
          <span className="absolute left-3 top-3">
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        )}
        {item.isSample && (
          <span
            className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
            title="Sample data showing how the portal works"
          >
            Sample post
          </span>
        )}
      </div>
      <div className="flex flex-grow flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {CATEGORY_LABELS[item.category]}
        </p>
        <h3 className="mt-1 line-clamp-1 text-lg font-semibold text-gray-900 group-hover:text-primary">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.description}</p>
        <div className="mt-auto space-y-1.5 pt-4 text-xs text-gray-500">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />{' '}
            <span className="truncate">{item.location}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" /> {formatDay(item.occurredOn)}
          </p>
          {item.heldAtSecurityDesk && (
            <p className="flex items-center gap-1.5 text-green-700">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> At the security desk
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ItemGrid({ items }: { items: ItemDto[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
