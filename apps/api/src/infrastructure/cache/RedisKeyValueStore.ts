import { Redis } from 'ioredis';
import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import type { HealthIndicator } from '../../core/health/HealthIndicator';
import type { Logger } from '../../core/logger/logger';

/** INCR, and set the expiry only when the counter is new; returns [count, seconds left]. */
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('TTL', KEYS[1]) }
`;

/** KeyValueStore on Redis (e.g. Upstash), shared by every API instance and kept across restarts. */
export class RedisKeyValueStore implements KeyValueStore, HealthIndicator {
  readonly name = 'redis';

  private constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  static async connect(url: string, logger: Logger, prefix = 'rlf:'): Promise<RedisKeyValueStore> {
    const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    redis.on('error', (err) => logger.warn({ err }, 'Redis error'));
    await redis.connect();
    logger.info('Connected to Redis');
    return new RedisKeyValueStore(redis, prefix);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(this.prefix + key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.prefix + key, value, 'EX', ttlSeconds);
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.redis.del(...keys.map((key) => this.prefix + key));
  }

  async increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; resetInSeconds: number }> {
    const [count, ttl] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      1,
      this.prefix + key,
      String(windowSeconds),
    )) as [number, number];
    return { count, resetInSeconds: Math.max(1, ttl) };
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
