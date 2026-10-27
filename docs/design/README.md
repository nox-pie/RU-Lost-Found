# Design

The system design of RU Lost & Found, from requirements to storage. Every diagram is drawn from the code as it is (Mermaid, so GitHub shows it), with the names of the real classes and files.

| Document                               | What it covers                                                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [requirements.md](requirements.md)     | The problem, the actors, a use case diagram, 38 functional and 12 non-functional requirements (each traced to its module and tests, each NFR with its measured result), 7 use cases in full, what is out of scope |
| [class-diagrams.md](class-diagrams.md) | The domain model (every aggregate, value object, enumeration, relationship and multiplicity), the inheritance hierarchies, one module's layers, the interfaces and their implementations, events and jobs         |
| [interactions.md](interactions.md)     | Sequence diagrams for the core use cases, activity diagrams for the journeys and the request pipeline, state diagrams for claims, items, reports, sessions and events                                             |
| [database.md](database.md)             | How classes map to collections (embedded or referenced, and why), an entity relationship diagram, every index and the query it serves, consistency without foreign keys, retention, the Redis keys                |

**Where else to look**

| Topic                                                                      | Document                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Architecture, layers and module boundaries                                 | [backend.md §1 to §3](../architecture/backend.md#1-architectural-style)                                                   |
| Object-oriented design, SOLID and design patterns, each with where and why | [backend.md §12](../architecture/backend.md#12-design-principles-and-patterns-where-and-why)                              |
| API: every endpoint, request and response format, pagination               | [backend.md §10](../architecture/backend.md#10-api-design); live OpenAPI at `/api/v1/docs`                                |
| Error handling                                                             | [backend.md §11](../architecture/backend.md#11-error-handling), and [A3](interactions.md#a3-one-request-through-the-api)  |
| Security                                                                   | [backend.md §9](../architecture/backend.md#9-authentication-and-security)                                                 |
| Testing                                                                    | [backend.md §14](../architecture/backend.md#14-testing-strategy), [frontend.md §8](../architecture/frontend.md#8-testing) |
| Why each major decision was made                                           | [Architecture decision records](../adr/README.md)                                                                         |
