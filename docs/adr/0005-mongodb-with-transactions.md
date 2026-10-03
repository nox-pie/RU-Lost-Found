# ADR 0005: MongoDB with multi-document transactions

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The first version already stored its data in MongoDB Atlas (free tier). The rebuild needs atomic changes across documents: approving a claim changes the claim, the item and adds an outbox event; completing a handover resolves the item and rejects the other claims. It also needs concurrent requests (two people acting on the same claim) to fail cleanly instead of overwriting each other.

## Decision

Keep **MongoDB** (Atlas, a replica set, so transactions are available) and make consistency explicit:

1. **Unit of Work** (`UnitOfWork`, `MongoUnitOfWork`): a use case that changes several documents runs inside one transaction; repositories accept the transaction context.
2. **Optimistic concurrency**: every document carries a `version`; an update matches only the version that was loaded, otherwise `ConcurrencyError` (HTTP 409).
3. **Partial unique indexes** as the last line of defence: one active claim per person per item, one approved claim per item.
4. **Repositories** hide Mongoose from the domain ([ADR 0003](0003-rich-domain-model.md)); `TenantScope` is a required argument of every tenant-owned query ([ADR 0011](0011-branded-deployment-per-organisation.md)).
5. The transaction body is written to be **safe to re-run**: the driver retries it on transient write conflicts, so it re-reads what it changes rather than reusing objects from a failed attempt (a lesson from the refresh-token race, fixed in `SessionManager.rotate`).

## Alternatives considered

| Option                                                            | Why not                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**                                                    | A natural fit for relational data and constraints. Not chosen because the existing data and free hosting were already on Atlas, the documents are naturally nested (item photos, verification questions, claim history), and transactions plus partial unique indexes give the guarantees needed. The repository interfaces keep this decision reversible. |
| **MongoDB without transactions** (single-document atomicity only) | Approving a claim must change two documents and write an event together; without transactions a crash in between leaves them inconsistent.                                                                                                                                                                                                                 |
| **Pessimistic locking**                                           | Not native to MongoDB; optimistic versions suit a workload with rare conflicts.                                                                                                                                                                                                                                                                            |

## Consequences

**Good**

- Every use case is all-or-nothing; the outbox event exists if and only if the change does.
- Conflicting actions get a clear 409 instead of a lost update.
- Tests run against a real MongoDB replica set in memory (`mongodb-memory-server`), transactions included.

**Bad / accepted**

- Transactions need a replica set: locally a one-node replica set in Docker, in tests the in-memory one.
- No foreign keys: referential rules (a claim's item exists) live in services and indexes, not the database.
- Transient write conflicts make the driver re-run transaction bodies, which must therefore be idempotent.

## In the code

`apps/api/src/infrastructure/database/` (`MongoUnitOfWork`, `MongoRepository`), `modules/*/infrastructure/Mongo*Repository.ts`, [backend.md §6 Concurrency](../architecture/backend.md#6-claim-workflow-state-pattern).
