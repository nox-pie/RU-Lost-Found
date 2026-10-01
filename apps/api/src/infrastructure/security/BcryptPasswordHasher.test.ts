import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from './BcryptPasswordHasher';

const hasher = new BcryptPasswordHasher(4);
/** Made by bcryptjs 3, the library of the first version: migrated accounts have hashes like it. */
const FIRST_VERSION_HASH = '$2b$04$fgalEU2eMoMYXb88zZ/DjeOy.gnmt0r1r5WfT6AwESGHAOylq.tXG';

describe('BcryptPasswordHasher', () => {
  it('verifies its own hashes and rejects wrong passwords', async () => {
    const hash = await hasher.hash('correct horse 1');

    expect(hash).toMatch(/^\$2b\$04\$/);
    expect(await hasher.verify('correct horse 1', hash)).toBe(true);
    expect(await hasher.verify('correct horse 2', hash)).toBe(false);
  });

  it('accepts hashes from the first version (bcryptjs), in both $2b$ and $2a$ form', async () => {
    expect(await hasher.verify('old-pass-1', FIRST_VERSION_HASH)).toBe(true);
    expect(await hasher.verify('old-pass-1', FIRST_VERSION_HASH.replace('$2b$', '$2a$'))).toBe(
      true,
    );
    expect(await hasher.verify('old-pass-2', FIRST_VERSION_HASH)).toBe(false);
  });
});
