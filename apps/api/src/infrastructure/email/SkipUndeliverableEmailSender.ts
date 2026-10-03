import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';
import type { Logger } from '../../core/logger/logger';

/** Top-level domains reserved for testing; mail to them can never be delivered (RFC 2606, 6761). */
const RESERVED = /\.(invalid|test|example|localhost)$/i;

/**
 * Decorator: drops emails to reserved test domains instead of handing them to the provider.
 * Demo accounts use such addresses, so a visitor claiming a sample post doesn't make Brevo
 * attempt (and bounce) a real email, which would waste the daily quota and hurt the sender's
 * reputation. Every other email passes through unchanged.
 */
export class SkipUndeliverableEmailSender implements EmailSender {
  constructor(
    private readonly inner: EmailSender,
    private readonly logger: Logger,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const domain = message.to.split('@')[1] ?? '';
    if (RESERVED.test(domain)) {
      this.logger.debug({ domain, subject: message.subject }, 'Email to a reserved domain skipped');
      return;
    }
    await this.inner.send(message);
  }
}
