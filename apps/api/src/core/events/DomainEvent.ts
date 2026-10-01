/**
 * Something that happened in the domain, e.g. "ClaimApproved".
 * Aggregates record events; the application layer persists them (outbox) and reacts to them.
 */
export interface DomainEvent<
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly type: TType;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}
