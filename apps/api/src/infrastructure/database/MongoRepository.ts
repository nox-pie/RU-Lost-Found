import {
  mongo,
  type ClientSession,
  type Connection,
  type Model,
  type Schema,
  type Types,
} from 'mongoose';
import type { AggregateRoot } from '../../core/domain/AggregateRoot';
import type { DomainEvent } from '../../core/events/DomainEvent';
import { ConcurrencyError, ConflictError } from '../../core/errors/AppError';
import type { Repository } from '../../core/persistence/Repository';
import type { TransactionContext } from '../../core/persistence/UnitOfWork';
import { sessionOf } from './MongoUnitOfWork';

export interface VersionedDocument {
  _id: Types.ObjectId;
  version: number;
}

/** A MongoDB query filter, e.g. `{ universityId, status: { $in: [...] } }`. */
export type DocumentFilter = Record<string, unknown>;

/**
 * Mongoose model without per-document generics. Mongoose's generic query types are too
 * expensive for the compiler inside a generic base class; each repository declares its
 * document type explicitly and maps every field by hand, so no safety is lost.
 */
type UntypedModel = Model<Record<string, unknown>>;

/** Registers a model on a connection once (safe to call from several repository instances). */
export function modelFor(connection: Connection, name: string, schema: Schema): UntypedModel {
  const existing = connection.models[name] ?? connection.model(name, schema);
  return existing as unknown as UntypedModel;
}

const DUPLICATE_KEY = 11000;

function duplicateKeyIndex(error: unknown): string | undefined | false {
  if (!(error instanceof mongo.MongoServerError) || error.code !== DUPLICATE_KEY) return false;
  return /index: (\S+)/.exec(error.message)?.[1];
}

/** Where aggregates' domain events are stored (see MongoOutbox). */
export interface OutboxWriter {
  append(events: readonly DomainEvent[], session: ClientSession | undefined): Promise<void>;
}

/**
 * Template Method: subclasses define how an entity maps to a document; this class handles
 * inserts, optimistic-concurrency updates, sessions, error translation and event storage.
 *
 * Domain events recorded by the entity are written to the outbox in the same transaction as the
 * entity itself (the caller's transaction, or one started here), so a change and its events are
 * saved together or not at all, and no service can forget to publish them.
 */
export abstract class MongoRepository<
  TEntity extends AggregateRoot,
  TDoc extends VersionedDocument,
> implements Repository<TEntity> {
  protected constructor(
    protected readonly model: UntypedModel,
    private readonly outbox?: OutboxWriter,
  ) {}

  protected abstract toEntity(doc: TDoc): TEntity;
  protected abstract toDocument(entity: TEntity): Omit<TDoc, 'version'>;

  /** Message for a unique-index violation; subclasses map their index names to friendly text. */
  protected duplicateKeyMessage(_indexName: string | undefined): string {
    return 'This record already exists.';
  }

  /** Creates the collection and its indexes. Called once at startup and in tests. */
  async ensureIndexes(): Promise<void> {
    await this.model.createCollection();
    await this.model.syncIndexes();
  }

  async create(entity: TEntity, tx?: TransactionContext): Promise<void> {
    if (!entity.isNew) {
      throw new Error(`Cannot create ${this.model.modelName} ${entity.id}: it was already saved.`);
    }
    const document = { ...this.toDocument(entity), version: 1 };
    await this.write(entity, tx, async (session) => {
      await this.model.create([document], { session });
    });
    entity.markPersisted(1);
  }

  /** Saves only if the stored version still matches the one loaded; otherwise throws ConcurrencyError. */
  async update(entity: TEntity, tx?: TransactionContext): Promise<void> {
    const { _id, ...fields } = this.toDocument(entity);
    const nextVersion = entity.version + 1;

    await this.write(entity, tx, async (session) => {
      const result = await this.model.updateOne(
        { _id, version: entity.version },
        { $set: { ...fields, version: nextVersion } },
        { session },
      );
      if (result.matchedCount === 0) throw new ConcurrencyError();
    });
    entity.markPersisted(nextVersion);
  }

  /** Runs the write and stores the entity's pending events atomically with it. */
  private async write(
    entity: TEntity,
    tx: TransactionContext | undefined,
    operation: (session: ClientSession | undefined) => Promise<void>,
  ): Promise<void> {
    const events = [...entity.peekEvents()];
    const outbox = events.length > 0 ? this.outbox : undefined;

    try {
      if (!outbox) {
        await operation(sessionOf(tx));
      } else if (tx) {
        const session = sessionOf(tx);
        await operation(session);
        await outbox.append(events, session);
      } else {
        const session = await this.model.db.startSession();
        try {
          await session.withTransaction(async () => {
            await operation(session);
            await outbox.append(events, session);
          });
        } finally {
          await session.endSession();
        }
      }
    } catch (error) {
      this.rethrow(error);
    }
    entity.clearEvents();
  }

  protected async findOne(
    filter: DocumentFilter,
    tx?: TransactionContext,
  ): Promise<TEntity | null> {
    const doc = await this.model
      .findOne(filter, null, { session: sessionOf(tx) })
      .lean()
      .exec();
    return doc ? this.toEntity(doc as unknown as TDoc) : null;
  }

  protected async findMany(
    filter: DocumentFilter,
    options: { sort?: Record<string, 1 | -1>; limit?: number; tx?: TransactionContext } = {},
  ): Promise<TEntity[]> {
    let query = this.model.find(filter, null, { session: sessionOf(options.tx) });
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    const docs = await query.lean().exec();
    return docs.map((doc) => this.toEntity(doc as unknown as TDoc));
  }

  private rethrow(error: unknown): never {
    const index = duplicateKeyIndex(error);
    if (index !== false) throw new ConflictError(this.duplicateKeyMessage(index));
    throw error;
  }
}
