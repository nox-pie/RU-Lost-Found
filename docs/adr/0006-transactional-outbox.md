# ADR 0006: Transactional outbox instead of a message broker

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

Almost every action has side effects: a claim notifies the reporter by app and email, an approval sends the handover code, a removed item must close its claims, security-relevant actions go to the audit log. In the first version the email was sent **before** the database update inside the request, so a failure left the two out of sync (an email about a change that never happened, or a change nobody heard about), and a slow email provider slowed the request.

## Decision

Use the **transactional outbox** pattern, with MongoDB itself as the queue:

1. Aggregates record **domain events** as their methods run (`ClaimApproved`, `ItemRemoved` …).
2. When a repository saves an aggregate, the `MongoRepository` base class writes its pending events to `outbox_events` **in the same transaction** as the change. No service can forget to publish, and an event exists if and only if its change does.
3. A background **`OutboxProcessor`** claims events one at a time (atomic `findOneAndUpdate` with a 60-second lease, so several instances never take the same event), and dispatches them to the **handlers** registered for that type (`EventHandlerRegistry`, Observer pattern).
4. **At-least-once delivery:** per-handler progress is stored on the event, failures retry with exponential back-off (30 s, 1 min, 2 min, 4 min), and after 5 attempts the event is marked `FAILED` for inspection. Handlers are idempotent (e.g. a unique index on event id and recipient for notifications).
5. Delivered events are pruned after 7 days by a scheduled job.

## Alternatives considered

| Option                                               | Why not                                                                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Send emails and notifications inside the request** | The original bug: not atomic with the change, and the request waits for external services.                                                                                                         |
| **A message broker (RabbitMQ, Kafka, SQS)**          | Another service to host and pay for; and publishing to a broker after committing still needs an outbox to be atomic (the dual-write problem).                                                      |
| **Redis queue (BullMQ)**                             | Redis is already used, but writing to Redis and MongoDB is again two systems without a shared transaction; and the free Upstash tier meters every command, while polling a queue is command-heavy. |
| **MongoDB change streams**                           | Atomic by nature, but resuming reliably after a crash, per-handler retries and leases across instances would all have to be built anyway.                                                          |

## Consequences

**Good**

- Changes and their events are atomic; email outages delay notifications instead of breaking requests.
- Modules stay decoupled: the items module raises `ItemRemoved` and never imports the claims module.
- New reactions (push notifications, the planned matching) are new handlers; the code that raises the event doesn't change (Open/Closed).

**Bad / accepted**

- Notifications are eventually consistent: a few seconds after the action, not instantly (the e2e tests poll for them).
- Handlers must be idempotent because delivery is at-least-once.
- MongoDB doubles as a queue; fine at this volume (one event per user action), and replaceable by a broker relay later without touching the handlers.

## In the code

`apps/api/src/infrastructure/outbox/` (`MongoOutbox`, `OutboxProcessor`), `infrastructure/database/MongoRepository.ts`, `core/events/`, `modules/*/handlers/`, [backend.md §7](../architecture/backend.md#7-events-notifications-and-the-outbox).
