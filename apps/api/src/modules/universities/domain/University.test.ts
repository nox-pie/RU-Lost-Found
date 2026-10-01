import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../core/errors/AppError';
import { aUniversity } from '../../../testing/builders';

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

  it.each([[[]], [['not a domain']], [['@rishihood.edu.in']]])(
    'rejects invalid email domains %j',
    (emailDomains) => {
      expect(() => aUniversity({ emailDomains })).toThrow(ValidationError);
    },
  );
});
