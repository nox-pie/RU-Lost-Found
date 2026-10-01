import type { ItemDto } from '@ru-lost-found/shared';
import type { User } from '../users/domain/User';
import { toPersonSummary } from '../users/person.mapper';
import type { Item } from './domain/Item';

/** An item together with its reporter, as returned by ItemService. */
export interface ItemView {
  item: Item;
  reporter: User | undefined;
}

export function toItemDto({ item, reporter }: ItemView, viewerId: string): ItemDto {
  return {
    id: item.id,
    type: item.type,
    category: item.category,
    title: item.title,
    description: item.description,
    location: item.location,
    occurredOn: item.occurredOn.toISOString().slice(0, 10),
    photos: item.images.map((image) => image.url),
    status: item.status,
    heldAtSecurityDesk: item.heldAtSecurityDesk,
    verificationQuestions: item.verificationQuestions.map((q) => ({
      id: q.id,
      question: q.question,
    })),
    reporter: toPersonSummary(item.reporterId, reporter),
    isMine: item.isReportedBy(viewerId),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
  };
}
