# ADR 0001: Modular monolith, not microservices

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The first version (`backend/`, April 2026) was a single Express app in plain MVC style: controllers mixed HTTP handling, business rules, database access and email sending. It was hard to test and every change touched several concerns at once.

The rebuild had to fix that structure. Constraints:

- one developer, a university-sized user base (thousands of students, peaks of tens of requests per second);
- free hosting: one small Render instance, one MongoDB cluster, one Redis;
- features that cut across each other (a removed item must close its claims, every claim step notifies someone).

## Decision

Build **one deployable application split into modules with strict boundaries**: `auth`, `users`, `universities`, `items`, `claims`, `moderation`, `notifications`, `admin`, `audit`, `health` (`apps/api/src/modules/`).

- Each business module has the same layers: routes → controller → service → repository (interface) → domain; dependencies point inwards only.
- Modules talk through **services** (synchronous use cases) or **domain events** delivered by the outbox (asynchronous reactions, see [ADR 0006](0006-transactional-outbox.md)). For example `items` never calls `claims`: `CloseClaimsOnItemRemoved` in the claims module reacts to `ItemRemoved`.
- Shared building blocks (errors, persistence ports, events, HTTP helpers) live in `core/`; adapters for external systems in `infrastructure/`.

## Alternatives considered

| Option                                                                      | Why not                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Microservices** (auth, items, claims, notifications as separate services) | Network calls and failures between services, distributed transactions (approving a claim changes the claim and the item), several deployments, a broker and service discovery: real cost, and no benefit at this scale with one developer and one free server. |
| **Keep plain MVC**                                                          | The problem we were fixing: no place for business rules, untestable without a database and an email provider.                                                                                                                                                  |
| **Layered but not modular** (one global `services/`, `models/`)             | Layers alone don't stop the claims code from reaching into item internals; modules give each capability an owner and a boundary.                                                                                                                               |

## Consequences

**Good**

- One process, one deploy, one database transaction per use case: simple to run on the free tier and simple to reason about.
- Boundaries are explicit, so a module can be extracted into its own service later: its events already cross the boundary through the outbox, and its repository interfaces already hide the database.
- Tests run the real application in-process (`testing/testApp.ts`): 378 API tests in about 25 seconds.

**Bad / accepted**

- The boundaries are enforced by convention and review, not by the runtime: nothing technically stops one module importing another's internals. (A lint rule for import boundaries would be the next step.)
- Everything scales together: the background worker shares the API's CPU on the free tier. It can already run as a separate process (`npm run start:worker`, `WORKER_ENABLED=false` on the API).

## In the code

`apps/api/src/modules/*`, `apps/api/src/container.ts` (composition root), [backend.md §1, §3](../architecture/backend.md#1-architectural-style).
