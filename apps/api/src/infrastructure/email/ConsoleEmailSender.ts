import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';
import type { Logger } from '../../core/logger/logger';

/** Development stand-in: writes emails to the log instead of sending them. */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject, text: message.text },
      'Email (not sent: no email provider configured)',
    );
  }
}
