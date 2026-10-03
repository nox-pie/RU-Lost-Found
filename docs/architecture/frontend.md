# Frontend Architecture

Status: Built and live · Last updated: 3 October 2026

The web app is a React 18 single-page application (TypeScript, Vite, Tailwind CSS) organised **by feature**. It talks to the API only through one typed client, keeps server data in TanStack Query's cache, and validates forms with the **same Zod schemas the API uses** (from `packages/shared`), so the client and server can't disagree about what's valid.

---

## 1. Structure

```
apps/web/src/
├── main.tsx                 # ErrorBoundary → TanStack Query → Router → Auth → App (+ toasts, wake-up notice)
├── App.tsx                  # Routes; every page is lazy-loaded (code splitting)
├── brand/brand.config.ts    # Name, texts, image paths and colours of this deployment
├── lib/
│   ├── api/client.ts        # fetch wrapper: access token, refresh-and-retry, ApiError
│   ├── api/endpoints.ts     # one typed function per API endpoint
│   ├── queryClient.ts       # cache defaults + all query keys in one place
│   ├── forms.ts             # maps API field errors onto form inputs
│   ├── format.ts            # labels, status colours, dates (en-IN)
│   ├── hooks.ts             # useDebouncedValue (search as you type)
│   ├── sessionHint.ts       # "signed in on this device" flag, so visitors aren't kept waiting
│   └── monitoring.ts        # Sentry, loaded lazily and only when configured
├── components/
│   ├── ui/                  # Button, Field (Input/Select/Textarea/Checkbox), Modal, ConfirmDialog, Spinner,
│   │                        #   misc (Badge, Avatar, EmptyState, ErrorState, PageLoader)
│   ├── layout/              # Header (nav, notifications, account menu), AppLayout, Footer
│   ├── ErrorBoundary.tsx    # a crash shows a way out instead of a blank page, and is reported
│   └── ServerWakeNotice.tsx # "Waking up the server…" while the API starts
└── features/
    ├── landing/             # public landing page for signed-out visitors
    ├── demo/                # one-click sign-in as a sample student, demo banner and limits
    ├── auth/                # session provider, route guards, sign-in, 3-step sign-up and reset
    ├── items/               # browse/search, report dialog, item page, my items
    ├── claims/              # claim dialog, claim page (decision + handover), claims list
    ├── admin/               # overview, reports queue, people, activity log (admins only)
    ├── moderation/          # "Report this post" dialog
    ├── notifications/       # bell with unread badge
    └── profile/             # details, picture, sign out
```

**Branding:** no component names the organisation or hard-codes a colour. Texts and image paths come from `src/brand/brand.config.ts`; colours reach Tailwind as `primary`, `secondary` and `surface`; `index.html` gets its title, description, icon and theme colour from the same file through a small Vite plugin. Images live in `public/brand/`. See [../branding.md](../branding.md).

**Rule:** features depend on `lib` and `components`, and use only other features' public pieces, never their internals: the item page uses `ClaimDialog` (claims) and `FlagItemDialog` (moderation), and pages read the signed-in user through the auth context.

## 2. Session handling

| Concern       | Design                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token  | Kept **in memory only** (a module variable in `client.ts`), never in `localStorage`, so an injected script can't steal it from storage.                                                                                                                                                                                                                                                                                    |
| Page reload   | On start-up `AuthProvider` calls `POST /auth/refresh`; the httpOnly cookie restores the session. It does so only if this device has signed in before (a `localStorage` flag holding no secret): a first-time visitor sees the landing page at once instead of waiting for a possibly sleeping API to say "not signed in".                                                                                                  |
| Expired token | Any 401 triggers **one** refresh and a retry. Concurrent requests share a single refresh call (the API rotates the refresh token on every use, so parallel refreshes would race).                                                                                                                                                                                                                                          |
| Session ended | If the refresh fails, listeners are told; the app clears its cache and returns to sign-in, then back to the page the user wanted.                                                                                                                                                                                                                                                                                          |
| Cold start    | The free API instance sleeps after 15 quiet minutes, and the hosting layer answers 502/503/504 (HTML, not our JSON) while it starts. The app pings the API as soon as it opens, waits for its health check (up to 90 s) with a "Waking up the server…" notice, retries reads and the session restore by itself, and asks the person to resend a form instead of resending it automatically (it might have been processed). |

The Vite dev server proxies `/api` to the API, exactly like the Vercel rewrite in production, so cookies behave the same in both.

## 3. Data layer (TanStack Query)

- **Server state lives in the cache, not in components.** Pages read with `useQuery` / `useInfiniteQuery` and change data with `useMutation`; after a change the affected keys are invalidated (`queryKeys` defines every key in one place).
- **Cursor pagination → "Load more".** `useInfiniteQuery` passes the API's `nextCursor` back as `cursor`. Cursors stay fast and stable while new posts arrive, but can't say how many there are, so a separate cheap query (`GET /items/counts`, one aggregation) gives each tab its count and the "Showing 12 of 17" line. Both use `FEED_TABS` from `packages/shared`, so counts and lists can't disagree.
- **Skeletons, not spinners,** while the first page of posts loads: grey cards shaped like the real ones.
- **Freshness without a reload:** notifications poll every 60 s and on window focus; a claim page polls every 15 s while a handover is pending, so each person sees the other's actions.
- **Retries** (up to 2) for network and server errors, never for 4xx answers. A sleeping API (502/503/504 from the hosting layer) is handled in the API client itself (see Cold start).

## 4. Forms

`react-hook-form` with `zodResolver(...)` and schemas imported from `@ru-lost-found/shared` (login, register, profile, password). Errors the server finds (e.g. "choose a school of your university") come back as `details` with paths like `body.school`; `showFormError` places them under the right input, anything else becomes a toast.

## 5. Screens

| Route                                   | Screen                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/login`, `/signup`, `/forgot-password` | Sign-in; sign-up and reset as three steps: email → emailed code → details / new password                                                                                                   |
| `/` (signed out)                        | Landing page: what the portal does, the three steps, a preview of sample posts, one-click demo sign-in (when the API runs with `DEMO_MODE`), sign-up                                       |
| `/`                                     | Browse: search (debounced), All / Lost / Found / Returned tabs, category filter; filters live in the URL so a view can be shared                                                           |
| `/items/:id`                            | Photos, details; the reporter sees claims and can remove the report; others can claim                                                                                                      |
| `/my-items`                             | Everything the user reported                                                                                                                                                               |
| `/claims`, `/claims/:id`                | Claims on my items / made by me; the claim page adapts to the viewer: reporter decides, owner sees the handover code, finder enters it, staff can confirm in person                        |
| `/profile`                              | Details (school list from the user's university), picture, sign out                                                                                                                        |
| `/admin`                                | Admins only: overview (posts in play, returns, recovery rate, time to return, last 8 weeks, people and claims breakdowns)                                                                  |
| `/admin/reports`                        | Review queue: reports grouped by post; keep the post or remove it with a reason for the poster                                                                                             |
| `/admin/users`                          | Search people; change roles and suspend / reactivate, offered only where the role rules allow it                                                                                           |
| `/admin/posts`                          | Every post (any status, removed included) with search and filters; remove any post with a reason for the poster                                                                            |
| `/admin/activity`                       | The university's audit log in plain language: filter by action, by day range (the viewer's local days) and by person (click a name, or "View activity" in People); filters live in the URL |

Every item page also has **Report this post** (reason + details); admins additionally see **Remove post** (with a reason), also on their own posts once handed over. The admin area is lazy-loaded, so students never download it, and its guard only shapes the UI: the API checks the stored role on every admin request.

## 6. Accessibility and UX

Labels tied to every input, errors announced (`role="alert"`, `aria-invalid`, `aria-describedby`), dialogs with `aria-modal`, Esc to close and focus restored afterwards, a skip-to-content link, keyboard-visible focus rings, `prefers-reduced-motion` respected, and a layout that works from 360 px phones to desktop. Toasts replace the old `alert()` pop-ups.

## 7. Testing

**End-to-end (Playwright)**, in a real browser against the real API and an in-memory database:

- `e2e/start-api.mjs` starts MongoDB, seeds the university and runs the API with its background worker; emails are written to files (a local mail catcher), so tests read sign-up codes like a person would.
- **Journey 1:** two students sign up → the finder reports a found item with a photo and a verification question → the owner searches, finds and claims it → the finder is notified, checks the answer and approves → the owner sees the code → the finder enters it → the item shows as returned.
- **Moderation journey:** a student reports a fake post → an admin (appointed with the real `set-role` script) removes it with a reason → the poster is notified and the post is gone → the admin suspends the poster, whose session ends → the activity log shows the decisions.
- **Journey 2** (desktop and a Pixel 7 phone): a visitor signs up with a Gmail address, the session survives a reload, sign-out returns to the landing page, sign-in brings the session back.
- **Demo:** from the landing page a visitor signs in as Ravi with one click and claims the sample wallet, signs out, signs in as Asha and approves the claim; on a phone, a demo account sees that its profile can't be changed and is offered sign-up.
- **Admin tools:** an admin removes a post from the Posts tab with a reason, then narrows the activity log to a day and to one person.
- **Resilience:** with the hosting layer faked to answer 502, pages load by themselves once the server wakes up, and a form sent to a sleeping server explains the wait and is not sent twice.

CI runs these on every push (`e2e` job).
