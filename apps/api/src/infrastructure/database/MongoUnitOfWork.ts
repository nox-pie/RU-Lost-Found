import type { ClientSession, Connection } from 'mongoose';
import type { TransactionContext, UnitOfWork } from '../../core/persistence/UnitOfWork';

export class MongoTransaction implements TransactionContext {
  readonly kind = 'transaction' as const;

  constructor(readonly session: ClientSession) {}
}

/** Extracts the MongoDB session from a transaction context (undefined outside a transaction). */
export function sessionOf(tx: TransactionContext | undefined): ClientSession | undefined {
  if (!tx) return undefined;
  if (!(tx instanceof MongoTransaction)) {
    throw new Error('A non-MongoDB transaction was passed to a MongoDB repository.');
  }
  return tx.session;
}

/**
 * Runs work in a MongoDB multi-document transaction. The driver's `withTransaction` retries
 * the callback on transient errors (e.g. a write conflict with a concurrent transaction),
 * commits on success and aborts if the callback throws.
 *
 * Mongoose's own `connection.transaction()` helper is not used: it also resets the state of
 * hydrated Mongoose documents on abort, which this codebase never uses (repositories work with
 * plain objects) and which conflicts with schemas that have no `__v` field.
 */
export class MongoUnitOfWork implements UnitOfWork {
  constructor(private readonly connection: Connection) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => work(new MongoTransaction(session)));
    } finally {
      await session.endSession();
    }
  }
}
