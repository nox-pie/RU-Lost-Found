# ADR 0002: TypeScript for the backend (and everything else)

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The first backend was plain JavaScript (`backend/server.js`, Mongoose models in `.js`). Shapes of requests, documents and responses existed only in people's heads; renaming a field meant searching strings and hoping. The rebuild adds a rich domain model, interfaces for every external system and a shared contract with the web app, all of which depend on types to be safe to change.

The course required a TypeScript backend as well.

## Decision

Write the API, the web app and the shared package in **TypeScript with `strict` mode**, compiled with `tsc` for type checking and `tsup` for the API build, run in development with `tsx`.

- `npm run check` runs `tsc --noEmit` in every workspace before lint and tests; CI fails on any type error.
- Interfaces describe the ports (`UserRepository`, `StorageProvider`, `EmailSender` …); classes implement them.
- Runtime validation is still needed at the edges (types vanish at runtime): Zod validates environment variables at startup and every request body, query and param ([ADR 0010](0010-monorepo-shared-schemas.md)).

## Alternatives considered

| Option                         | Why not                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JavaScript + JSDoc types**   | Weaker checking, verbose, easy to skip; interfaces and generics (repositories, `PageResult<T>`) are awkward.                                                        |
| **Java / Spring or C# / .NET** | Strong for this design style, but a second language next to a React frontend, heavier on the free tier (memory, cold starts), and no shared types with the web app. |
| **Go**                         | Small and fast, but a weaker fit for a rich domain model with inheritance-free polymorphism, and again no shared types with the frontend.                           |

## Consequences

**Good**

- Refactors are safe: renaming a DTO field breaks the build in both apps.
- Interfaces make Dependency Inversion visible ([ADR 0004](0004-manual-dependency-injection.md)): a service's constructor says exactly what it needs.
- One language from database mapping to React components.

**Bad / accepted**

- A build step and type-only gymnastics in places (e.g. mapping Mongoose documents to domain objects).
- Types don't validate input: the Zod schemas are the runtime truth, and `z.infer` keeps the types derived from them rather than written twice.

## In the code

`tsconfig*.json` in each workspace, `apps/api/src/config/env.ts`, `packages/shared/src/*`.
