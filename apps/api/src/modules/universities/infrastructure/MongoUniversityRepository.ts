import type { Connection } from 'mongoose';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import {
  MongoRepository,
  modelFor,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import {
  fromObjectId,
  parseObjectId,
  toObjectId,
} from '../../../infrastructure/database/objectIds';
import { collectionOptions, defineSchema } from '../../../infrastructure/database/schemas';
import { ANY_EMAIL_DOMAIN, University, type UniversityStatus } from '../domain/University';
import type { UniversityRepository } from '../domain/UniversityRepository';

interface UniversityDocument extends VersionedDocument {
  name: string;
  slug: string;
  emailDomains: string[];
  schools: string[];
  status: UniversityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const universitySchema = defineSchema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    emailDomains: { type: [String], required: true },
    schools: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  collectionOptions('universities'),
);
universitySchema.index({ slug: 1 }, { unique: true, name: 'uniq_slug' });
universitySchema.index({ emailDomains: 1 }, { name: 'by_email_domain' });

/** "a.b.example.edu" → ["a.b.example.edu", "b.example.edu", "example.edu"] */
function candidateDomains(email: string): string[] {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  const labels = domain.split('.');
  const candidates: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    candidates.push(labels.slice(i).join('.'));
  }
  return candidates;
}

export class MongoUniversityRepository
  extends MongoRepository<University, UniversityDocument>
  implements UniversityRepository
{
  constructor(connection: Connection) {
    super(modelFor(connection, 'University', universitySchema));
  }

  findById(id: string, tx?: TransactionContext): Promise<University | null> {
    const _id = parseObjectId(id);
    return _id ? this.findOne({ _id }, tx) : Promise.resolve(null);
  }

  findBySlug(slug: string): Promise<University | null> {
    return this.findOne({ slug: slug.toLowerCase() });
  }

  /** A university that owns the address's domain wins over one that accepts any email. */
  async findByEmail(email: string): Promise<University | null> {
    const candidates = candidateDomains(email);
    if (candidates.length === 0) return null;
    const matches = await this.findMany({
      emailDomains: { $in: [...candidates, ANY_EMAIL_DOMAIN] },
      status: 'ACTIVE',
    });
    return matches.find((u) => u.ownsEmailDomain(email)) ?? matches[0] ?? null;
  }

  protected override duplicateKeyMessage(): string {
    return 'A university with this slug already exists.';
  }

  protected toEntity(doc: UniversityDocument): University {
    return University.restore({
      id: fromObjectId(doc._id),
      name: doc.name,
      slug: doc.slug,
      emailDomains: doc.emailDomains,
      schools: doc.schools,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: doc.version,
    });
  }

  protected toDocument(university: University): Omit<UniversityDocument, 'version'> {
    return {
      _id: toObjectId(university.id),
      name: university.name,
      slug: university.slug,
      emailDomains: [...university.emailDomains],
      schools: [...university.schools],
      status: university.status,
      createdAt: university.createdAt,
      updatedAt: university.updatedAt,
    };
  }
}
