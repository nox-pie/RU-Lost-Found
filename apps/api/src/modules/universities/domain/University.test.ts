import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../core/errors/AppError';
import { T0, aUniversity, minutesAfter } from '../../../testing/builders';

describe('University', () => {
  const university = aUniversity({ emailDomains: ['rishihood.edu.in'] });

  it.each([
    ['student@rishihood.edu.in', true],
    ['prashant.k23csai@nst.rishihood.edu.in', true],
    ['  Someone@NST.Rishihood.EDU.in ', true],
    ['student@gmail.com', false],
    ['student@fakerishihood.edu.in', false],
    ['student@rishihood.edu.in.evil.com', false],
    ['not-an-email', false],
  ])('allowsEmail(%s) is %s', (email, expected) => {
    expect(university.allowsEmail(email)).toBe(expected);
  });

  it('normalises and de-duplicates its domains and schools', () => {
    const created = aUniversity({
      emailDomains: [' Rishihood.edu.in', 'rishihood.edu.in'],
      schools: ['School of Creativity', ' School of Creativity ', ''],
    });

    expect(created.emailDomains).toEqual(['rishihood.edu.in']);
    expect(created.schools).toEqual(['School of Creativity']);
    expect(created.hasSchool('School of Creativity')).toBe(true);
  });

  it('accepts any well-formed address when its domains include "*"', () => {
    const open = aUniversity({ emailDomains: ['rishihood.edu.in', '*'] });

    expect(open.acceptsAnyEmail).toBe(true);
    expect(open.allowsEmail('recruiter@gmail.com')).toBe(true);
    expect(open.allowsEmail('not-an-email')).toBe(false);
    expect(open.ownsEmailDomain('student@nst.rishihood.edu.in')).toBe(true);
    expect(open.ownsEmailDomain('recruiter@gmail.com')).toBe(false);
    expect(university.acceptsAnyEmail).toBe(false);
  });

  it('applies changed settings and reports when nothing changed', () => {
    const later = minutesAfter(T0, 5);
    const created = aUniversity({
      name: 'Rishihood University',
      emailDomains: ['rishihood.edu.in'],
    });
    const settings = {
      name: 'Rishihood University',
      emailDomains: ['rishihood.edu.in', '*'],
      schools: [...created.schools],
    };

    expect(created.updateSettings(settings, later)).toBe(true);
    expect(created.acceptsAnyEmail).toBe(true);
    expect(created.updatedAt).toEqual(later);
    expect(created.updateSettings(settings, later)).toBe(false);
    expect(() =>
      created.updateSettings({ ...settings, emailDomains: ['bad domain'] }, later),
    ).toThrow(ValidationError);
  });

  it.each([[[]], [['not a domain']], [['@rishihood.edu.in']]])(
    'rejects invalid email domains %j',
    (emailDomains) => {
      expect(() => aUniversity({ emailDomains })).toThrow(ValidationError);
    },
  );
});
