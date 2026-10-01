import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';
import { ExternalServiceError } from '../../core/errors/AppError';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

/**
 * Adapter for Brevo's transactional email HTTP API. Uses HTTPS rather than SMTP,
 * so it works on hosts that block outgoing SMTP ports.
 */
export class BrevoEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: { address: string; name: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchFn(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.from.address, name: this.from.name },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new ExternalServiceError('Email service', error);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ExternalServiceError(
        'Email service',
        new Error(`Brevo responded ${response.status}: ${detail.slice(0, 500)}`),
      );
    }
  }
}
