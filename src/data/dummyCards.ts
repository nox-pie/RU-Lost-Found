import { Item } from '../types';

export const dummyCards: Omit<Item, 'id'>[] = [
  {
    type: 'lost',
    title: 'MacBook Pro 13"',
    description: 'Space Gray MacBook Pro with stickers on the cover. Last seen in the Library study area.',
    location: 'University Library, 2nd Floor',
    date: '2024-03-15',
    reporter: 'John Smith',
    reporterId: 'dummy1',
    status: 'open',
    createdAt: Date.now() - 1000000,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'Blue Hydroflask Bottle',
    description: 'Found a 32oz Blue Hydroflask water bottle with some stickers near the basketball court.',
    location: 'Sports Complex',
    date: '2024-03-14',
    reporter: 'Emma Davis',
    reporterId: 'dummy2',
    status: 'open',
    createdAt: Date.now() - 2000000,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop'
  },
  {
    type: 'lost',
    title: 'Calculator TI-84',
    description: 'Lost my TI-84 Plus graphing calculator during the Math exam.',
    location: 'Academic Block, Room 204',
    date: '2024-03-13',
    reporter: 'Michael Chen',
    reporterId: 'dummy3',
    status: 'open',
    createdAt: Date.now() - 3000000,
    image: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'Student ID Card',
    description: 'Found a student ID card near the cafeteria entrance.',
    location: 'Student Center',
    date: '2024-03-12',
    reporter: 'Sarah Johnson',
    reporterId: 'dummy4',
    status: 'claimed',
    createdAt: Date.now() - 4000000,
    image: 'https://images.unsplash.com/photo-1609692814858-f7cd2f0afa4f?w=800&auto=format&fit=crop'
  },
  {
    type: 'lost',
    title: 'AirPods Pro Case',
    description: 'Lost my AirPods Pro charging case. White color with a small scratch on the front.',
    location: 'Student Lounge',
    date: '2024-03-11',
    reporter: 'Alex Turner',
    reporterId: 'dummy5',
    status: 'open',
    createdAt: Date.now() - 5000000,
    image: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'Reading Glasses',
    description: 'Found black-rimmed reading glasses in a brown case after the morning lecture.',
    location: 'Lecture Hall A',
    date: '2024-03-10',
    reporter: 'Lisa Wong',
    reporterId: 'dummy6',
    status: 'open',
    createdAt: Date.now() - 6000000,
    image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800&auto=format&fit=crop'
  },
  {
    type: 'lost',
    title: 'USB Drive 64GB',
    description: 'Lost a black SanDisk 64GB USB drive with important project files.',
    location: 'Computer Lab',
    date: '2024-03-09',
    reporter: 'David Miller',
    reporterId: 'dummy7',
    status: 'open',
    createdAt: Date.now() - 7000000,
    image: 'https://images.unsplash.com/photo-1618410320928-25228d811631?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'Laptop Charger',
    description: 'Found a MacBook Pro charger (61W USB-C) in the study area.',
    location: 'Student Center, Study Room B',
    date: '2024-03-08',
    reporter: 'Rachel Green',
    reporterId: 'dummy8',
    status: 'open',
    createdAt: Date.now() - 8000000,
    image: 'https://images.unsplash.com/photo-1588141133515-137005cdb0fc?w=800&auto=format&fit=crop'
  },
  {
    type: 'lost',
    title: 'Textbook - Economics 101',
    description: 'Lost my Economics textbook, 5th edition. Has my name written on the first page.',
    location: 'Study Room 3',
    date: '2024-03-07',
    reporter: 'James Wilson',
    reporterId: 'dummy9',
    status: 'open',
    createdAt: Date.now() - 9000000,
    image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'House Keys',
    description: 'Found a set of house keys with a red keychain near the parking lot.',
    location: 'Parking Area B',
    date: '2024-03-06',
    reporter: 'Emily Brown',
    reporterId: 'dummy10',
    status: 'open',
    createdAt: Date.now() - 10000000,
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop'
  },
  {
    type: 'lost',
    title: 'Wireless Mouse',
    description: 'Lost my Logitech wireless mouse in black color. Has a small scratch on the scroll wheel.',
    location: 'Library Computer Area',
    date: '2024-03-05',
    reporter: 'Tom Anderson',
    reporterId: 'dummy11',
    status: 'open',
    createdAt: Date.now() - 11000000,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop'
  },
  {
    type: 'found',
    title: 'Prescription Sunglasses',
    description: 'Found Ray-Ban prescription sunglasses in a black case.',
    location: 'Cafeteria',
    date: '2024-03-04',
    reporter: 'Sophie Martinez',
    reporterId: 'dummy12',
    status: 'open',
    createdAt: Date.now() - 12000000,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop'
  }
];