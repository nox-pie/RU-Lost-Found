import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';
import { LegalLayout, LegalSection } from './LegalLayout';

const { organisation, productName } = brand;

/** The rules for using the portal, in plain words. */
export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of use"
      updated="18 October 2026"
      intro={
        <p>
          By creating an account on {productName} you agree to these terms. They are short, and they
          exist so lost items find their way home safely.
        </p>
      }
    >
      <LegalSection heading="1. Who can use it">
        <p>
          The portal is for students and staff of {organisation.name}. Signing up needs a university
          email address. One account per person.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <ul>
          <li>Give your real name and details, and keep them up to date.</li>
          <li>Keep your password to yourself. You are responsible for what your account does.</li>
          <li>
            If you think someone else used your account, change your password on your profile, or
            reset it from the sign-in page.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Posting">
        <ul>
          <li>Post only items you really lost or found, and describe them honestly.</li>
          <li>
            Photograph the item, not people. Hide numbers on ID cards and bank cards; ask about them
            in a verification question instead.
          </li>
          <li>No advertising, selling, spam, or offensive or misleading content.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Claims and handovers">
        <ul>
          <li>Claim only items that are yours, or that you really found.</li>
          <li>
            Meet in a public place on campus, or at the security desk. Check the item before you
            hand it over or show your handover code.
          </li>
          <li>
            Showing or entering the code confirms the handover, so only do it once the item is in
            its owner’s hands.
          </li>
          <li>
            Valuables such as phones, wallets and ID cards are best handed in at the security desk.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. What we can do">
        <p>
          Administrators may remove posts and suspend accounts that break these terms, such as false
          claims or misleading posts. You are told why by email.
        </p>
      </LegalSection>

      <LegalSection heading="6. What we can’t promise">
        <p>
          The portal connects people; it doesn’t hold items (except those handed in at the security
          desk) and can’t guarantee that an item is returned. Meetings and handovers between members
          are their own responsibility. The service is offered as it is and may sometimes be
          unavailable.
        </p>
      </LegalSection>

      <LegalSection heading="7. Leaving">
        <p>
          You can delete your account at any time on your profile page. The{' '}
          <Link to="/privacy" className="font-medium text-primary underline">
            privacy policy
          </Link>{' '}
          explains what happens to your data.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          If these terms change, the date at the top changes too. Important changes are announced in
          the app before they apply.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
