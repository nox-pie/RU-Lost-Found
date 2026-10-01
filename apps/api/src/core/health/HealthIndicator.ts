/**
 * Anything the API depends on at runtime (database, cache, ...) can report whether it is reachable.
 * The health module only knows this interface, not the concrete infrastructure classes.
 */
export interface HealthIndicator {
  readonly name: string;
  /** Resolves to true when the dependency is usable. Must not throw for an ordinary outage. */
  isHealthy(): Promise<boolean>;
}
