import type { DomainEvent } from '../events/DomainEvent';

/**
 * Base class for entities that are loaded and saved as a unit (User, Item, Claim, ...).
 *
 * - `version` supports optimistic concurrency: a save only succeeds if nobody else saved
 *   the same aggregate since it was loaded. 0 means "never saved".
 * - Domain events are collected while business methods run and pulled by the application layer.
 */
export abstract class AggregateRoot {
  private pendingEvents: DomainEvent[] = [];

  protected constructor(
    readonly id: string,
    private currentVersion: number,
  ) {}

  get version(): number {
    return this.currentVersion;
  }

  get isNew(): boolean {
    return this.currentVersion === 0;
  }

  /** Called by repositories after a successful write. */
  markPersisted(version: number): void {
    this.currentVersion = version;
  }

  protected record(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  /** Events recorded since the last save, without clearing them. */
  peekEvents(): readonly DomainEvent[] {
    return this.pendingEvents;
  }

  /** Called by repositories once the events are stored together with the aggregate. */
  clearEvents(): void {
    this.pendingEvents = [];
  }

  /** Returns and clears the events recorded since the last call. */
  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
