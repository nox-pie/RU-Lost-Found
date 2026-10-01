import type { EmailMessage } from '../../core/email/EmailSender';
import type { EmailLayout } from '../../core/email/EmailLayout';
import { html } from '../../core/email/html';

/** Emails sent during sign-up and password reset, in the deployment's brand. */
export class AuthEmails {
  constructor(private readonly layout: EmailLayout) {}

  private get product(): string {
    return this.layout.brand.name;
  }

  signupCode(to: string, code: string): EmailMessage {
    return {
      to,
      subject: `${code} is your ${this.product} verification code`,
      html: this.layout.page(
        'Verify your email',
        html`<p>Enter this code to finish creating your account:</p>
          ${this.layout.code(code)}
          <p>
            The code expires in 10 minutes. If you didn't try to sign up, you can ignore this email.
          </p>`,
      ),
      text: `Your ${this.product} verification code is ${code}. It expires in 10 minutes.`,
    };
  }

  passwordResetCode(to: string, firstName: string, code: string): EmailMessage {
    return {
      to,
      subject: `${code} is your ${this.product} password reset code`,
      html: this.layout.page(
        'Reset your password',
        html`<p>Hi ${firstName},</p>
          <p>Enter this code to choose a new password:</p>
          ${this.layout.code(code)}
          <p>
            The code expires in 10 minutes. If you didn't ask to reset your password, you can ignore
            this email; your password stays the same.
          </p>`,
      ),
      text: `Hi ${firstName}, your ${this.product} password reset code is ${code}. It expires in 10 minutes.`,
    };
  }

  /**
   * Sent instead of a sign-up code when the address already has an account. The API gives the
   * same response either way, so nobody can find out which emails are registered by trying to
   * sign up.
   */
  accountAlreadyExists(to: string, firstName: string): EmailMessage {
    return {
      to,
      subject: `You already have a ${this.product} account`,
      html: this.layout.page(
        'You already have an account',
        html`<p>Hi ${firstName},</p>
          <p>
            Someone tried to create a new account with this email address, but you already have one.
            You can sign in, or use "Forgot password" if you don't remember your password.
          </p>
          <p>If this wasn't you, no action is needed.</p>`,
      ),
      text: `Hi ${firstName}, someone tried to sign up with this email, but you already have a ${this.product} account. Sign in or use "Forgot password".`,
    };
  }
}
