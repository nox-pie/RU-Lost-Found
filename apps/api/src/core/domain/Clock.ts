/** Source of the current time. Injected so time-based rules (expiry, deadlines) can be tested. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
