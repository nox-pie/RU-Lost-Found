import { hkdfSync } from 'node:crypto';

export type KeyPurpose = 'access-token' | 'verification-token' | 'one-time-code';

/**
 * Derives an independent 256-bit key per purpose from the single APP_SECRET (HKDF-SHA256).
 * A key leaked or misused in one place (e.g. code hashing) says nothing about the others.
 */
export function deriveKey(appSecret: string, purpose: KeyPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', appSecret, 'ru-lost-found', purpose, 32));
}
