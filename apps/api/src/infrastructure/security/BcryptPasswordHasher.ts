import bcrypt from 'bcrypt';
import type { PasswordHasher } from '../../core/security/PasswordHasher';

/**
 * bcrypt through the native library, which hashes on libuv's thread pool. The load test showed
 * why that matters: the pure-JavaScript version (bcryptjs) did the ~0.5 s of work per sign-in on
 * the main thread, so every request arriving during a sign-in waited for it. Hashes are the
 * standard `$2b$` format, so accounts hashed by either version keep working.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
