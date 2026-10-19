import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import { ValidationError } from '../../../core/errors/AppError';

export type UniversityStatus = 'ACTIVE' | 'DISABLED';

export interface UniversityProps {
  id: string;
  name: string;
  slug: string;
  emailDomains: string[];
  schools: string[];
  /** Campus places a post can name (library, canteen, ...): for finding and matching posts. */
  places: string[];
  status: UniversityStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

/** In `emailDomains`: any address may sign up (e.g. a public demo). Emails are still verified. */
export const ANY_EMAIL_DOMAIN = '*';

/** Trimmed, lower-case and unique; every entry a real domain or ANY_EMAIL_DOMAIN. */
function normaliseDomains(domains: readonly string[]): string[] {
  const emailDomains = [...new Set(domains.map((d) => d.trim().toLowerCase()))];
  if (emailDomains.length === 0) {
    throw new ValidationError('A university needs at least one email domain.');
  }
  const invalid = emailDomains.filter((d) => d !== ANY_EMAIL_DOMAIN && !DOMAIN_PATTERN.test(d));
  if (invalid.length > 0) {
    throw new ValidationError(`Invalid email domain: ${invalid.join(', ')}`);
  }
  return emailDomains;
}

/** Trimmed, without blanks or repeats, in the order given (it is the order of the dropdowns). */
const normaliseList = (values: readonly string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

/**
 * A university using the platform (a tenant). Owns which email addresses may sign up
 * and which schools users can pick. Schools are departments, not separate tenants.
 */
export class University extends AggregateRoot {
  private constructor(private props: UniversityProps) {
    super(props.id, props.version);
  }

  static create(input: {
    id: string;
    name: string;
    slug: string;
    emailDomains: string[];
    schools: string[];
    places?: string[];
    now: Date;
  }): University {
    return new University({
      id: input.id,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      emailDomains: normaliseDomains(input.emailDomains),
      schools: normaliseList(input.schools),
      places: normaliseList(input.places ?? []),
      status: 'ACTIVE',
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
  }

  static restore(props: UniversityProps): University {
    return new University(props);
  }

  get name() {
    return this.props.name;
  }
  get slug() {
    return this.props.slug;
  }
  get emailDomains(): readonly string[] {
    return this.props.emailDomains;
  }
  get schools(): readonly string[] {
    return this.props.schools;
  }
  get places(): readonly string[] {
    return this.props.places;
  }
  get status() {
    return this.props.status;
  }
  get isActive() {
    return this.props.status === 'ACTIVE';
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  /** Anyone may sign up, not only addresses of the university's own domains. */
  get acceptsAnyEmail(): boolean {
    return this.props.emailDomains.includes(ANY_EMAIL_DOMAIN);
  }

  /**
   * True if the address belongs to one of the university's domains or their subdomains,
   * e.g. `rishihood.edu.in` also admits `student@nst.rishihood.edu.in`; or to any domain when
   * the university accepts any email.
   */
  allowsEmail(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@')[1];
    if (!domain) return false;
    return this.props.emailDomains.some(
      (allowed) =>
        allowed === ANY_EMAIL_DOMAIN || domain === allowed || domain.endsWith(`.${allowed}`),
    );
  }

  /** True if the address matches one of the university's own domains (not just the wildcard). */
  ownsEmailDomain(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@')[1] ?? '';
    return this.props.emailDomains.some(
      (allowed) =>
        allowed !== ANY_EMAIL_DOMAIN && (domain === allowed || domain.endsWith(`.${allowed}`)),
    );
  }

  /**
   * Applies the deployment's configuration (seed/universities.json) to an existing university.
   * Returns false when nothing changed.
   */
  updateSettings(
    settings: {
      name: string;
      emailDomains: readonly string[];
      schools: readonly string[];
      places?: readonly string[];
    },
    now: Date,
  ): boolean {
    const next = {
      name: settings.name.trim(),
      emailDomains: normaliseDomains(settings.emailDomains),
      schools: normaliseList(settings.schools),
      places: normaliseList(settings.places ?? []),
    };
    const same = (a: readonly string[], b: readonly string[]) =>
      a.length === b.length && a.every((value, index) => value === b[index]);
    if (
      next.name === this.props.name &&
      same(next.emailDomains, this.props.emailDomains) &&
      same(next.schools, this.props.schools) &&
      same(next.places, this.props.places)
    ) {
      return false;
    }
    this.props = { ...this.props, ...next, updatedAt: now };
    return true;
  }

  hasSchool(school: string): boolean {
    return this.props.schools.includes(school);
  }

  hasPlace(place: string): boolean {
    return this.props.places.includes(place);
  }
}
