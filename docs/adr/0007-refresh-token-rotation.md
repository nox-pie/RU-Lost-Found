# ADR 0007: Short-lived access tokens and rotating refresh tokens in an httpOnly cookie

- **Status:** Accepted (amended 3 October 2026, see "Grace window")
- **Date:** 1 October 2026 (the rebuild)

## Context

The first version issued one long-lived JWT and the web app kept it in `localStorage`: readable by any script injected into the page (XSS), and impossible to revoke before it expired. Students sign in on shared and personal phones; suspensions and password changes must take effect at once.

## Decision

Two tokens with different jobs:

|                      | Access token                                     | Refresh token                                                           |
| -------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| Form                 | JWT, HS256, 15 minutes                           | Random 256 bits, 7 days                                                 |
| Where                | Web app **memory** only; `Authorization: Bearer` | **httpOnly**, `Secure`, `SameSite=Lax` cookie, path `/api/v1/auth` only |
| Stored on the server | No (stateless)                                   | SHA-256 hash in `sessions` (TTL index removes expired ones)             |
| Revocable            | Expires within 15 minutes                        | Yes, immediately                                                        |

- **Rotation:** every refresh ends the current session and issues a new one in the same **family** (one sign-in on one device).
- **Theft detection:** if an already **rotated** token is presented again, someone copied it, so the whole family is ended and both parties must sign in again (and the event is audited). Tokens ended by sign-out, a password change or a suspension are simply refused.
- **Revocation:** sign-out ends the family atomically; a password change or suspension ends every session of the user. Admin routes also re-read the role from the database on each request.
- **CSRF:** the cookie is only sent to `/api/v1/auth`, is `SameSite=Lax`, and refresh/logout check the `Origin` header.
- Because Vercel rewrites `/api/*` to the API, the browser sees a single origin, so the cookie works without third-party-cookie problems.

## Grace window (amended)

A refresh whose response never reaches the browser (a page left mid-refresh, a dropped connection) leaves the browser holding a token the server has already rotated. Originally that looked like theft or a dead session and signed the person out. Now, **within 30 seconds of rotation and only while the family still has an active session**, the rotated token gets a new token in the same family. A signed-out family is never revived. Found through intermittent CI failures; see the fix commits of 3 October 2026.

## Alternatives considered

| Option                                                            | Why not                                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One long-lived JWT in `localStorage`** (the first version)      | Stealable by XSS, not revocable.                                                                                                                                          |
| **Server sessions only (opaque session cookie on every request)** | Simple and revocable, but every API request becomes a database or Redis lookup; the metered free Redis tier makes that costly. Short JWTs keep normal requests stateless. |
| **Refresh token in `localStorage`**                               | Same XSS exposure as the original.                                                                                                                                        |
| **OAuth / an identity provider (Auth0, Firebase Auth)**           | Outsources the problem but adds a dependency and cost, and the university-email sign-up rules (codes, allowed domains) would still be custom.                             |

## Consequences

**Good**

- A stolen access token is useful for 15 minutes at most; a replayed refresh token is detected.
- Sign-out, password changes and suspensions take effect immediately.

**Bad / accepted**

- More moving parts: rotation races between tabs needed the grace window and a retry-safe transaction ([ADR 0005](0005-mongodb-with-transactions.md)).
- A thief who replays within the 30-second window is not detected; signing out ends that token with the rest of the family.
- The web app must restore the session on every page load (one refresh call); a "signed in on this device" flag avoids that call for visitors who never signed in.

## In the code

`apps/api/src/modules/auth/SessionManager.ts`, `auth.controller.ts`, `apps/web/src/lib/api/client.ts`, `apps/web/src/lib/sessionHint.ts`, [backend.md §9](../architecture/backend.md#9-authentication-and-security).
