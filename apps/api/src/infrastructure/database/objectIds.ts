import { Types } from 'mongoose';
import type { IdGenerator } from '../../core/domain/IdGenerator';

/** Generates MongoDB ObjectIds as hex strings, so ids are sortable by creation time. */
export class ObjectIdGenerator implements IdGenerator {
  next(): string {
    return new Types.ObjectId().toHexString();
  }
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

/** Parses a client-supplied id; returns null instead of throwing for malformed input. */
export function parseObjectId(id: string): Types.ObjectId | null {
  return /^[0-9a-f]{24}$/i.test(id) ? new Types.ObjectId(id) : null;
}

export function fromObjectId(id: Types.ObjectId): string {
  return id.toHexString();
}
