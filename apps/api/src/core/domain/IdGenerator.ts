/**
 * Creates identifiers for new aggregates before they are saved, so their id can be referenced
 * immediately (e.g. in domain events) without depending on the database.
 */
export interface IdGenerator {
  next(): string;
}
