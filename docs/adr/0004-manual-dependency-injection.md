# ADR 0004: Manual dependency injection through one composition root

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

Services depend on external systems: MongoDB, Redis, Cloudinary, Brevo, Sentry, the clock. Each needs a production implementation and a lightweight one for development and tests (in-memory key-value store, captured emails, a fixed clock). The first version imported SDK clients directly inside route handlers, so nothing could be swapped and tests needed real services.

## Decision

- Every external dependency is an **interface owned by the core or the domain** (`KeyValueStore`, `StorageProvider`, `EmailSender`, `Clock`, `UserRepository` …); services receive implementations through their **constructors** (Dependency Inversion).
- **One composition root**, `apps/api/src/container.ts`, creates every concrete class and wires them, choosing implementations from the validated configuration:

  ```ts
  emailSender: env.BREVO_API_KEY
    ? new BrevoEmailSender(env.BREVO_API_KEY, from)
    : env.DEV_EMAIL_DIR ? new FileEmailSender(env.DEV_EMAIL_DIR) : new ConsoleEmailSender(logger),
  ```

- Tests build the same container with fakes only at the edges (`testing/testApp.ts`): a fixed clock, captured emails, in-memory storage, and a real MongoDB in memory.
- No DI container library.

## Alternatives considered

| Option                                                          | Why not                                                                                                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DI container (InversifyJS, tsyringe, NestJS)**                | Decorators and reflection metadata, wiring hidden in annotations, errors at runtime instead of compile time; worth it for large teams, not for one readable file of wiring. |
| **Module-level singletons** (`import { redis } from './redis'`) | Global state; tests have to mock modules; the dependency graph is invisible.                                                                                                |
| **Service locator**                                             | Dependencies are fetched at runtime from anywhere, so a class's needs aren't visible in its constructor.                                                                    |

## Consequences

**Good**

- Swapping a provider is a one-line change in one file (Redis → in-memory, Brevo → console, Cloudinary → local disk).
- The type checker verifies the whole graph: a missing dependency is a compile error.
- Decorators compose cleanly where they're wired: `SanitizingStorageProvider` wraps Cloudinary, `SkipUndeliverableEmailSender` wraps the email provider.

**Bad / accepted**

- `container.ts` is long (about 430 lines) and must be kept tidy by hand.
- Adding a dependency to a service means editing its constructor and the container; that is also what makes the change visible in review.

## In the code

`apps/api/src/container.ts`, `apps/api/src/testing/testApp.ts`, [backend.md §4](../architecture/backend.md#4-core-abstractions-dependency-inversion).
