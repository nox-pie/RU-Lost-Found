# Branding and deployments

RU Lost & Found is built for **Rishihood University**. The code itself is organisation-neutral: everything that makes it look and read like Rishihood's portal is configuration. Another organisation gets its **own deployment** of the same code, with its own branding, database, email sender and domain, rather than an account on this portal.

Running a deployment for another organisation needs a licence from the copyright holder (see [LICENSE](../LICENSE)).

## What to change

| Part                           | Where                                                                                                                   | What it controls                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web app texts, images, colours | `apps/web/src/brand/brand.config.ts`                                                                                    | Product name, browser title and description, organisation name and location, footer tagline, contact email, credit line, image paths, primary / secondary / page-background colours                           |
| Web app images                 | `apps/web/public/brand/`                                                                                                | `logo.png` (wide logo on sign-in pages), `symbol.png` (square mark: header, loading screen, favicon), `auth-background.png` (photo behind the sign-in card), `footer-art.png` (drawing faded into the footer) |
| Who can sign up                | `apps/api/seed/universities.json`                                                                                       | Organisation name, slug, allowed email domains (subdomains included), list of schools / departments                                                                                                           |
| Emails                         | API environment: `BRAND_NAME`, `BRAND_PRIMARY_COLOR`, `BRAND_BACKGROUND_COLOR`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Product name in subjects, header and footer; colours of the header, codes and buttons; sender                                                                                                                 |
| Links in emails                | API environment: `APP_URL`                                                                                              | Address of the web app                                                                                                                                                                                        |

Colours are hex values (`#1d4ed8`). The API rejects anything else, because the colours are placed inside email markup.

## Steps for a new deployment

1. Copy the repository (with a licence).
2. Edit `brand.config.ts` and replace the four images, keeping their file names or updating the paths.
3. Replace `apps/api/seed/universities.json` with the organisation's details.
4. Create a new MongoDB database, Brevo sender, Cloudinary account and Redis instance, and set the API environment (`apps/api/.env.example` lists every setting), including the `BRAND_*` values.
5. Run `npm run seed -w @ru-lost-found/api` once, then deploy the web app and API as described in the README.

Nothing in the components, services or tests needs to change. A build with a different `brand.config.ts` was checked to contain none of Rishihood's name or colours.

## What stays the same everywhere

Technical identifiers that are not visible to users stay as they are: the JWT issuer and key-derivation label (`ru-lost-found`), the Cloudinary folder, log service name and package names. Changing them would only invalidate existing sessions and stored images for no user-visible benefit.

## Why one deployment per organisation

- **Identity:** each organisation's people see their own name, logo and colours, on their own domain, with emails from their own sender.
- **Isolation:** data, outages and costs are separate; one organisation's load or incident can't affect another.
- **Simplicity:** no per-request theme lookup or tenant switcher in the UI.

The backend still scopes every query by university, so a shared multi-organisation deployment remains possible later without a data-model change.
