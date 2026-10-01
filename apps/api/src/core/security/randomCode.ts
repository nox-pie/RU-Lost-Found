import { randomInt } from 'node:crypto';

/** A numeric code such as "048213" from a cryptographically secure random source. */
export function generateNumericCode(digits = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, '0');
}
