# Frontend Architecture

Status: Built (Days 9–10) · Last updated: 1 October 2026

The web app is a React 18 single-page application (TypeScript, Vite, Tailwind CSS) organised **by feature**. It talks to the API only through one typed client, keeps server data in TanStack Query's cache, and validates forms with the **same Zod schemas the API uses** (from `packages/shared`), so the client and server can't disagree about what's valid.

---

## 1. Structure

```
apps/web/src/
├── main.tsx                 # Providers: TanStack Query → Router → Auth → App (+ toasts)
├── App.tsx                  # Routes; every page is lazy-loaded (code splitting)
├── brand/brand.config.ts    # Name, texts, image paths and colours of this deployment
├── lib/
│   ├── api/client.ts        # fetch wrapper: access token, refresh-and-retry, ApiError
│   ├── api/endpoints.ts     # one typed function per API endpoint
│   ├── queryClient.ts       # cache defaults + all query keys in one place
│   ├── forms.ts             # maps API field errors onto form inputs
│   └── format.ts            # labels, status colours, dates (en-IN)
├── components/
│   ├── ui/                  # Button, Input/Select/Textarea, Modal, Badge, Avatar, …
│   └── layout/              # Header (nav, notifications, account menu), AppLayout, footer
└── features/
    ├── auth/                # session provider, route guards, sign-in, 3-step sign-up and reset
    ├── items/               # browse/search, report dialog, item page, my items
    ├── claims/              # claim dialog, claim page (decision + handover), claims list
    ├── admin/               # overview, reports queue, people, activity log (admins only)
    ├── moderation/          # "Report this post" dialog
    ├── notifications/       # bell with unread badge
    └── profile/             # details, picture, sign out
```

**Branding:** no component names the organisation or hard-codes a colour. Texts and image paths come from `src/brand/brand.config.ts`; colours reach Tailwind as `primary`, `secondary` and `surface`; `index.html` gets its title, description, icon and theme colour from the same file through a small Vite plugin. Images live in `public/brand/`. See [../branding.md](../branding.md).

**Rule:** features depend on `lib` and `components`, never on each other's internals (the item page uses the claims feature's public `ClaimDialog` component only).

## 2. Session handling

| Concern       | Design                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token  | Kept **in memory only** (a module variable in `client.ts`), never in `localStorage`, so an injected script can't steal it from storage.                                           |
| Page reload   | On start-up `AuthProvider` calls `POST /auth/refresh`; the httpOnly cookie restores the session.                                                                                  |
| Expired token | Any 401 triggers **one** refresh and a retry. Concurrent requests share a single refresh call (the API rotates the refresh token on every use, so parallel refreshes would race). |
| Session ended | If the refresh fails, listeners are told; the app clears its cache and returns to sign-in, then back to the page the user wanted.                                                 |
| Cold start    | While the session is restored, a loader explains "Waking up the server…" after 2.5 s (free hosting tier).                                                                         |

The Vite dev server proxies `/api` to the API, exactly like the Vercel rewrite in production, so cookies behave the same in both.

## 3. Data layer (TanStack Query)

- **Server state lives in the cache, not in components.** Pages read with `useQuery` / `useInfiniteQuery` and change data with `useMutation`; after a change the affected keys are invalidated (`queryKeys` defines every key in one place).
- **Cursor pagination → "Load more".** `useInfiniteQuery` passes the API's `nextCursor` back as `cursor`.
- **Freshness without a reload:** notifications poll every 60 s and on window focus; a claim page polls every 15 s while a handover is pending, so each person sees the other's actions.
- **Retries** only for network errors, never for 4xx answers.

## 4. Forms

`react-hook-form` with `zodResolver(...)` and schemas imported from `@ru-lost-found/shared` (login, register, profile, password). Errors the server finds (e.g. "choose a school of your university") come back as `details` with paths like `body.school`; `showFormError` places them under the right input, anything else becomes a toast.

## 5. Screens

| Route                                   | Screen                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/signup`, `/forgot-password` | Sign-in; sign-up and reset as three steps: email → emailed code → details / new password                                                                            |
| `/`                                     | Browse: search (debounced), Lost / Found / Returned tabs, category filter; filters live in the URL so a view can be shared                                          |
| `/items/:id`                            | Photos, details; the reporter sees claims and can remove the report; others can claim                                                                               |
| `/my-items`                             | Everything the user reported                                                                                                                                        |
| `/claims`, `/claims/:id`                | Claims on my items / made by me; the claim page adapts to the viewer: reporter decides, owner sees the handover code, finder enters it, staff can confirm in person |
| `/profile`                              | Details (school list from the user's university), picture, sign out                                                                                                 |
| `/admin`                                | Admins only: overview (posts in play, returns, recovery rate, time to return, last 8 weeks, people and claims breakdowns)                                           |
| `/admin/reports`                        | Review queue: reports grouped by post; keep the post or remove it with a reason for the poster                                                                      |
| `/admin/users`                          | Search people; change roles and suspend / reactivate, offered only where the role rules allow it                                                                    |
| `/admin/activity`                       | The university's audit log in plain language, filterable by action                                                                                                  |

Every item page also has **Report this post** (reason + details); admins additionally see **Remove post**. The admin area is lazy-loaded, so students never download it, and its guard only shapes the UI: the API checks the stored role on every admin request.

## 6. Accessibility and UX

Labels tied to every input, errors announced (`role="alert"`, `aria-invalid`, `aria-describedby`), dialogs with `aria-modal`, Esc to close and focus restored afterwards, a skip-to-content link, keyboard-visible focus rings, `prefers-reduced-motion` respected, and a layout that works from 360 px phones to desktop. Toasts replace the old `alert()` pop-ups.

## 7. Testing

**End-to-end (Playwright)**, in a real browser against the real API and an in-memory database:

- `e2e/start-api.mjs` starts MongoDB, seeds the university and runs the API with its background worker; emails are written to files (a local mail catcher), so tests read sign-up codes like a person would.
- **Journey 1:** two students sign up → the finder reports a found item with a photo and a verification question → the owner searches, finds and claims it → the finder is notified, checks the answer and approves → the owner sees the code → the finder enters it → the item shows as returned.
- **Moderation journey:** a student reports a fake post → an admin (appointed with the real `set-role` script) removes it with a reason → the poster is notified and the post is gone → the admin suspends the poster, whose session ends → the activity log shows the decisions.
- **Journey 2** (desktop and a Pixel 7 phone): the session survives a reload, sign-out ends it, sign-in brings it back.

CI runs these on every push (`e2e` job).
