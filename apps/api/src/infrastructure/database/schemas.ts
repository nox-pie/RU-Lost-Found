import { Schema, type SchemaDefinition, type SchemaOptions } from 'mongoose';

/**
 * Creates a schema without Mongoose's automatic type inference. Document types are declared
 * explicitly next to each repository, and inference on large nested definitions makes the
 * TypeScript compiler extremely slow (it can run out of memory).
 */
export function defineSchema(definition: SchemaDefinition, options?: SchemaOptions): Schema {
  return new Schema(definition, options);
}

/** Options for embedded sub-documents: no separate `_id`, unknown fields rejected. */
export const subdocumentOptions: SchemaOptions = { _id: false, strict: 'throw' };

/** Sub-document shared by users (avatar) and items (photos). */
export const imageRefSchema = defineSchema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  subdocumentOptions,
);

/**
 * Options shared by every collection:
 * - timestamps are set by the domain (from the injected Clock), not by Mongoose;
 * - `version` is managed by MongoRepository for optimistic concurrency;
 * - unknown fields are rejected;
 * - indexes are built explicitly via ensureIndexes() at startup.
 */
export function collectionOptions(collection: string): SchemaOptions {
  return { collection, timestamps: false, versionKey: false, strict: 'throw', autoIndex: false };
}
