# ADR 0012: Modules wire themselves, and domain events have typed contracts

- **Status:** Accepted
- **Date:** 20 October 2026 (Part 2, foundations)

## Context

ADR 0001 split the backend into modules and ADR 0004 wired them by hand in one composition root. By October 2026 that root (`container.ts`) was 480 lines that knew every class of every module, and `app.ts` changed for every new module. Modules talk through domain events (ADR 0006), but each event's payload was an untyped record: producers could send any shape, each handler kept its own schema for what it expected, and a misspelt event name in a handler's list compiled fine and simply never fired. The next modules (matching, the security desk team) all react to existing events, so these contracts were about to matter more.

## Decision

1. **Each module builds itself.** A module's `*.module.ts` creates its services, controllers, routes, event handlers and jobs from a shared **kernel** (settings, providers, repositories, middleware) and returns an `AppModule`. Services of other modules are explicit parameters. `container.ts` builds the kernel and lists the modules; `app.ts`, the outbox worker and the scheduler collect routes, handlers and jobs from that list.
2. **One catalogue of domain events** (`modules/events.ts`): every event type with a Zod schema for its payload. Producers use `domainEvent()` (checked by the compiler), handlers use `payloadOf()` (checked at run time, since stored events can come from an older version), and handler subscriptions are typed against the catalogue.
3. **Lint rules for the layers:** `core` depends on nothing app-specific, domain code on no framework or infrastructure, and modules on each other's interfaces, never their MongoDB code.

## Alternatives considered

| Option                                                | Why not                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep one large composition root**                   | Worked, but every module change touched a shared file, and the dependencies between modules were hidden among hundreds of constructor calls.            |
| **A DI container library (tsyringe, Inversify)**      | Rejected again for the reasons in ADR 0004: decorators, reflection and hidden wiring, for an object graph small enough to read.                         |
| **Typed events without run-time checks**              | Types alone trust whatever is in the outbox; an event written by an older version would reach a handler with the wrong shape and fail somewhere deeper. |
| **An architecture-test library (dependency-cruiser)** | Another tool and config format for three rules that ESLint's `no-restricted-imports` already expresses.                                                 |

## Consequences

**Good**

- A new module is a folder plus one line in the module list; its wiring sits next to its code.
- Cross-module dependencies are explicit parameters, visible in `container.ts`.
- Event contracts are written once; a producer that changes a payload breaks the build, not a handler in production.
- The layering described in ADR 0003 is enforced instead of hoped for.

**Bad / accepted**

- The kernel is shared by every module: it must stay small (no business services in it).
- Events that change shape need a schema that still reads older stored events (optional fields or defaults).

## In the code

`apps/api/src/modules/kernel.ts`, `modules/*/**.module.ts`, `core/modules/AppModule.ts`, `modules/events.ts`, `container.ts`, `app.ts`, `apps/api/eslint.config.js`, [backend.md §3](../architecture/backend.md#3-repository-and-folder-structure) and [§7](../architecture/backend.md#7-events-notifications-and-the-outbox).
