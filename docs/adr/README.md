# Architecture Decision Records

Each record explains one significant decision: the situation, what was decided, the alternatives that were considered and why they lost, and the consequences we accepted. They are short on purpose; the architecture documents ([backend](../architecture/backend.md), [frontend](../architecture/frontend.md)) describe the result in full.

| #                                                   | Decision                                                           | In one line                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [0001](0001-modular-monolith.md)                    | Modular monolith, not microservices                                | One deployable app with strict module boundaries; extractable later, cheap now |
| [0002](0002-typescript.md)                          | TypeScript for the backend (and everything else)                   | Strict types end to end, Zod at the runtime edges                              |
| [0003](0003-rich-domain-model.md)                   | Layered architecture with a rich domain model                      | Business rules live in entities that refuse illegal changes                    |
| [0004](0004-manual-dependency-injection.md)         | Manual dependency injection through one composition root           | Interfaces everywhere, wired by hand in `container.ts`, no DI library          |
| [0005](0005-mongodb-with-transactions.md)           | MongoDB with multi-document transactions                           | Unit of Work, optimistic versions and partial unique indexes                   |
| [0006](0006-transactional-outbox.md)                | Transactional outbox instead of a message broker                   | Events saved with the change, delivered at least once by a worker              |
| [0007](0007-refresh-token-rotation.md)              | Short access tokens, rotating refresh tokens in an httpOnly cookie | Revocable sessions with theft detection and a grace window                     |
| [0008](0008-cursor-pagination.md)                   | Cursor-based pagination                                            | Stable, constant-time pages; totals as a separate query                        |
| [0009](0009-claim-state-machine.md)                 | The claim lifecycle as a state machine                             | State pattern: illegal transitions fail in one place                           |
| [0010](0010-monorepo-shared-schemas.md)             | A monorepo with a shared schema package                            | One Zod contract for API validation, forms and OpenAPI                         |
| [0011](0011-branded-deployment-per-organisation.md) | One branded deployment per organisation                            | Multi-tenant code (`TenantScope`), branding as configuration                   |

**Format:** Status and date, Context, Decision, Alternatives considered, Consequences (good and accepted), In the code. A decision that changes later gets a new record that supersedes the old one (or, for a small change, an "amended" note, as in 0007), so the history stays readable.
