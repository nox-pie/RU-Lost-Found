# ADR 0003: Layered architecture with a rich domain model

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The rules of this product are its value: who may claim what, when a claim can be approved, who sees whose contact details, what happens to an item when a handover completes. In the first version these rules were `if` statements inside Express controllers, next to database calls, so they could only be tested through HTTP with a real database, and the same rule was sometimes written twice.

## Decision

Put business rules in **domain entities** that hold their own state and refuse illegal changes, and keep the other layers thin:

```
Route → Controller → Service → Repository (interface) → Mongoose
                        ↓
                  Domain entity (no Express, Mongoose or SDK imports)
```

- **Entities** (`Item`, `Claim`, `User`, `ModerationReport`, `University`) expose behaviour, not setters: `claim.approve(by, handover, now)`, `item.reserve(now)`, `user.suspend(reason, by, now)`. Each method checks its invariants and throws a domain error (`InvalidStateTransitionError`, `ForbiddenError` …) when an action isn't allowed.
- Entities are **aggregates** (`AggregateRoot`): they record domain events (`ClaimApproved`, `ItemRemoved` …) while their methods run; the repository saves them with the change ([ADR 0006](0006-transactional-outbox.md)).
- **Services** orchestrate a use case: load, call domain methods, save inside a unit of work. They never contain the rule itself.
- **Time and ids are injected** (`now` parameters, `Clock`, `IdGenerator`), so entities are deterministic in tests.

## Alternatives considered

| Option                                                                    | Why not                                                                                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Anemic model + transaction scripts** (plain objects, rules in services) | Simpler at first, but rules spread across services and the same check (e.g. "only the reporter decides") is easy to forget in one path. |
| **Rules in Mongoose models** (schema methods, middleware hooks)           | Ties business rules to the database library; hooks run implicitly and are hard to test without MongoDB.                                 |
| **Full DDD with separate read/write models (CQRS) everywhere**            | More machinery than the domain needs; used only where it pays off: the admin statistics are a separate read model (`StatsReader`).      |

## Consequences

**Good**

- Rules are unit-testable without a database or HTTP (`Claim.test.ts`, `Item.test.ts`, `User.test.ts`).
- One place per rule: e.g. demo accounts can't change their profile is enforced once in `User.assertEditable()`, whatever path calls it.
- Controllers and repositories stay boring, which is what you want from them.

**Bad / accepted**

- Mapping code between documents and entities in every repository (`toEntity`, `toDocument`).
- More files per feature than a script-style codebase; new contributors need the layer rules explained (they are, in `backend.md`).

## In the code

`apps/api/src/modules/*/domain/`, `apps/api/src/core/domain/AggregateRoot.ts`, [backend.md §1, §5](../architecture/backend.md#5-domain-model).
