import mongoose, { type Connection } from 'mongoose';
import type { HealthIndicator } from '../../core/health/HealthIndicator';
import type { Logger } from '../../core/logger/logger';

/**
 * Owns the MongoDB connection. Repositories receive `connection` and register their models on it,
 * so nothing depends on Mongoose's global default connection (tests can run isolated connections).
 */
export class MongoDatabase implements HealthIndicator {
  readonly name = 'mongodb';

  private constructor(
    readonly connection: Connection,
    private readonly logger: Logger,
  ) {}

  static async connect(
    uri: string,
    logger: Logger,
    options: { serverSelectionTimeoutMS?: number } = {},
  ): Promise<MongoDatabase> {
    const connection = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 10_000,
    });
    await connection.asPromise();

    const database = new MongoDatabase(connection, logger);
    connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    connection.on('reconnected', () => logger.info('MongoDB reconnected'));
    logger.info({ database: connection.name }, 'Connected to MongoDB');
    return database;
  }

  /** Wraps a connection opened elsewhere (used by tests, which manage their own databases). */
  static fromConnection(connection: Connection, logger: Logger): MongoDatabase {
    return new MongoDatabase(connection, logger);
  }

  async isHealthy(): Promise<boolean> {
    if (this.connection.readyState !== mongoose.ConnectionStates.connected) return false;
    try {
      await this.connection.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.connection.close();
    this.logger.info('MongoDB connection closed');
  }
}
