# Launch checklist

Everything to do before opening the portal to Rishihood University students, in order. Each step says where to do it and how to check it worked. Production setup and commands are in [deployment.md](deployment.md); the services and their dashboards in [services.md](services.md).

**Today (1 November 2026):** the portal runs as a public demo while the university's permission is pending: `DEMO_MODE=true` with 21 sample posts at the 24 campus places, sign-up open to any email address, emails sent from a Gmail address. Every service is on its free plan, and the database (Atlas M0, MongoDB 8.0) has **no backups**. Besides the demo accounts, the only accounts are the owner's two test accounts.

## 1. A week before: decisions and people

- [ ] **Privacy policy and terms** (`/privacy`, last updated 21 October 2026; `/terms`, 18 October 2026): read them, and ideally ask the university to. If the text changes, change the `updated` date in `apps/web/src/features/legal/PrivacyPage.tsx` or `TermsPage.tsx`.
- [ ] **Contact address.** The footer and both legal pages show `brand.contactEmail`, today a personal student address. Choose one that will outlive your studies (a project or university mailbox) and set it in `apps/web/src/brand/brand.config.ts`.
- [ ] **Admins.** Render → `ru-lost-found-api` → Environment → `ADMIN_EMAILS` lists the owners; those accounts become platform admins. The current platform admin is a Gmail account: it keeps working after sign-up is limited to university addresses (sign-in doesn't check the domain), but a university address is easier to hand over.
- [ ] **Security desk staff.** Each person signs up with their university email; an admin sets their role to "Security desk" in Admin → People. Show them the **Desk** console: handovers waiting, claims to decide on items held at the desk (any of them may approve or decline, so the desk works as a team), items held at the desk, and "Confirm handover" on a claim once the item is in its owner's hands.
- [ ] **Paid plans.** Decide which to take (each is a settings change, see [deployment.md §7](deployment.md#7-scaling-up)):
  - **Atlas:** Flex or above, for backups (section 3). This is the one to take.
  - **Vercel:** Pro. Hobby is meant for personal, non-commercial projects, and this becomes a university service.
  - **Brevo:** a paid month from launch day (decided in October 2026, section 2).
  - **Render:** Starter is optional. UptimeRobot keeps the free instance awake, but it has only a fraction of a CPU; take Starter if sign-ins feel slow after launch.
- [ ] **Code is current.** `main` is green in CI and no major library upgrade is waiting (they are done as their own milestone, never in launch week).

## 2. A week before: email

- [ ] **Sender domain.** `EMAIL_FROM_ADDRESS` is a `@gmail.com` address. Brevo can't authenticate (SPF, DKIM) mail for a domain you don't own, so codes are more likely to land in spam. Use a domain you control: Brevo → Senders, Domains → add the domain and its DNS records (SPF, DKIM, DMARC), then set `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` on Render and in `apps/api/.env.production`.
      _Check:_ request a sign-up code for a `@rishihood.edu.in` address; it arrives in the inbox, not in spam.
- [ ] **Daily limit: switch Brevo to a paid plan on launch day.** The free plan sends 300 emails a day, and every sign-up needs at least one code. Beyond launch-day sign-ups, anyone can ask for codes (60 an hour from one address), so a single person could use up a free day's emails and block every sign-up and password reset; a paid plan's larger allowance absorbs that. (A CAPTCHA on the code form would stop it at the source; it was left out for now.)

## 3. A week before: data safety

- [ ] **Backups.** Atlas M0 has none, and from launch day on the database holds students' accounts, posts and claims. Choose one way, then prove a restore works before launch day:

  **A. Atlas backups (recommended).** Atlas → cluster **Lost-and-Found** → Edit configuration → **Flex** (or M10). The upgrade happens in place and keeps the data; if Atlas shows a new connection string, update `MONGODB_URI` on Render and in `apps/api/.env.production`. Atlas then takes a snapshot every day (cluster → **Backup**).
  _Check:_ the next day, Backup lists a snapshot. Restore it once into a **separate scratch cluster**, never into Lost-and-Found: a restore replaces everything in its target.

  **B. Your own dumps (free).** Install the [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools), then from `apps/api` (the commands read the connection string without printing it):

  ```bash
  export MONGODB_URI="$(grep '^MONGODB_URI=' .env.production | cut -d= -f2- | tr -d '"')"
  mongodump --uri="$MONGODB_URI" --gzip --archive="ru-lost-found-$(date +%F).gz"
  ```

  Do it weekly and before any risky change. _Check:_ restore the dump into a scratch database next to the real one, compare the counts in Atlas (Browse Collections), then delete the scratch database:

  ```bash
  mongorestore --uri="$MONGODB_URI" --gzip --archive="ru-lost-found-<date>.gz" \
    --nsFrom='ru-lost-found-v2.*' --nsTo='restore-test.*'
  ```

  A dump holds personal data: keep it encrypted and private (never in the repository or a shared folder), and keep only the last four.

  Either way: photos live in Cloudinary, not in the database (deleting a post's photos waits 30 days, so a mistake can still be undone); Redis holds only short-lived codes and counters and needs no backup.

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
- [ ] Matching: one account posts a lost item, the other a found item of the same category at the same campus place. The owner of the lost post sees it under possible matches and is notified.
- [ ] `https://ru-lost-found-api.onrender.com/api/v1/health/ready` answers `"status":"ok"`; both UptimeRobot monitors (up + keep awake, database + Redis) are green; Sentry shows no new issues.
- [ ] `https://ru-lost-found.vercel.app/api/v1/health/client` shows your own public IP as `ip` (rate limits per person work).
- [ ] On campus Wi-Fi, open the same address on two phones. If both show the same `ip`, the campus shares one address: rate limits then count the whole campus together. Session refreshes are exempt and the other limits are generous, but if students report "Too many requests", raise `WRITE_LIMIT_PER_MINUTE` on Render (for example to 600).

## 6. Announce

- [ ] A short message to students: the link, "sign up with your university email", post anything you find (valuables such as phones, wallets and ID cards go to the security desk, and the post can say so).
- [ ] A poster with a QR code at the security desk and the library.

## 7. The first weeks

| How often   | What                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Daily       | Sentry issues, UptimeRobot alerts, Brevo bounces and blocks, Admin → Reports (flagged posts)                           |
| Weekly      | Atlas storage (512 MB on M0), Upstash commands (its Usage page), Cloudinary credits, and that the latest backup exists |
| Monthly     | A restore test (section 3); merge or close Dependabot pull requests                                                    |
| When needed | Scale up as [deployment.md §7](deployment.md#7-scaling-up) describes: Render Starter first if sign-ins slow down       |

After the first weeks, [maintenance.md](maintenance.md) takes over: the same checks, plus updates, security alerts and yearly upkeep.

## If something goes wrong

- **A bad deploy:** Render and Vercel keep every deploy; "Rollback" to the previous one in each dashboard, then fix forward with a pull request.
- **Lost or damaged data:** with Atlas backups, Atlas → cluster → Backup → Restore a snapshot from before the problem (it replaces the cluster's data). With your own dumps: `mongorestore --uri="$MONGODB_URI" --gzip --archive="ru-lost-found-<date>.gz" --drop` (replaces each collection that is in the dump). Either way, anything written after that backup is lost, so tell the people affected.
- **Back to a demo** (for a presentation): `DEMO_MODE=true` on Render recreates the sample data at start-up; switch it off and run `demo.ts remove` afterwards.
