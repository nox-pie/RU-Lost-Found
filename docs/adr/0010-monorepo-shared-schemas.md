# ADR 0010: A monorepo with a shared schema package

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The web app and the API must agree on every request and response: field names, which fields are required, the limits ("a title of 3 to 80 characters"), enums (categories, statuses), error codes. In the first version the frontend and backend each had their own idea, kept in sync by hand; validation existed only on the server, so users found out about mistakes after submitting.

## Decision

One repository with **npm workspaces**:

```
apps/api       Express API
apps/web       React app
packages/shared  Zod schemas, enums, DTO types, error codes, shared constants
```

- Request shapes are **Zod schemas** in `packages/shared` (e.g. `createItemSchema`, `loginSchema`). The API validates every body, query and param with them (unknown fields rejected); the web app's forms use the same schemas through `zodResolver`, so both sides apply the same rules.
- Types are **derived** from schemas (`z.infer`), so there's no second definition to drift.
- Response types (`ItemDto`, `ClaimDto` …), enums, error codes and shared rules (`FEED_TABS`, `DEMO_PERSONAS`, photo limits) live there too.
- The **OpenAPI** document is generated from the same schemas (`@asteasolutions/zod-to-openapi`), and a test checks that every documented route exists.
- The package is TypeScript source consumed directly (no build step), marked `"sideEffects": false` so the web bundle keeps only what a page uses.
- One `npm run check` (typecheck, lint, format, tests with coverage) and one CI pipeline cover everything.

## Alternatives considered

| Option                               | Why not                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Two repositories**                 | Every contract change is two pull requests and a version bump; the frontend can silently lag the API.                                    |
| **Hand-written types on each side**  | Drift, and no shared validation.                                                                                                         |
| **Generate the client from OpenAPI** | Valid for public APIs with other consumers; here the schemas already exist in TypeScript, so generating them back would be a round trip. |
| **GraphQL**                          | Typed contract out of the box, but a new server, a client cache and query cost concerns for a CRUD-plus-workflow API.                    |

## Consequences

**Good**

- A breaking contract change fails the build of both apps in the same commit.
- Forms show the server's exact rules before submitting; the server still validates everything.
- Documentation can't drift from validation.

**Bad / accepted**

- Workspace tooling (hoisted dependencies, Docker builds that copy the shared package) is a bit more complex.
- The shared package must stay free of server-only code (no Node APIs) because it ships to the browser.

## In the code

`packages/shared/src/`, root `package.json` (workspaces), `apps/api/src/core/http/middleware/validate.ts`, `apps/api/src/docs/openapi.ts`, [backend.md §3, §10](../architecture/backend.md#10-api-design).
