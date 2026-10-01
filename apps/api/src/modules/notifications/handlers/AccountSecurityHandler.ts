import { z } from 'zod';
import type { EmailSender } from '../../../core/email/EmailSender';
import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import type { UserRepository } from '../../users/domain/UserRepository';
import type { NotificationEmails } from '../notification.emails';

const suspendedPayload = z.object({ reason: z.string() });

/**
 * Account notices by email: a password change (in case it wasn't them), and an admin
 * suspending or reactivating the account. Suspended users can't sign in, so email is the only
 * way to tell them.
 */
export class AccountSecurityHandler implements EventHandler {
  readonly name = 'account-security';
  readonly handles = ['PasswordChanged', 'UserSuspended', 'UserReactivated'] as const;

  constructor(
    private readonly users: UserRepository,
    private readonly emailSender: EmailSender,
    private readonly emails: NotificationEmails,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    const user = await this.users.findById(event.aggregateId);
    if (!user) return;
    const to = { to: user.email, firstName: user.profile.firstName };

    if (event.type === 'UserSuspended') {
      const { reason } = suspendedPayload.parse(event.payload);
      await this.emailSender.send(
        this.emails.compose({
          ...to,
          subject: 'Your account was suspended',
          heading: 'Your account was suspended',
          paragraphs: [
            'An administrator suspended your account, and you were signed out on every device.',
            `Reason: ${reason}`,
            'If you think this is a mistake, contact the administrators of your university.',
          ],
        }),
      );
      return;
    }
    if (event.type === 'UserReactivated') {
      await this.emailSender.send(
        this.emails.compose({
          ...to,
          subject: 'Your account is active again',
          heading: 'Your account is active again',
          paragraphs: ['An administrator reactivated your account. You can sign in again.'],
          action: { label: 'Sign in', path: '/login' },
        }),
      );
      return;
    }

    await this.emailSender.send(
      this.emails.compose({
        ...to,
        subject: 'Your password was changed',
        heading: 'Your password was changed',
        paragraphs: [
          'The password of your account was just changed, and you were signed out on every device.',
          'If this was you, no action is needed. If it wasn’t, reset your password now and contact the administrators.',
        ],
        action: { label: 'Reset password', path: '/forgot-password' },
      }),
    );
  }
}
