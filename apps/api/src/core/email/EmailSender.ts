export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text version for clients that don't render HTML (and for spam filters). */
  text: string;
}

export interface EmailSender {
  /** Throws ExternalServiceError if the provider rejects or cannot be reached. */
  send(message: EmailMessage): Promise<void>;
}
