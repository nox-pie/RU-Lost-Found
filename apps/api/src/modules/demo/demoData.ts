import type { ItemCategory, ItemType } from '@ru-lost-found/shared';

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
}

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  { key: 'asha.verma', firstName: 'Asha', lastName: 'Verma', year: 2 },
  { key: 'ravi.singh', firstName: 'Ravi', lastName: 'Singh', year: 3 },
  { key: 'kabir.rao', firstName: 'Kabir', lastName: 'Rao', year: 1 },
  { key: 'meera.iyer', firstName: 'Meera', lastName: 'Iyer', year: 4 },
  { key: 'ananya.gupta', firstName: 'Ananya', lastName: 'Gupta', year: 2 },
  { key: 'arjun.nair', firstName: 'Arjun', lastName: 'Nair', year: 3 },
  { key: 'isha.kapoor', firstName: 'Isha', lastName: 'Kapoor', year: 1 },
  { key: 'dev.malhotra', firstName: 'Dev', lastName: 'Malhotra', year: 4 },
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
  {
    photo: 'black-bifold-wallet',
    type: 'FOUND',
    category: 'WALLET',
    title: 'Black bifold wallet',
    description:
      'Found on a table in the library reading room after the evening session. It has a few cards and some cash inside.',
    location: 'Library reading room',
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
      'Lost my white iPhone in the cafeteria around lunch. Clear case with a bus pass tucked behind it.',
    location: 'Cafeteria',
    reporter: 'kabir.rao',
    daysAgo: 1,
    outcome: { kind: 'open' },
  },
  {
    photo: 'keys-red-keyring',
    type: 'FOUND',
    category: 'KEYS',
    title: 'Keys on a red keyring',
    description: 'Two keys on a ring with a small tag. Found hanging from the door of Hostel A.',
    location: 'Hostel A entrance',
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
      'Black backpack with a red padded inside, left at the campus bus stop. Nothing valuable taken out.',
    location: 'Campus bus stop',
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
    location: 'Library, 2nd floor',
    reporter: 'dev.malhotra',
    daysAgo: 2,
    outcome: { kind: 'open' },
  },
  {
    photo: 'usb-c-charger',
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'White USB-C charger',
    description: 'A white USB-C wall charger with its cable, left plugged in at a desk in Lab 2.',
    location: 'Computer Lab 2',
    reporter: 'ravi.singh',
    daysAgo: 3,
    outcome: { kind: 'open' },
  },
  {
    photo: 'headphones',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Black over-ear headphones',
    description: 'Black over-ear headphones, left in the auditorium after the guest lecture.',
    location: 'Auditorium',
    reporter: 'ananya.gupta',
    daysAgo: 4,
    outcome: { kind: 'open' },
  },
  {
    photo: 'blue-calculator',
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'Blue scientific calculator',
    description:
      'Blue calculator found in Exam Hall B after the maths paper. Handed in at the security desk.',
    location: 'Exam Hall B',
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
    description: 'A red umbrella left near the canteen entrance during the evening rain.',
    location: 'Canteen',
    reporter: 'isha.kapoor',
    daysAgo: 6,
    outcome: { kind: 'open' },
  },
  {
    photo: 'yellow-sunglasses',
    type: 'LOST',
    category: 'ACCESSORIES',
    title: 'Yellow-framed sunglasses',
    description: 'Yellow sunglasses in a soft pouch, lost at the cricket ground during practice.',
    location: 'Cricket ground',
    reporter: 'meera.iyer',
    daysAgo: 7,
    outcome: { kind: 'open' },
  },
  {
    photo: 'black-calculator',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Black Casio calculator',
    description:
      'Lost my black Casio scientific calculator somewhere between the Newton block and the canteen.',
    location: 'Newton block',
    reporter: 'ravi.singh',
    daysAgo: 8,
    outcome: { kind: 'reserved', claimant: 'asha.verma' },
  },
  {
    photo: 'sketch-notebook',
    type: 'FOUND',
    category: 'BOOKS',
    title: 'Ruled notebook with sketches',
    description: 'A ruled notebook full of sketches and class notes, found in Seminar Room 3.',
    location: 'Seminar Room 3',
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
    description: 'Black puffer jacket, size M, left in the Hostel B common room.',
    location: 'Hostel B common room',
    reporter: 'arjun.nair',
    daysAgo: 11,
    outcome: { kind: 'open' },
  },
  {
    photo: 'water-bottle',
    type: 'FOUND',
    category: 'BOTTLE',
    title: 'Clear water bottle',
    description: 'A clear reusable water bottle found on the bench of the sports complex.',
    location: 'Sports complex',
    reporter: 'dev.malhotra',
    daysAgo: 13,
    outcome: { kind: 'open' },
  },
  {
    photo: 'card-holder',
    type: 'FOUND',
    category: 'ID_CARD',
    title: 'Brown card holder with a student ID',
    description: 'Brown leather card holder with a student ID inside, found at the main gate.',
    location: 'Main gate',
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
    description:
      'My copy of CLRS with notes in the margins. Probably left in a Newton block classroom.',
    location: 'Newton block',
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
    location: 'Basketball court',
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
    description: 'A worn brown leather wallet found outside the auditorium after the fest.',
    location: 'Auditorium',
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
    description: 'A heavy bunch of old brass keys found by the hostel laundry.',
    location: 'Hostel laundry',
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
    location: 'Library',
    reporter: 'arjun.nair',
    daysAgo: 47,
    outcome: { kind: 'returned', claimant: 'kabir.rao', daysToReturn: 3 },
  },
];
