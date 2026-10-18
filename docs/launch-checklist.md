# Launch checklist

Everything to do before opening the portal to Rishihood University students, in order. Each step says where to do it and how to check it worked. Production setup and commands are in [deployment.md](deployment.md); the services and their dashboards in [services.md](services.md).

**Today (19 October 2026):** the portal runs as a public demo: `DEMO_MODE=true` with sample posts, sign-up open to any email address, emails sent from a Gmail address. Two real accounts exist (one Rishihood student account, one Gmail account that is platform admin).

## 1. A week before: decisions and people

- [ ] **Privacy policy and terms** (`/privacy`, `/terms`): read them, and ideally ask the university to. If the text changes, change the "Last updated" date in `apps/web/src/features/legal/PrivacyPage.tsx` and `TermsPage.tsx`.
- [ ] **Contact address.** The footer and both legal pages show `brand.contactEmail`, today a personal student address. Choose one that will outlive your studies (a project or university mailbox) and set it in `apps/web/src/brand/brand.config.ts`.
- [ ] **Admins.** Render → `ru-lost-found-api` → Environment → `ADMIN_EMAILS` lists the owners; those accounts become platform admins. The current platform admin is a Gmail account: it keeps working after sign-up is limited to university addresses (sign-in doesn't check the domain), but a university address is easier to hand over.
- [ ] **Security desk staff.** Each person signs up with their university email; an admin sets their role to "Security desk" in Admin → People. Show them the **Desk** console: handovers waiting, items held at the desk, and "Confirm handover" on a claim once the item is in its owner's hands.

## 2. A week before: email

- [ ] **Sender domain.** `EMAIL_FROM_ADDRESS` is a `@gmail.com` address. Brevo can't authenticate (SPF, DKIM) mail for a domain you don't own, so codes are more likely to land in spam. Use a domain you control: Brevo → Senders, Domains → add the domain and its DNS records (SPF, DKIM, DMARC), then set `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` on Render and in `apps/api/.env.production`.
      _Check:_ request a sign-up code for a `@rishihood.edu.in` address; it arrives in the inbox, not in spam.
- [ ] **Daily limit.** Brevo's free plan sends 300 emails a day, and every sign-up needs at least one code. If more than about 200 people may sign up on the first day, take a paid month for the launch or spread the announcement over a few days.

## 3. A week before: data safety

- [ ] **Backups.** Atlas M0 has none. Either move the cluster to a tier with backups (Flex or M10), or schedule a `mongodump` of `ru-lost-found-v2` to private storage. Either way, take one dump before launch day and restore it once into a scratch database to prove it works.
- [ ] **Secrets.** Confirmed on 19 October 2026: the old `secrets/` folder was never committed. Production values live only in the Render and Vercel dashboards and the git-ignored `.env.production` files.

## 4. Launch day: switch off the demo and open to students

Do these in order: the API recreates the sample data at start-up while `DEMO_MODE` is on.

1. [ ] Render → Environment: `DEMO_MODE=false` (Render redeploys). Set the same in `apps/api/.env.production`.
       _Check:_ `https://ru-lost-found.vercel.app/api/v1/auth/demo` answers `{"enabled":false}`, and the home page shows no "Try the demo" button, link or section.
2. [ ] Remove the sample data:
   ```bash
   cd apps/api
   npx tsx --env-file=.env.production src/scripts/demo.ts remove
   ```
3. [ ] Limit sign-up to university addresses: in `apps/api/seed/universities.json` set `"emailDomains": ["rishihood.edu.in"]` (subdomains such as `nst.rishihood.edu.in` are included), merge that change, then apply it:
   ```bash
   npx tsx --env-file=.env.production src/scripts/seed.ts
   ```
   _Check:_ asking for a sign-up code with a Gmail address answers "Please use your university email address."
4. [ ] Wording that mentions visitors: `emailHint` in `apps/web/src/brand/brand.config.ts` (sign-in, sign-up and landing page) becomes "Use your university email address."; the README's "Live" line and "For visitors" paragraph no longer offer the demo. Merge, and Vercel deploys.
5. [ ] Delete your own test posts and claims in the app (Admin → Posts lists them).

## 5. Launch day: final checks on production

- [ ] On a phone: sign up with a fresh university address, receive the code, finish the profile.
- [ ] With two real accounts: post a found item with a photo and a question, claim it, approve, hand over with the code. Do one more with the security desk confirming instead.
- [ ] `https://ru-lost-found-api.onrender.com/api/v1/health/ready` answers `"status":"ok"`; both UptimeRobot monitors are green; Sentry shows no new issues.
- [ ] `https://ru-lost-found.vercel.app/api/v1/health/client` shows your own public IP as `ip` (rate limits per person work).

## 6. Announce

- [ ] A short message to students: the link, "sign up with your university email", post anything you find (valuables such as phones, wallets and ID cards go to the security desk, and the post can say so).
- [ ] A poster with a QR code at the security desk and the library.

## 7. The first weeks

| How often   | What                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily       | Sentry issues, UptimeRobot alerts, Brevo bounces and blocks, Admin → Reports (flagged posts)                                                                                        |
| Weekly      | Atlas storage (512 MB on M0), Upstash commands (10,000 a day free), Cloudinary credits, and that the latest backup exists                                                           |
| When needed | Upgrade in the order of [deployment.md §7](deployment.md#7-free-tiers-and-what-to-upgrade-first): Render Starter first if people notice the 30-second wake-up or sign-ins slow down |

## If something goes wrong

- **A bad deploy:** Render and Vercel keep every deploy; "Rollback" to the previous one in each dashboard, then fix forward with a pull request.
- **Lost or damaged data:** restore the latest dump (section 3) into `ru-lost-found-v2`.
- **Back to a demo** (for a presentation): `DEMO_MODE=true` on Render recreates the sample data at start-up; switch it off and run `demo.ts remove` afterwards.
