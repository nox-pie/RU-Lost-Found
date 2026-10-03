/**
 * The sample people a visitor can sign in as with one click (when the API runs with
 * DEMO_MODE). Together they cover both sides of the main story: Asha found a wallet in the
 * library, Ravi is the student who lost it.
 */
export const DEMO_PERSONAS = [
  {
    key: 'asha.verma',
    firstName: 'Asha',
    lastName: 'Verma',
    role: 'The finder',
    story: 'Found a black wallet in the library and posted it.',
    tryThis: 'Review the claims on her post and approve the right owner.',
  },
  {
    key: 'ravi.singh',
    firstName: 'Ravi',
    lastName: 'Singh',
    role: 'The owner',
    story: 'Lost his wallet somewhere on campus.',
    tryThis: 'Find the wallet in the feed and claim it by answering Asha’s question.',
  },
] as const;

export type DemoPersonaKey = (typeof DEMO_PERSONAS)[number]['key'];
export type DemoPersona = (typeof DEMO_PERSONAS)[number];
