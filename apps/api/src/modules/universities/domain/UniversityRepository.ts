import type { Repository } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { University } from './University';

export interface UniversityRepository extends Repository<University> {
  findById(id: string, tx?: TransactionContext): Promise<University | null>;
  findBySlug(slug: string): Promise<University | null>;
  /** The active university whose email domains admit this address, if any. */
  findByEmail(email: string): Promise<University | null>;
}
