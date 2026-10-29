# Frontend Architecture

Status: Built and live · Last updated: 29 October 2026

The web app is a React 19 single-page application (TypeScript, Vite, Tailwind CSS 4) organised **by feature**. It talks to the API only through one typed client, keeps server data in TanStack Query's cache, and validates forms with the **same Zod schemas the API uses** (from `packages/shared`), so the client and server can't disagree about what's valid.

---

## 1. Structure

```text
apps/web/src/
├── main.tsx                 # ErrorBoundary → TanStack Query → Router → Auth → App (+ toasts, wake-up notice)
├── App.tsx                  # Routes; every page is lazy-loaded (code splitting)
├── brand/brand.config.ts    # Name, texts, image paths and colours of this deployment
├── lib/
│   ├── api/client.ts        # fetch wrapper: access token, refresh-and-retry, ApiError
│   ├── api/endpoints.ts     # one typed function per API endpoint
│   ├── queryClient.ts       # cache defaults + all query keys in one place
│   ├── forms.ts             # maps API field errors onto form inputs
│   ├── categories.ts        # an icon for each item category, and the category dropdown options
│   ├── format.ts            # labels, status colours, dates (en-IN)
│   ├── hooks.ts             # useDebouncedValue (search as you type)
│   ├── images.ts            # shrinks photos on the device before upload (posts: 2000 px, profile pictures: 512 px)
│   ├── sessionHint.ts       # "signed in on this device" flag, so visitors aren't kept waiting
│   ├── monitoring.ts        # Sentry, loaded lazily and only when configured
│   └── sentry.ts            # the two Sentry functions used (init, captureException), so the build leaves the rest out
├── components/
│   ├── ui/                  # Button, Field (Input/Textarea/Checkbox), Dropdown (themed, Headless UI), Modal, ConfirmDialog, Spinner,
│   │                        #   misc (Badge, Avatar, EmptyState, ErrorState, PageLoader)
│   ├── layout/              # Header (nav, notifications, account menu), BottomNav (phones), AppLayout, Footer
│   ├── ErrorBoundary.tsx    # a crash shows a way out instead of a blank page, and is reported
│   └── ServerWakeNotice.tsx # "Waking up the server…" while the API starts
└── features/
    ├── landing/             # public landing page for signed-out visitors
    ├── demo/                # one-click sign-in as a sample student, demo banner and limits
    ├── auth/                # session provider, route guards, sign-in, 3-step sign-up and reset
    ├── items/               # browse/search, report and edit dialogs (campus places), item page (matches, closing), my items
    ├── claims/              # claim dialog, claim page (decision + handover), claims list
    ├── desk/                # security desk console: handovers waiting, claims to decide, items held (desk staff and admins)
    ├── admin/               # overview (with the posts download), reports queue, people, posts, activity log (admins only)
    ├── moderation/          # "Report this post" dialog
    ├── notifications/       # bell with unread badge
    ├── legal/               # privacy policy and terms of use (public)
    └── profile/             # details, picture, password, download my data, delete account, sign out
```

**Branding:** no component names the organisation or hard-codes a colour. Texts and image paths come from `src/brand/brand.config.ts`; colours reach Tailwind as `primary`, `secondary` and `surface` through `tailwind.config.ts`, which `src/index.css` loads with Tailwind 4's `@config` (so the theme keeps one source, the brand file); `index.html` gets its title, description, icon and theme colour from the same file through a small Vite plugin. Images live in `public/brand/`. See [../branding.md](../branding.md).

**Rule:** features depend on `lib` and `components`, and use only other features' public pieces, never their internals: the item page uses `ClaimDialog` (claims) and `FlagItemDialog` (moderation), and pages read the signed-in user through the auth context.

## 2. Session handling

| Concern       | Design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token  | Kept **in memory only** (a module variable in `client.ts`), never in `localStorage`, so an injected script can't steal it from storage.                                                                                                                                                                                                                                                                                                                                                                                   |
| Page reload   | On start-up `AuthProvider` calls `POST /auth/refresh`; the httpOnly cookie restores the session. It does so only if this device has signed in before (a `localStorage` flag holding no secret): a first-time visitor sees the landing page at once instead of waiting for a possibly sleeping API to say "not signed in". Only an answer from the API refusing the session (401) signs the device out; a refresh that gets no answer (offline, the page left mid-request, a server error) keeps the session and the flag. |
| Expired token | Any 401 triggers **one** refresh and a retry (except on `/auth/` endpoints, where a 401 means wrong credentials; changing the password is the one `/auth/` call that renews the token too). Concurrent requests share a single refresh call (the API rotates the refresh token on every use, so parallel refreshes would race).                                                                                                                                                                                           |
| Session ended | If the refresh fails, listeners are told; the app clears its cache and returns to sign-in, then back to the page the user wanted.                                                                                                                                                                                                                                                                                                                                                                                         |
| Cold start    | The free API instance restarts after each deploy, and would sleep after 15 quiet minutes if UptimeRobot didn't keep it awake; while it starts, the hosting layer answers 502/503/504 (HTML, not our JSON). The app pings the API as soon as it opens, waits for its health check (up to 90 s) with a "Waking up the server…" notice, retries reads and the session restore by itself, and asks the person to resend a form instead of resending it automatically (it might have been processed).                          |

The Vite dev server proxies `/api` to the API, exactly like the Vercel rewrite in production, so cookies behave the same in both.

## 3. Data layer (TanStack Query)

- **Server state lives in the cache, not in components.** Pages read with `useQuery` / `useInfiniteQuery` and change data with `useMutation`; after a change the affected keys are invalidated (`queryKeys` defines every key in one place).
- **Cursor pagination → "Load more".** `useInfiniteQuery` passes the API's `nextCursor` back as `cursor`. Cursors stay fast and stable while new posts arrive, but can't say how many there are, so a separate cheap query (`GET /items/counts`, one aggregation) gives each tab its count and the "Showing 12 of 17" line. Both use `FEED_TABS` from `packages/shared`, so counts and lists can't disagree.
- **Skeletons, not spinners,** while the first page of posts loads: grey cards shaped like the real ones.
- **Lists stay while a search updates** on the admin People and Posts tabs (`keepPreviousData`, dimmed meanwhile): replacing the list with a spinner would also close a dialog a row has open, such as Suspend or Remove.
- **Freshness without a reload:** notifications poll every 60 s and on window focus; a claim page polls every 15 s while a handover is pending, so each person sees the other's actions; the desk console's lists refetch whenever shown and every 30 s, since the desk keeps the page open all day.
- **Retries** (up to 2) for network and server errors, never for 4xx answers. A sleeping API (502/503/504 from the hosting layer) is handled in the API client itself (see Cold start).

## 4. Forms

`react-hook-form` with `zodResolver(...)` and schemas imported from `@ru-lost-found/shared` (login, register, profile, password). Errors the server finds (e.g. "choose a school of your university") come back as `details` with paths like `body.school`; `showFormError` places them under the right input, anything else becomes a toast.

## 5. Screens

| Route                                   | Screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/signup`, `/forgot-password` | Sign-in; sign-up and reset as three steps: email → emailed code → details / new password                                                                                                                                                                                                                                                                                                                                                                                         |
| `/` (signed out)                        | Landing page: a bar that is transparent over a full-height campus photo and frosted once it scrolls away (section links, the current one underlined); a carousel of sample posts; a five-step story of one handover played in a small app window built from the app's own components (typing, presses, codes); a dark "try it now" band with the two demo students; safeguards; a closing card on the campus photo with a slow zoom                                              |
| `/`                                     | Browse: search (debounced), All / Lost / Found / Returned tabs, category and campus place filters, and "When" (any time, today, the last 7 or 30 days, or chosen dates, by the day the item was lost or found); filters live in the URL so a view can be shared, and an empty result offers "Clear filters"                                                                                                                                                                      |
| `/items/:id`                            | Photos, details; the reporter sees possible matches (posts on the other side that may be the same item, strong or possible) and claims, can edit the post while it is open (only the changed fields are sent; photos and questions stay), close it ("I got it back" or "no longer needed", worded for lost or found posts), keep it open in its last week, open it again once closed, and remove it; others can claim                                                            |
| `/my-items`                             | Everything the user reported                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/claims`, `/claims/:id`                | Claims on my items / made by me; the claim page adapts to the viewer: reporter decides, owner sees the handover code, finder enters it, staff can confirm in person                                                                                                                                                                                                                                                                                                              |
| `/profile`                              | Details (school list from the user's university), picture; change password (this device stays signed in); download my data (one JSON file); delete account (asks for the password, then signs out); sign out                                                                                                                                                                                                                                                                     |
| `/desk`                                 | Desk staff and admins: approved claims waiting for their handover (locked codes marked), claims to decide on items held at the desk (the desk works as a team), and found items held at the desk (search); each row opens the claim or post, where staff confirm a handover in person                                                                                                                                                                                            |
| `/privacy`, `/terms`                    | Privacy policy and terms of use, open to everyone; linked from the footer and the sign-up form                                                                                                                                                                                                                                                                                                                                                                                   |
| `/admin`                                | Admins only. Every admin section shares one header ("Admin" label, section title, what it is for) and a bar of sections with icons. Overview: a "needs a decision" card only when reported posts are waiting; posts in play, returned (with the recovery rate as a bar), average time to return, claims in progress; last 8 weeks; people and claims breakdowns; lost, found and returned posts by category and by campus place; "Download posts" saves a CSV report of a period |
| `/admin/reports`                        | Review queue: reports grouped by post; keep the post or remove it with a reason for the poster                                                                                                                                                                                                                                                                                                                                                                                   |
| `/admin/users`                          | Search people; change roles and suspend / reactivate, offered only where the role rules allow it                                                                                                                                                                                                                                                                                                                                                                                 |
| `/admin/posts`                          | Every post (any status, removed included) with search and filters; remove any post with a reason for the poster                                                                                                                                                                                                                                                                                                                                                                  |
| `/admin/activity`                       | The university's audit log in plain language: filter by action, by day range (the viewer's local days) and by person (click a name, or "View activity" in People); filters live in the URL                                                                                                                                                                                                                                                                                       |

Every item page also has **Report this post** (reason + details); admins additionally see **Remove post** (with a reason), also on their own posts once handed over. The admin area is lazy-loaded, so students never download it, and its guard only shapes the UI: the API checks the stored role on every admin request.

## 6. Installable app

The site can be installed on a phone or computer like an app. `/manifest.webmanifest` is generated from the brand file (name, short name, colours, icons) by a small Vite plugin. `public/sw.js`, a deliberately small service worker registered only in production builds, keeps the build's hashed files (`/assets/...`) for faster repeat visits and shows `offline.html` when a page is opened without a connection. It never handles `/api/...` and never serves a cached page, so a new deploy is always picked up; Vercel serves `sw.js` with `Cache-Control: no-cache`.

## 7. Accessibility and UX

Labels tied to every input, errors announced (`role="alert"`, `aria-invalid`, `aria-describedby`), dialogs with `aria-modal`, Esc to close and focus restored afterwards, a skip-to-content link, keyboard-visible focus rings, `prefers-reduced-motion` respected, and a layout that works from 360 px phones to desktop. Messages appear as toasts, never as browser pop-ups.

**Checked automatically:** the e2e suite runs [axe-core](https://github.com/dequelabs/axe-core) (WCAG 2.1 A and AA rules) on the landing, sign-in, browse, item (also scrolled, when the header turns translucent), claims, claim and profile pages on a desktop and a phone, with unread notifications open, on a post held at the security desk, for someone without a profile picture (the header shows their initials) and with a date-range error, and on the five admin sections; CI fails on any violation. The first run found only colour contrast problems, fixed at the source: the brand red was darkened slightly (`#C62835`) so white text on it and red text on light backgrounds reach 4.5:1, the Found tags use orange `#FFA500` with dark brown text (7.8:1; white on it would be 2.0:1) (each brand colour names its text colour, `contrast`), the two lightest text greys were darkened one step in the Tailwind theme, the footer and translucent header got stronger text, and avatar initials got an opaque base. A full audit on 29 October 2026 (every page, every role, phone to desktop) found a few more, fixed the same way: the toast colours (the library's greens, blues, reds and oranges are a shade darker), form errors on the page background, unread notification times and the green "handed in at the security desk" note; and the account button now names the person and their initials, so what is seen is also what is heard.

**Lighthouse** (landing page on the live site, simulated mid-range phone on slow 4G, 24 October 2026 on React 19, median of three runs): Performance 94, Accessibility 100, Best practices 100, SEO 100 (22 October on React 18: also 94; 3 October, before Tailwind 4: 89). React 19 makes the first download about 20 KB bigger, which costs about 2 points when the same build is compared locally. What it took: fonts self-hosted (no render-blocking stylesheet); the signed-in layout, the forms' libraries (zod, react-hook-form) and the story (built from real form and dropdown components) kept out of the first download (about 120 KB of compressed JavaScript, 105 KB on React 18; the story's code, about 40 KB, loads separately; `packages/shared` is marked side-effect free, and the demo personas sit in a zod-free module); the campus photo in three WebP sizes and the first carousel photo preloaded from `index.html`; Sentry loaded only once the page is idle, and only the parts it uses (90 KB instead of 450 KB, 31 KB compressed instead of 150 KB; a CI check keeps the unused session replay out); the sign-in background as a JPEG.

**Motion budget (landing page):** sections fade up once as they appear; the carousel; the story; a slow zoom on the closing card's photo. Nothing else moves (no parallax). Everything runs only while on screen, has a pause button where it repeats, and is off for people who reduce motion (the story then shows each step's finished screen). The carousel starts moving after the visitor's first interaction (scroll, pointer, touch or key), so nothing moves while the headline is being read. This also keeps Lighthouse's Speed Index from counting slide changes as loading: without it the score reads about 80, with the same load times.

**Dropdowns:** one themed `Dropdown` (on [Headless UI](https://headlessui.com)'s Listbox) replaces the browser's unstyled lists everywhere: brand colours, a check on the current option, icons for item categories; keyboard (arrows, Home/End, type-ahead, Esc) and screen readers work as with a native one. Forms connect it through react-hook-form's `Controller`; e2e tests pick options with `choose()` like a person would.

**Item and claim pages:** photos open full size (arrow keys or a swipe between photos, Esc to close); a Share button uses the phone's share sheet or copies the link; a claim shows its progress (sent → approved → handed over, or where it stopped).

## 8. Testing

**End-to-end (Playwright)**, in a real browser against the real API and an in-memory database:

- `e2e/start-api.mjs` starts MongoDB, seeds the university and runs the API with its background worker; emails are written to files (a local mail catcher), so tests read sign-up codes like a person would.
- **Journey 1:** two students sign up → the finder reports a found item with a photo and a verification question → the owner searches, finds and claims it → the finder is notified, checks the answer and approves → the owner sees the code → the finder enters it → the item shows as returned.
- **Moderation journey:** a student reports a fake post → an admin (appointed with the real `set-role` script) removes it with a reason → the poster is notified and the post is gone → the admin suspends the poster, whose session ends → the activity log shows the decisions.
- **Journey 2** (desktop and a Pixel 7 phone): a visitor signs up with a Gmail address, the session survives a reload, sign-out returns to the landing page, sign-in brings the session back.
- **Demo:** from the landing page a visitor signs in as Ravi with one click and claims the sample wallet, signs out, signs in as Asha and approves the claim; on a phone, a demo account sees that its profile can't be changed and is offered sign-up.
- **Photos:** a 12-megapixel photo over the 5 MB limit is shrunk in the browser, accepted and sent at a fraction of its size; on a phone the report form offers the camera.
- **Interface:** a dialog keeps the keyboard focus while typing; a form doesn't block on a hidden question; the report form offers the campus places, and "Other" asks which place (with a hint to pick the block for a room in it); an admin list keeps an open dialog while a search updates; a big phone photo becomes a profile picture; removing a post never flashes "not found"; the item page finds your claim on it.
- **Post lifecycle:** a reporter closes their post with a reason and opens it again.
- **Matching:** both posts name a campus place and an exact spot; the owner of a lost post is notified about a matching find and sees it among the possible matches.
- **Account and desk:** a person changes their password (this device stays signed in), downloads their data and deletes their account (a wrong password is refused first); a finder edits their post to say it is at the security desk, the desk sees it, the owner claims it, the desk approves the claim (the owner is told to collect it there, no contacts shared) and confirms the handover from its console; the privacy policy and terms open from the footer, also on a phone.
- **Insights:** an admin sees the breakdown by place and downloads the posts of a period as CSV.
- **Admin tools:** an admin removes a post from the Posts tab with a reason, then narrows the activity log to a day and to one person.
- **Resilience:** with the hosting layer faked to answer 502, pages load by themselves once the server wakes up, and a form sent to a sleeping server explains the wait and is not sent twice; leaving a page while its session is being restored keeps you signed in.

CI runs these on every push (`e2e` job).
