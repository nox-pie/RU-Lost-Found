import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';

/**
 * Development and end-to-end tests: writes each email as a JSON file into a folder instead of
 * sending it (like a local mail catcher), so codes can be read by people and by test scripts.
 */
export class FileEmailSender implements EmailSender {
  private sequence = 0;

  constructor(private readonly directory: string) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    this.sequence += 1;
    const file = path.join(
      this.directory,
      `${Date.now()}-${String(this.sequence).padStart(4, '0')}.json`,
    );
    // Write under a temporary name, then rename (atomic): a reader polling the folder never
    // sees a half-written file.
    await writeFile(`${file}.tmp`, JSON.stringify(message, null, 2));
    await rename(`${file}.tmp`, file);
  }
}
