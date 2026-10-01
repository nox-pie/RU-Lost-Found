import { describe, expect, it, vi } from 'vitest';
import { SystemClock } from '../core/domain/Clock';
import { createLogger } from '../core/logger/logger';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConsoleEmailSender } from './email/ConsoleEmailSender';
import { FileEmailSender } from './email/FileEmailSender';

describe('development providers', () => {
  it('SystemClock tells the real time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('FileEmailSender writes each email to its own file, in order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rlf-mail-'));
    const sender = new FileEmailSender(dir);
    await sender.send({ to: 'a@x.in', subject: 'First', html: '', text: '1' });
    await sender.send({ to: 'a@x.in', subject: 'Second', html: '', text: '2' });

    const files = (await readdir(dir)).sort();
    const subjects = await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')).subject),
    );
    await rm(dir, { recursive: true, force: true });

    expect(subjects).toEqual(['First', 'Second']);
  });

  it('ConsoleEmailSender logs the email instead of sending it', async () => {
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
    const info = vi.spyOn(logger, 'info');

    await new ConsoleEmailSender(logger).send({
      to: 'a@rishihood.edu.in',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi there',
    });

    expect(info).toHaveBeenCalledWith(
      { to: 'a@rishihood.edu.in', subject: 'Hi', text: 'Hi there' },
      expect.stringContaining('not sent'),
    );
  });
});
