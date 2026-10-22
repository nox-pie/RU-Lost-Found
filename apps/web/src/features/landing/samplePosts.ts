import type { ItemCategory, ItemStatus, ItemType } from '@ru-lost-found/shared';

export interface SamplePost {
  photo: string;
  type: ItemType;
  category: ItemCategory;
  title: string;
  place: string;
  when: string;
  status: ItemStatus;
}

/**
 * A few posts from the sample data (apps/api/src/modules/demo/demoData.ts), as pictures for
 * the landing page: visitors who aren't signed in can't load real posts.
 */
export const SAMPLE_POSTS: readonly SamplePost[] = [
  {
    photo: '/landing/black-bifold-wallet.webp',
    type: 'FOUND',
    category: 'WALLET',
    title: 'Black bifold wallet',
    place: 'Library · Reading room',
    when: 'Today',
    status: 'OPEN',
  },
  {
    photo: '/landing/white-phone.webp',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'White iPhone with a clear case',
    place: 'CCD · Near the counter',
    when: 'Yesterday',
    status: 'OPEN',
  },
  {
    photo: '/landing/camera-backpack.webp',
    type: 'FOUND',
    category: 'BAG',
    title: 'Black camera backpack',
    place: 'Gate No. 2 · Bus stop',
    when: '2 days ago',
    status: 'RESERVED',
  },
  {
    photo: '/landing/laptop.webp',
    type: 'LOST',
    category: 'ELECTRONICS',
    title: 'Silver MacBook Air',
    place: 'Library · 2nd floor',
    when: '2 days ago',
    status: 'OPEN',
  },
  {
    photo: '/landing/red-umbrella.webp',
    type: 'FOUND',
    category: 'ACCESSORIES',
    title: 'Red umbrella',
    place: 'Pushpa Devi Dining Hall · Entrance',
    when: '6 days ago',
    status: 'OPEN',
  },
  {
    photo: '/landing/brass-keys.webp',
    type: 'FOUND',
    category: 'KEYS',
    title: 'Bunch of brass keys',
    place: 'Residency-3 · Laundry room',
    when: 'Last month',
    status: 'RESOLVED',
  },
];
