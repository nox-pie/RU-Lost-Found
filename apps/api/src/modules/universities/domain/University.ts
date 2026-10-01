import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import { ValidationError } from '../../../core/errors/AppError';

export type UniversityStatus = 'ACTIVE' | 'DISABLED';

export interface UniversityProps {
  id: string;
  name: string;
  slug: string;
  emailDomains: string[];
  schools: string[];
  status: UniversityStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

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
    now: Date;
  }): University {
    const emailDomains = [...new Set(input.emailDomains.map((d) => d.trim().toLowerCase()))];
    if (emailDomains.length === 0) {
      throw new ValidationError('A university needs at least one email domain.');
    }
    const invalid = emailDomains.filter((d) => !DOMAIN_PATTERN.test(d));
    if (invalid.length > 0) {
      throw new ValidationError(`Invalid email domain: ${invalid.join(', ')}`);
    }

    return new University({
      id: input.id,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      emailDomains,
      schools: [...new Set(input.schools.map((s) => s.trim()).filter(Boolean))],
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

  /**
   * True if the address belongs to one of the university's domains or their subdomains,
   * e.g. `rishihood.edu.in` also admits `student@nst.rishihood.edu.in`.
   */
  allowsEmail(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@')[1];
    if (!domain) return false;
    return this.props.emailDomains.some(
      (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
    );
  }

  hasSchool(school: string): boolean {
    return this.props.schools.includes(school);
  }
}
