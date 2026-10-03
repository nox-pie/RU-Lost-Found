import type { Clock } from '../../core/domain/Clock';

/** A clock the demo seeder moves around, so sample history is dated over past weeks. */
export class DemoClock implements Clock {
  private current = new Date();

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }
}
