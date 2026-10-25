import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger/logger';
import { redactUrlCredentials } from './redact';

describe('redactUrlCredentials', () => {
  it.each([
    ['rediss://default:s3cr3t@host.upstash.io:6379', 'rediss://***@host.upstash.io:6379'],
    [
      'connect ENOENT //default:s3cr3t@host.upstash.io:6379%22',
      'connect ENOENT //***@host.upstash.io:6379%22',
    ],
    // A made-up host on a reserved domain, so secret scanners don't mistake it for a real one.
    ['mongodb+srv://user:p4ss@cluster.example.net/db', 'mongodb+srv://***@cluster.example.net/db'],
    ['https://example.com/path?x=1', 'https://example.com/path?x=1'],
  ])('%s', (text, expected) => {
    expect(redactUrlCredentials(text)).toBe(expected);
  });
});

describe('logger', () => {
  it('never writes credentials from error messages or stacks', () => {
    let output = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const logger = createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'info' }, sink);

    logger.warn(
      { err: new Error('connect ENOENT //default:s3cr3t@host.upstash.io:6379') },
      'Redis error',
    );

    expect(output).toContain('//***@host.upstash.io');
    expect(output).not.toContain('s3cr3t');
  });
});
