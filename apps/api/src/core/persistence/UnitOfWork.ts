/**
 * An open transaction. Opaque to services: they only pass it on to repository methods,
 * so every write made with the same context commits or rolls back together.
 */
export interface TransactionContext {
  readonly kind: 'transaction';
}

export interface UnitOfWork {
  /**
   * Runs `work` inside a transaction. Commits if it resolves, rolls back if it throws.
   * `work` may be retried on transient conflicts, so it must load what it needs inside the callback.
   */
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
