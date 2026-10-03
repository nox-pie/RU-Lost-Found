# Demo data

Before the portal has real users, it shows **sample data** so visitors (recruiters, examiners, students) see how it looks and works: 8 fictional students and 20 posts across the categories, in every status (open, handover arranged, returned), dated over the last eight weeks.

Everything is created through the real domain and services: returned posts went through a real claim, approval and handover, so their history, notifications, activity-log entries and the admin statistics are exactly what real use produces. Sample posts can be claimed like real ones.

## Trying it without an account

Signed-out visitors see a **landing page** at `/`: what the portal does, the three steps (post, claim, hand over) and a preview of sample posts. Its **"Try it now"** section signs them in with one click as one of two sample students:

| Person         | Role       | Suggested path                                                    |
| -------------- | ---------- | ----------------------------------------------------------------- |
| **Ravi Singh** | The owner  | Find the black bifold wallet in the feed and claim it             |
| **Asha Verma** | The finder | Open her wallet post, compare the answer and approve Ravi's claim |

Signing in as Ravi, claiming, signing out and approving as Asha shows the whole flow in about a minute. The sign-in page offers the same two buttons under the form.

`POST /api/v1/auth/demo` with `{ "persona": "asha.verma" }` does the sign-in (a normal session with a refresh cookie). It accepts only the people listed in `DEMO_PERSONAS` (`packages/shared/src/demo.ts`), answers 404 unless `DEMO_MODE=true`, is rate limited per IP and refuses requests from other sites. `GET /api/v1/auth/demo` tells the web app whether to show the buttons.

## Safeguards

| Concern                                   | How it is handled                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitors mistaking samples for real items | Every sample post shows a **"Sample post"** badge, and its page explains it                                                                                                                                                                                                                                                                             |
| Emails to people who don't exist          | Demo accounts use addresses on `demo.invalid`, a domain reserved for testing that can never receive mail. `SkipUndeliverableEmailSender` (a decorator around the email provider) drops mail to reserved domains, so Brevo's quota and sender reputation are untouched                                                                                   |
| Demo activity tangling with real data     | Demo accounts can only claim sample posts. Removal deletes demo posts and everything tied to them, including real visitors' claims on sample posts and the notifications about them; real posts and accounts are never touched                                                                                                                          |
| Anyone can use a demo account             | Demo accounts can't post new items (so no uploads), edit or remove the sample posts, change their profile or picture, or flag real posts. These rules live in the domain and services (`User.assertEditable`, `ItemService`, `ModerationService.flag`), so the API enforces them whatever the client does; the web app just hides what would be refused |
| Visitors changing the samples             | With `DEMO_MODE=true`, the API resets the sample data every 24 hours                                                                                                                                                                                                                                                                                    |
| Cloudinary usage                          | Sample photos are static files served by the web app from `/demo/`; they use no Cloudinary credits and no clean-up job deletes them                                                                                                                                                                                                                     |

## Commands

```bash
cd apps/api
npm run demo -- seed      # create the sample data (skipped if it already exists)
npm run demo -- reset     # back to the original sample data
npm run demo -- remove    # delete all of it
```

Against production, add `--env-file=.env.production` through `npx tsx --env-file=.env.production src/scripts/demo.ts <command>` (see [deployment.md](deployment.md#where-configuration-lives)).

**`DEMO_MODE`** (API setting, default `false`): when `true`, the API creates the sample data at start-up if it is missing and resets it every 24 hours.

## Before real users arrive

1. Set `DEMO_MODE=false` on Render (otherwise the API recreates the samples at its next start).
2. Run `npm run demo -- remove` against production.
3. Optionally delete `apps/web/public/demo/` and `apps/api/src/modules/demo/`.

## Where it lives

- `apps/api/src/modules/demo/demoData.ts`: the people and posts (edit here to change the samples)
- `apps/api/src/modules/demo/DemoSeeder.ts`: seed, remove, reset
- `apps/api/src/modules/demo/infrastructure/MongoDemoDataStore.ts`: finds and deletes everything tied to demo accounts
- `apps/web/public/demo/`: the photos

## Photo credits

All sample photos are **CC0 / public domain** (no attribution required), found through [Openverse](https://openverse.org), resized for the web.

| File                      | Title                             | Creator              | Source          | Link                                                                                             |
| ------------------------- | --------------------------------- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `black-bifold-wallet.jpg` | Empty wallet                      | unknown              | rawpixel (CC0)  | [source](https://www.rawpixel.com/image/5920849/empty-wallet-free-public-domain-cc0-image)       |
| `worn-leather-wallet.jpg` | Wallet (ca.1936) Thomas Holloway  | nationalgalleryofart | rawpixel (CC0)  | [source](https://www.rawpixel.com/image/3390674/free-illustration-image-antique-art-artwork)     |
| `keys-red-keyring.jpg`    | Keys Door                         | WDnet Studio         | stocksnap (CC0) | [source](https://stocksnap.io/photo/keys-door-Z1TKDI29FZ)                                        |
| `brass-keys.jpg`          | Keys Padlocks                     | Leeroy               | stocksnap (CC0) | [source](https://stocksnap.io/photo/keys-padlocks-D5D3B74933)                                    |
| `usb-c-charger.jpg`       | Free phone charger image          | unknown              | rawpixel (CC0)  | [source](https://www.rawpixel.com/image/5923136/photo-image-phone-public-domain-white)           |
| `blue-calculator.jpg`     | Calculator Numbers                | Martin Vorel         | stocksnap (CC0) | [source](https://stocksnap.io/photo/calculator-numbers-VVXW9WBTB8)                               |
| `black-calculator.jpg`    | Calculator Numbers                | Negative Space       | stocksnap (CC0) | [source](https://stocksnap.io/photo/calculator-numbers-QXPCJWO3RW)                               |
| `red-umbrella.jpg`        | Red Umbrella                      | Gabriel Santiago     | stocksnap (CC0) | [source](https://stocksnap.io/photo/red-umbrella-45JIYYO371)                                     |
| `sketch-notebook.jpg`     | Notebook Paper                    | Angelina Litvin      | stocksnap (CC0) | [source](https://stocksnap.io/photo/notebook-paper-JLXDNN5BNE)                                   |
| `leather-notebook.jpg`    | Notebook Pen                      | Negative Space       | stocksnap (CC0) | [source](https://stocksnap.io/photo/notebook-pen-2H0QPGDVGZ)                                     |
| `water-bottle.jpg`        | Water Bottle                      | Steve Johnson        | stocksnap (CC0) | [source](https://stocksnap.io/photo/water-bottle-EBUJNKRBLV)                                     |
| `card-holder.jpg`         | small notebook leather cover next | unknown              | rawpixel (CC0)  | [source](https://www.rawpixel.com/image/3301817/free-photo-image-accessory-cc0-creative-commons) |
| `wristwatch.jpg`          | Watch Time                        | Wil Stewart          | stocksnap (CC0) | [source](https://stocksnap.io/photo/watch-time-L9R4MMVFVJ)                                       |
| `laptop.jpg`              | Macbook Laptop                    | Lauren Mancke        | stocksnap (CC0) | [source](https://stocksnap.io/photo/macbook-laptop-F7OLW2SG0C)                                   |
| `headphones.jpg`          | Headphones Audio                  | %C1lvaro%20Bernal    | stocksnap (CC0) | [source](https://stocksnap.io/photo/headphones-audio-WM2HLLDW0K)                                 |
| `yellow-sunglasses.jpg`   | Sunglasses Summer                 | Jakub Rostkowski     | stocksnap (CC0) | [source](https://stocksnap.io/photo/sunglasses-summer-EVAARS1W4M)                                |
| `puffer-jacket.jpg`       | Leather Jacket                    | Robbie Noble         | stocksnap (CC0) | [source](https://stocksnap.io/photo/leather-jacket-DK118BUX57)                                   |
| `textbook.jpg`            | Books Reading                     | Aaron Burden         | stocksnap (CC0) | [source](https://stocksnap.io/photo/books-reading-CN63QSUO8C)                                    |
| `white-phone.jpg`         | Smartphone Mobile                 | Negative Space       | stocksnap (CC0) | [source](https://stocksnap.io/photo/smartphone-mobile-O4V3KXZI1T)                                |
| `camera-backpack.jpg`     | Backpack Gear                     | Lukasz Kowalewski    | stocksnap (CC0) | [source](https://stocksnap.io/photo/backpack-gear-4MT4167LN3)                                    |
