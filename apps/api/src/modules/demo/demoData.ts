import type {
  ItemCategory,
  ItemType,
  ModerationDecision,
  ReportReason,
  Role,
} from '@ru-lost-found/shared';

/**
 * The sample data visitors see before the portal has real users: fictional students and their
 * posts. Everything is created through the real domain and services (claims are submitted,
 * approved and handed over), so it behaves exactly like real data. Photos are CC0 stock
 * images served by the web app from /demo (see docs/demo-data.md).
 */

export interface DemoPerson {
  /** Local part of the email; the address is `<key>@demo.invalid`. */
  key: string;
  firstName: string;
  lastName: string;
  year: number;
  /** A profile picture served by the web app (public/demo/people), for the one-click personas. */
  avatar?: string;
  /** Students unless set. */
  role?: Role;
}

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  {
    key: 'asha.verma',
    firstName: 'Asha',
    lastName: 'Verma',
    year: 2,
    avatar: '/demo/people/asha.webp',
  },
  {
    key: 'ravi.singh',
    firstName: 'Ravi',
    lastName: 'Singh',
    year: 3,
    avatar: '/demo/people/ravi.webp',
  },
  { key: 'kabir.rao', firstName: 'Kabir', lastName: 'Rao', year: 1 },
  { key: 'meera.iyer', firstName: 'Meera', lastName: 'Iyer', year: 4 },
  { key: 'ananya.gupta', firstName: 'Ananya', lastName: 'Gupta', year: 2 },
  { key: 'arjun.nair', firstName: 'Arjun', lastName: 'Nair', year: 3 },
  { key: 'isha.kapoor', firstName: 'Isha', lastName: 'Kapoor', year: 1 },
  { key: 'dev.malhotra', firstName: 'Dev', lastName: 'Malhotra', year: 4 },
  // Decides the sample reports. Nobody can sign in as her: demo sign-in offers only the
  // personas (DEMO_PERSONAS), and demo accounts can't get a password.
  { key: 'neha.sharma', firstName: 'Neha', lastName: 'Sharma', year: 1, role: 'UNIVERSITY_ADMIN' },
];

/** What happens to a post after it is created. */
export type DemoOutcome =
  | { kind: 'open' }
  /** A claim was approved; the handover is still to happen. */
  | { kind: 'reserved'; claimant: string; answers?: string[] }
  /** The item went back to its owner through a completed handover. */
  | { kind: 'returned'; claimant: string; answers?: string[]; daysToReturn: number };

export interface DemoPost {
  photo: string;
  type: ItemType;
  category: ItemCategory;
  title: string;
  description: string;
  /** One of Rishihood University's campus places (seed/universities.json). */
  place: string;
  /** The exact spot within the place. */
  location: string;
  reporter: string;
  /** Posted this many days before the seed runs. */
  daysAgo: number;
  questions?: string[];
  heldAtSecurityDesk?: boolean;
  outcome: DemoOutcome;
}

/** Newest first in the feed: smaller `daysAgo` appears higher. */
export const DEMO_POSTS: readonly DemoPost[] = [
  // Ravi's side of the story. Created just before Asha's find, so matching tells him about it
  // and his post shows it as a strong match (visitors signed in as Ravi see smart matching).
  {
    photo: 'black-bifold-wallet',
    type: 'LOST',
    category: 'WALLET',
    title: 'Black wallet with my library card',
    description:
      'Lost my black leather wallet last night, I think in the library reading room. It has my library card and some cash.',
    place: 'Library',
    location: 'Reading room',
    reporter: 'ravi.singh',
    daysAgo: 0,
    outcome: { kind: 'open' },
  },
  {
    photo: 'black-bifold-wallet',
    type: 'FOUND',
    category: 'WALLET',
    title: 'Black bifold wallet',
    description:
      'Found on a table in the library reading room after the evening session. It has a few cards and some cash inside.',
    place: 'Library',
    location: 'Reading room',
    reporter: 'asha.verma',
    daysAgo: 0,
    questions: ['What is the name on the library card inside?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'white-phone',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'White iPhone with a clear case',
    description:
      'Lost my white iPhone at CCD around lunch. Clear case with a bus pass tucked behind it.',
    place: 'CCD',
    location: 'Near the counter',
    reporter: 'kabir.rao',
    daysAgo: 1,
    outcome: { kind: 'open' },
  },
  {
    photo: 'keys-red-keyring',
    type: 'FOUND',
    category: 'KEYS',
    title: 'Keys on a red keyring',
    description:
      'Two keys on a ring with a small tag. Found hanging from the main door of Residency-1.',
    place: 'Residency-1',
    location: 'Main door',
    reporter: 'meera.iyer',
    daysAgo: 1,
    questions: ['What is written on the tag?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'camera-backpack',
    type: 'FOUND',
    category: 'BAG',
    title: 'Black camera backpack',
    description:
      'Black backpack with a red padded inside, left at the bus stop by Gate No. 2. Nothing valuable taken out.',
    place: 'Gate No. 2',
    location: 'Bus stop',
    reporter: 'arjun.nair',
    daysAgo: 2,
    questions: ['What is in the front pocket?'],
    outcome: { kind: 'reserved', claimant: 'isha.kapoor', answers: ['A lens cleaning cloth'] },
  },
  {
    photo: 'laptop',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Silver MacBook Air',
    description:
      'Silver MacBook Air in a grey sleeve, possibly left on the second floor of the library. Has a Newton School sticker.',
    place: 'Library',
    location: '2nd floor',
    reporter: 'dev.malhotra',
    daysAgo: 2,
    outcome: { kind: 'open' },
  },
  {
    photo: 'usb-c-charger',
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'White USB-C charger',
    description:
      'A white USB-C wall charger with its cable, left plugged in at a desk in computer lab 2 of A-Block.',
    place: 'A-Block',
    location: 'Computer lab 2',
    reporter: 'ravi.singh',
    daysAgo: 3,
    outcome: { kind: 'open' },
  },
  {
    photo: 'black-calculator',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Black Casio calculator',
    description:
      'Lost my black Casio scientific calculator somewhere between A-Block and the dining hall.',
    place: 'A-Block',
    location: 'Corridor',
    reporter: 'ravi.singh',
    daysAgo: 4,
    outcome: { kind: 'reserved', claimant: 'asha.verma' },
  },
  {
    photo: 'blue-calculator',
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'Blue scientific calculator',
    description:
      'Blue calculator found in the C-Block exam hall after the maths paper. Handed in at the security desk.',
    place: 'C-Block',
    location: 'Exam hall',
    reporter: 'kabir.rao',
    daysAgo: 5,
    heldAtSecurityDesk: true,
    questions: ['What is written on the back?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'red-umbrella',
    type: 'FOUND',
    category: 'ACCESSORIES',
    title: 'Red umbrella',
    description: 'A red umbrella left near the dining hall entrance during the evening rain.',
    place: 'Pushpa Devi Dining Hall',
    location: 'Entrance',
    reporter: 'isha.kapoor',
    daysAgo: 6,
    outcome: { kind: 'open' },
  },
  {
    photo: 'yellow-sunglasses',
    type: 'LOST',
    category: 'ACCESSORIES',
    title: 'Yellow-framed sunglasses',
    description: 'Yellow sunglasses in a soft pouch, lost at the football ground during practice.',
    place: 'Football Ground',
    location: 'Stands',
    reporter: 'meera.iyer',
    daysAgo: 7,
    outcome: { kind: 'open' },
  },
  {
    photo: 'headphones',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Black over-ear headphones',
    description: 'Black over-ear headphones, left in the main auditorium after the guest lecture.',
    place: 'Main Auditorium',
    location: 'Back rows',
    reporter: 'ananya.gupta',
    daysAgo: 8,
    outcome: { kind: 'open' },
  },
  {
    photo: 'sketch-notebook',
    type: 'FOUND',
    category: 'BOOKS',
    title: 'Ruled notebook with sketches',
    description:
      'A ruled notebook full of sketches and class notes, found in seminar room 3 of B-Block.',
    place: 'B-Block',
    location: 'Seminar room 3',
    reporter: 'ananya.gupta',
    daysAgo: 9,
    questions: ['What subject are the notes for?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'puffer-jacket',
    type: 'LOST',
    category: 'CLOTHING',
    title: 'Black puffer jacket',
    description: 'Black puffer jacket, size M, left in the Residency-2 common room.',
    place: 'Residency-2',
    location: 'Common room',
    reporter: 'arjun.nair',
    daysAgo: 11,
    outcome: { kind: 'open' },
  },
  {
    photo: 'water-bottle',
    type: 'FOUND',
    category: 'BOTTLE',
    title: 'Clear water bottle',
    description: 'A clear reusable water bottle found on a bench in the gym.',
    place: 'Gym',
    location: 'Bench',
    reporter: 'dev.malhotra',
    daysAgo: 13,
    outcome: { kind: 'open' },
  },
  {
    photo: 'card-holder',
    type: 'FOUND',
    category: 'ID_CARD',
    title: 'Brown card holder with a student ID',
    description: 'Brown leather card holder with a student ID inside, found at Gate No. 2.',
    place: 'Gate No. 2',
    location: 'Security booth',
    reporter: 'asha.verma',
    daysAgo: 15,
    heldAtSecurityDesk: true,
    questions: ['What is the enrolment number on the ID?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'textbook',
    type: 'LOST',
    category: 'BOOKS',
    title: 'Introduction to Algorithms textbook',
    description: 'My copy of CLRS with notes in the margins. Probably left in a B-Block classroom.',
    place: 'B-Block',
    location: 'Classroom',
    reporter: 'isha.kapoor',
    daysAgo: 18,
    outcome: { kind: 'open' },
  },
  {
    photo: 'wristwatch',
    type: 'FOUND',
    category: 'ACCESSORIES',
    title: 'Silver wristwatch',
    description:
      'A silver analogue wristwatch with a black strap, found near the basketball court.',
    place: 'Basketball Court',
    location: 'Bench',
    reporter: 'kabir.rao',
    daysAgo: 22,
    questions: ['What is engraved on the back?'],
    outcome: { kind: 'open' },
  },
  {
    photo: 'worn-leather-wallet',
    type: 'FOUND',
    category: 'WALLET',
    title: 'Brown leather wallet',
    description: 'A worn brown leather wallet found outside the Mini Audi after the fest.',
    place: 'Mini Audi',
    location: 'Outside',
    reporter: 'meera.iyer',
    daysAgo: 30,
    questions: ['What colour is the lining?'],
    outcome: {
      kind: 'returned',
      claimant: 'dev.malhotra',
      answers: ['Red'],
      daysToReturn: 1,
    },
  },
  {
    photo: 'brass-keys',
    type: 'FOUND',
    category: 'KEYS',
    title: 'Bunch of brass keys',
    description: 'A heavy bunch of old brass keys found by the Residency-3 laundry room.',
    place: 'Residency-3',
    location: 'Laundry room',
    reporter: 'ravi.singh',
    daysAgo: 38,
    outcome: { kind: 'returned', claimant: 'ananya.gupta', daysToReturn: 2 },
  },
  {
    photo: 'leather-notebook',
    type: 'LOST',
    category: 'BOOKS',
    title: 'Brown leather notebook',
    description: 'Brown notebook with project notes, left on a desk in the library.',
    place: 'Library',
    location: 'Desk by the window',
    reporter: 'arjun.nair',
    daysAgo: 47,
    outcome: { kind: 'returned', claimant: 'kabir.rao', daysToReturn: 3 },
  },
];

/**
 * A post that breaks the rules: an advert dressed up as a found item. The sample admin removes
 * it, so the admins' decided reports include a removed post; it never reaches the feed.
 */
export const DEMO_ADVERT: DemoPost = {
  photo: 'headphones',
  type: 'FOUND',
  category: 'ELECTRONICS',
  title: 'Selling wireless headphones, barely used',
  description: 'Not lost, just selling. ₹1,500 or best offer, message me.',
  place: 'Atrium',
  location: 'Near the entrance',
  reporter: 'kabir.rao',
  daysAgo: 3,
  outcome: { kind: 'open' },
};

/** A report on a sample post, for the admins' review queue (Admin → Reports). */
export interface DemoReport {
  /** The title of the post it is about (in DEMO_POSTS, or DEMO_ADVERT). */
  post: string;
  by: string;
  reason: ReportReason;
  details: string;
  /** Filed this many hours before the seed runs. */
  hoursAgo: number;
  /** Already decided by the sample admin; without one, it waits for review. */
  decision?: { kind: ModerationDecision; note: string; hoursLater: number };
}

/** Two reports to review and two already decided (one post kept, one removed). */
export const DEMO_REPORTS: readonly DemoReport[] = [
  {
    post: 'Brown card holder with a student ID',
    by: 'meera.iyer',
    reason: 'INAPPROPRIATE',
    details: 'The photo shows the student ID clearly, with the name and enrollment number.',
    hoursAgo: 5,
  },
  {
    post: 'Blue scientific calculator',
    by: 'arjun.nair',
    reason: 'DUPLICATE',
    details: 'Looks like the same calculator as the black Casio post.',
    hoursAgo: 20,
  },
  {
    post: DEMO_ADVERT.title,
    by: 'ananya.gupta',
    reason: 'SPAM',
    details: 'This is an advert, not a found item.',
    hoursAgo: 48,
    decision: {
      kind: 'REMOVE_ITEM',
      note: 'Lost & Found isn’t for selling things.',
      hoursLater: 2,
    },
  },
  {
    post: 'Clear water bottle',
    by: 'isha.kapoor',
    reason: 'SPAM',
    details: 'It’s only a water bottle, not worth a post.',
    hoursAgo: 72,
    decision: {
      kind: 'DISMISS',
      note: 'Small things matter to their owners too. The post stays.',
      hoursLater: 3,
    },
  },
];
