import { ArrowRight, Bell, Flag, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Footer } from '../../components/layout/Footer';
import { brand } from '../../brand/brand.config';
import { DemoPersonaCards } from '../demo/DemoSignIn';
import { HandoverStory } from './HandoverStory';
import { SampleCarousel } from './SampleCarousel';

/** What a signed-out visitor sees at the home page: what the portal does and how to start. */
export default function LandingPage() {
  useScrollToHash();
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

/** Links like /#demo (from the footer or other pages) land on their section once it's drawn. */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
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
    <section className="relative isolate overflow-hidden">
      {/* The campus, with a dark wash on the reading side so white text stays legible. */}
      <img
        src="/landing/campus-1280.webp"
        srcSet="/landing/campus-768.webp 768w, /landing/campus-1280.webp 1280w, /landing/campus-1920.webp 1920w"
        sizes="100vw"
        alt=""
        width={1920}
        height={1027}
        // The largest thing on screen: fetch it first. (React 18 only passes the lowercase
        // HTML attribute through; React 19 adds `fetchPriority`.)
        {...({ fetchpriority: 'high' } as Record<string, string>)}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_65%]"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/75 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/55 lg:to-black/25"
        aria-hidden
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:py-24">
        <div className="text-center text-white lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/90">
            {brand.organisation.name}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Lost something on campus? Found something?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/90 lg:mx-0">
            Post it with a photo, find it in one place, and get it back through a checked handover:
            the owner proves it is theirs, and the item is marked returned only when you meet.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="#demo"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-white shadow-lg hover:bg-primary-dark"
            >
              Try the demo <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/70 bg-white/10 px-7 font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              See how it works
            </a>
          </div>
        </div>
        <SampleCarousel />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-4 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            From “I lost it” to “I got it back”
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Follow one wallet through the portal, from the moment it goes missing to the handover.
          </p>
        </div>
        <HandoverStory />
      </div>
    </section>
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
        <p className="mx-auto mt-3 max-w-xl text-white">{brand.emailHint}</p>
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
