# ADR 0011: One branded deployment per organisation, on multi-tenant code

- **Status:** Accepted
- **Date:** 1 October 2026 (the rebuild)

## Context

The portal is built for Rishihood University, but nothing about lost and found is specific to one campus: other universities, schools or offices could use it. Two separate questions:

1. **Data:** can the code keep several organisations' data apart?
2. **Product:** should one site serve many organisations (a shared SaaS), or should each organisation get its own site with its own name, logo and colours?

## Decision

- **The code is multi-tenant.** A `University` is a tenant: its email domains decide who may sign up, and its school list fills the sign-up form. Every tenant-owned repository method takes a required `TenantScope` (built from the signed-in user's token), so a query without the university filter can't be written by accident.
- **Each organisation gets its own branded deployment.** This deployment serves Rishihood University only. A deployment's branding is configuration, not code:
  - web: `apps/web/src/brand/brand.config.ts` (names, texts, colours, image paths) and `public/brand/` (logos, app icons);
  - API: `BRAND_*` settings for emails and `apps/api/seed/universities.json` for the tenants.
- No component names the organisation or hard-codes a colour; the web app manifest (installable app) is generated from the brand file too.

## Alternatives considered

| Option                                         | Why not                                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single-tenant code** (no university concept) | Simpler today, but adding a second organisation later would mean touching every query, the riskiest kind of change for data isolation.                                                     |
| **One shared SaaS site for all organisations** | Needs per-tenant theming at runtime, tenant-aware sign-up and admin, billing; and each university would rather show its own name and domain. Not needed until there are several customers. |
| **Separate code forks per organisation**       | Every fix has to be copied to every fork.                                                                                                                                                  |

## Consequences

**Good**

- Tenant isolation is enforced by types (`TenantScope`) and covered by tests, not by remembering a filter.
- Re-branding is a configuration change: replace the brand file and images, set the API's `BRAND_*` values and seed (documented in `docs/branding.md`).
- Moving to a shared multi-tenant site later is possible: the data model already supports it.

**Bad / accepted**

- One deployment (and one set of free-tier services) per organisation.
- Brand colours must meet contrast rules (4.5:1 for white text on them and as text on light backgrounds); the accessibility e2e test catches a brand that doesn't.

## In the code

`apps/api/src/core/persistence/Repository.ts` (`TenantScope`), `modules/universities/`, `apps/web/src/brand/brand.config.ts`, [branding.md](../branding.md), [backend.md §5](../architecture/backend.md#5-domain-model).
