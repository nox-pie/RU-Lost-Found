import type { EmailMessage } from '../../core/email/EmailSender';
import type { EmailLayout } from '../../core/email/EmailLayout';
import { html } from '../../core/email/html';

export interface NotificationEmailContent {
  to: string;
  firstName: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  /** Shown large, e.g. the handover code. */
  code?: string;
  /** A button back to the app; `path` is relative to the web app, e.g. "/claims/123". */
  action?: { label: string; path: string };
}

/**
 * One layout for every notification email: greeting, a few paragraphs, an optional code and a
 * button back to the app. All text is escaped by the `html` template.
 */
export class NotificationEmails {
  constructor(
    private readonly layout: EmailLayout,
    private readonly appUrl: string,
  ) {}

  compose(content: NotificationEmailContent): EmailMessage {
    const { action } = content;
    const url = action ? `${this.appUrl}${action.path}` : null;
    const body = html`<p>Hi ${content.firstName},</p>
      ${content.paragraphs.map((paragraph) => html`<p>${paragraph}</p>`)}
      ${content.code ? this.layout.code(content.code) : ''}
      ${action && url ? this.layout.button(action.label, url) : ''}`;

    const text = [
      `Hi ${content.firstName},`,
      ...content.paragraphs,
      ...(content.code ? [`Handover code: ${content.code}`] : []),
      ...(action && url ? [`${action.label}: ${url}`] : []),
    ].join('\n\n');

    return {
      to: content.to,
      subject: content.subject,
      html: this.layout.page(content.heading, body),
      text,
    };
  }
}
