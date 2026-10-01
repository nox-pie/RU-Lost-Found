import type { DomainEvent } from './DomainEvent';

/** A domain event as read back from the outbox: it now has its own id. */
export interface StoredEvent extends DomainEvent {
  readonly id: string;
}

/**
 * Observer: reacts to domain events after the change that produced them has been committed.
 * Handlers run at least once per event and may be retried, so they must be safe to repeat.
 */
export interface EventHandler {
  /** Unique, stable name; used to remember which handlers already processed an event. */
  readonly name: string;
  readonly handles: readonly string[];
  handle(event: StoredEvent): Promise<void>;
}

/** Looks up the handlers for an event type. */
export class EventHandlerRegistry {
  private readonly byType = new Map<string, EventHandler[]>();

  constructor(handlers: readonly EventHandler[] = []) {
    handlers.forEach((handler) => this.register(handler));
  }

  register(handler: EventHandler): void {
    for (const type of handler.handles) {
      this.byType.set(type, [...(this.byType.get(type) ?? []), handler]);
    }
  }

  handlersFor(type: string): readonly EventHandler[] {
    return this.byType.get(type) ?? [];
  }
}
