import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '../../core/errors/AppError';
import { BrevoEmailSender } from './BrevoEmailSender';

const message = { to: 'a@rishihood.edu.in', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };
const from = { address: 'no-reply@example.com', name: 'RU Lost & Found' };

describe('BrevoEmailSender', () => {
  it('posts the message to the Brevo API with the key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));

    await new BrevoEmailSender('key-123', from, fetchFn).send(message);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers).toMatchObject({ 'api-key': 'key-123' });
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: from.address, name: from.name },
      to: [{ email: message.to }],
      subject: 'Hi',
      htmlContent: '<p>Hi</p>',
      textContent: 'Hi',
    });
  });

  it('reports a rejected request as an external service error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('bad sender', { status: 400 }));

    await expect(new BrevoEmailSender('k', from, fetchFn).send(message)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('reports network failures as an external service error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(new BrevoEmailSender('k', from, fetchFn).send(message)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
