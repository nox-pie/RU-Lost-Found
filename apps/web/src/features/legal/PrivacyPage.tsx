import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';
import { LegalLayout, LegalSection } from './LegalLayout';

const { organisation, productName } = brand;

/** What the portal stores, who sees it, how long it is kept, and what you can do about it. */
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy"
      updated="21 October 2026"
      intro={
        <p>
          {productName} helps the {organisation.name} community return lost items to their owners.
          To do that it needs a few details about you. This page explains, in plain words, what is
          stored, who can see it, how long it is kept and what you can do about it.
        </p>
      }
    >
      <LegalSection heading="1. What we store">
        <ul>
          <li>
            <strong>Your account:</strong> your university email address, first and last name, year
            of study, school, enrollment number, and, if you add them, your phone number and a
            profile picture. Your password is stored only as a one-way hash; nobody can read it.
          </li>
          <li>
            <strong>Your posts:</strong> what you write about an item, where and when it was lost or
            found, its photos, and the verification questions you ask. Photos are resized and their
            hidden details (such as the location the photo was taken at) are removed on upload.
          </li>
          <li>
            <strong>Your claims:</strong> your message, your answers to the finder’s questions, and
            whether you chose to share your phone number.
          </li>
          <li>
            <strong>Sign-in records:</strong> the devices you are signed in on (the browser name and
            IP address), and a log of sign-ins and other security-related actions.
          </li>
          <li>
            <strong>Notifications</strong> we show you in the app and send you by email.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Who can see it">
        <ul>
          <li>
            <strong>Other members</strong> see your name and profile picture on your posts and
            claims. Your email, phone and enrollment number are never shown in lists.
          </li>
          <li>
            <strong>The other person on an approved claim</strong> sees your email address, and your
            phone number if you chose to share it, so you can arrange the handover. When the item is
            collected at the security desk, nothing is shared: the desk hands it over.
          </li>
          <li>
            <strong>Security desk staff</strong> see the claims waiting for a handover, with the
            names of the two people, so they can hand items back in person. For items held at the
            desk, they also see the claims on them, with the answers to the finder’s questions, and
            decide on them.
          </li>
          <li>
            <strong>University administrators</strong> see account details, posts, reports and the
            activity log, to manage roles and stop misuse.
          </li>
        </ul>
        <p>
          We don’t sell your data, show ads or use tracking or analytics tools. Error reports (used
          to fix bugs) contain no personal details.
        </p>
      </LegalSection>

      <LegalSection heading="3. Services that help run the portal">
        <p>
          Your data is stored and processed by these services on our behalf, only to run the portal:
          MongoDB Atlas (database), Cloudinary (photos), Brevo (emails), Upstash (short-lived data
          such as sign-up codes and rate limits), Render and Vercel (hosting) and Sentry (error
          reports).
        </p>
      </LegalSection>

      <LegalSection heading="4. How long we keep it">
        <ul>
          <li>Your account and posts: until you delete them.</li>
          <li>
            A removed post disappears at once. Its photos are deleted after 30 days; its text is
            kept so administrators can review reports about it.
          </li>
          <li>Notifications: 180 days.</li>
          <li>Signed-in devices: deleted at the latest 7 days after you last used them.</li>
          <li>The security activity log: 1 year.</li>
          <li>Sign-up and password reset codes: 10 minutes.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Your choices">
        <ul>
          <li>
            Change your details or remove your picture at any time on your{' '}
            <Link to="/profile" className="font-medium text-primary underline">
              profile
            </Link>
            .
          </li>
          <li>
            <strong>Download your data:</strong> the profile page gives you everything your account
            holds as one file.
          </li>
          <li>
            <strong>Delete your account:</strong> also on the profile page. Your open posts are
            removed, your active claims withdrawn, and your profile, picture, notifications and
            signed-in devices deleted. Handovers you finished stay in the other person’s history,
            shown as “Former member”.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Cookies and storage">
        <p>
          The portal uses one cookie, only to keep you signed in. Scripts on the page can’t read it.
          It also remembers in your browser’s storage that you were signed in on this device, so the
          app knows to restore your session. There are no other cookies.
        </p>
      </LegalSection>

      <LegalSection heading="7. Changes">
        <p>
          If this policy changes, the date at the top changes too. Important changes are announced
          in the app before they apply.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
