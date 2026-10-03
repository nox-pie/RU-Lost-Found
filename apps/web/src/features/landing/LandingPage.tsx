import {
  ArrowRight,
  Bell,
  Camera,
  Flag,
  KeyRound,
  Lock,
  MapPin,
  MessageCircleQuestion,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { ItemStatus, ItemType } from '@ru-lost-found/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Footer } from '../../components/layout/Footer';
import { Badge } from '../../components/ui/misc';
import { ITEM_STATUS } from '../../lib/format';
import { brand } from '../../brand/brand.config';
import { DemoPersonaCards } from '../demo/DemoSignIn';

/** What a signed-out visitor sees at the home page: what the portal does and how to start. */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <TopBar />
      <main className="flex-grow">
        <Hero />
        <HowItWorks />
        <TryTheDemo />
        <Safeguards />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="header-solid shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-white p-1.5">
            <img src={brand.images.symbol} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="truncate font-display text-lg font-bold text-white sm:text-xl">
            {brand.productName}
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Account">
          <Link
            to="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-surface sm:inline-block"
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
      <div className="text-center lg:text-left">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          {brand.organisation.name}
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
          Lost something on campus? Found something?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600 lg:mx-0">
          Post it with a photo, find it in one place, and get it back through a checked handover:
          the owner proves it is theirs, and the item is marked returned only when you meet.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
          <a
            href="#demo"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            Try the demo <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            to="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full border border-gray-300 bg-white px-7 font-semibold text-gray-800 hover:bg-gray-50"
          >
            Create your account
          </Link>
        </div>
      </div>
      <SamplePosts />
    </section>
  );
}

const PREVIEW: {
  photo: string;
  type: ItemType;
  title: string;
  place: string;
  status: ItemStatus;
}[] = [
  {
    photo: '/demo/black-bifold-wallet.jpg',
    type: 'FOUND',
    title: 'Black bifold wallet',
    place: 'Library reading room',
    status: 'OPEN',
  },
  {
    photo: '/demo/camera-backpack.jpg',
    type: 'FOUND',
    title: 'Black camera backpack',
    place: 'Campus bus stop',
    status: 'RESERVED',
  },
  {
    photo: '/demo/brass-keys.jpg',
    type: 'FOUND',
    title: 'Bunch of brass keys',
    place: 'Hostel laundry',
    status: 'RESOLVED',
  },
];

/** Three posts from the sample data, as the feed shows them (a picture, not live data). */
function SamplePosts() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mr-0 lg:max-w-lg" aria-hidden>
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {PREVIEW.map((post, index) => (
          <div
            key={post.title}
            className={`overflow-hidden rounded-2xl bg-white shadow-card ${index === 0 ? 'col-span-2' : ''}`}
          >
            <div
              className={`relative bg-gray-100 ${index === 0 ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}
            >
              <img src={post.photo} alt="" className="h-full w-full object-cover" />
              <span
                className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow ${post.type === 'LOST' ? 'bg-primary' : 'bg-secondary'}`}
              >
                {post.type === 'LOST' ? 'Lost' : 'Found'}
              </span>
              {post.status !== 'OPEN' && (
                <span className="absolute bottom-3 left-3">
                  <Badge tone={ITEM_STATUS[post.status].tone}>
                    {ITEM_STATUS[post.status].label}
                  </Badge>
                </span>
              )}
            </div>
            <div className="p-3 sm:p-4">
              <p className="line-clamp-1 font-semibold text-gray-900">{post.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{post.place}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: Camera,
    title: 'Post it',
    text: 'Lost or found something? Add a photo, the place and the day. A finder can add a question that only the real owner can answer.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Claim it',
    text: 'The owner finds the post and answers the question. The finder compares the answers and approves the right person.',
  },
  {
    icon: KeyRound,
    title: 'Hand it over',
    text: 'You meet on campus. The owner shows a 6-digit code, the finder enters it, and the item is marked returned.',
  },
];

function HowItWorks() {
  return (
    <Section title="How it works" intro="Three steps from “I lost it” to “I got it back”.">
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-gray-400">Step {index + 1}</span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-gray-900">{step.title}</h3>
            <p className="mt-2 text-gray-600">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function TryTheDemo() {
  return (
    <section id="demo" className="scroll-mt-4 bg-white/60 py-16">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          Try it now, no sign-up
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
          Sign in as one of two sample students and walk through a real claim. For the whole story,
          claim the wallet as Ravi, then sign out and approve his claim as Asha.
        </p>
        <div className="mt-10">
          <DemoPersonaCards />
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-sm text-gray-500">
          Demo accounts are shared by every visitor and the sample posts reset every hour. They
          can’t post, edit or remove items, or change their profile.
        </p>
      </div>
    </section>
  );
}

const SAFEGUARDS = [
  {
    icon: UserCheck,
    title: 'Owners prove it',
    text: 'Questions about details only the owner knows, like the name on a card inside.',
  },
  {
    icon: KeyRound,
    title: 'Checked handovers',
    text: 'An item is marked returned only when the finder enters the owner’s code in person.',
  },
  {
    icon: ShieldCheck,
    title: 'Security desk',
    text: 'Finders can leave items at the campus security desk instead of meeting.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    text: 'In-app and email updates when someone claims, approves or hands over.',
  },
  {
    icon: Lock,
    title: 'Your number stays private',
    text: 'A phone number is shared only if you choose to, on an approved claim.',
  },
  {
    icon: Flag,
    title: 'Moderated',
    text: 'Anyone can report a post; admins review reports and remove spam.',
  },
];

function Safeguards() {
  return (
    <Section title="Built so items reach the right person">
      <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {SAFEGUARDS.map((item) => (
          <li key={item.title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary-dark">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-sans font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function GetStarted() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="rounded-3xl bg-primary px-6 py-12 text-center text-white shadow-card sm:px-12">
        <h2 className="font-display text-3xl font-bold">Ready to use it for real?</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85">{brand.emailHint}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 font-semibold text-primary hover:bg-surface"
          >
            Create your account
          </Link>
          <Link
            to="/login"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/60 px-7 font-semibold text-white hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 text-gray-600">{intro}</p>}
      </div>
      {children}
    </section>
  );
}
