import { ArrowRight, Bell, Flag, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, type RefObject } from 'react';
import { Link, useLocation } from 'react-router';
import { Footer } from '../../components/layout/Footer';
import { brand } from '../../brand/brand.config';
import { useInView } from '../../lib/hooks';
import { DemoPersonaCards } from '../demo/DemoSignIn';
import { useShowDemo } from '../demo/demoStatus';
import { LandingNav } from './LandingNav';
import { Reveal, SectionHeading } from './Reveal';
import { SampleCarousel } from './SampleCarousel';

// Below the fold, and built from the app's real components (forms, dropdown, cards): loaded
// right after the first paint so they don't weigh on it.
const HandoverStory = lazy(() =>
  import('./HandoverStory').then((module) => ({ default: module.HandoverStory })),
);

/** The campus photo in three sizes; the browser picks one, and reuses it further down. */
const CAMPUS_PHOTO = {
  src: '/landing/campus-1280.webp',
  srcSet:
    '/landing/campus-768.webp 768w, /landing/campus-1280.webp 1280w, /landing/campus-1920.webp 1920w',
  sizes: '100vw',
};

/**
 * What a signed-out visitor sees at the home page. One rhythm (photo, light, dark, light,
 * photo) and a small motion budget: sections fade up once, the post carousel, the story, and a
 * slow zoom in the last card. All of it stops for people who reduce motion.
 */
export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  useScrollToHash();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <LandingNav heroRef={heroRef} />
      <main className="grow">
        <Hero heroRef={heroRef} />
        <HowItWorks />
        <TryTheDemo />
        <Safeguards />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
}

/** Links like /#demo (from other pages) land on their section once it's drawn. */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
}

function Hero({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) {
  const showDemo = useShowDemo();
  return (
    <section
      ref={heroRef}
      className="relative isolate flex min-h-[92svh] items-center overflow-hidden"
    >
      {/* The campus, with a dark wash on the reading side so white text stays legible. */}
      <img
        {...CAMPUS_PHOTO}
        alt=""
        width={1920}
        height={1027}
        // The largest thing on screen: fetch it first.
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_65%]"
      />
      <div
        className="absolute inset-0 -z-10 bg-linear-to-b from-black/70 via-black/55 to-black/80 lg:bg-linear-to-r lg:from-black/80 lg:via-black/55 lg:to-black/30"
        aria-hidden
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pb-20 lg:pt-32">
        <div className="text-center text-white lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/90">
            {brand.organisation.name}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl sm:leading-none lg:text-6xl">
            Lost something on campus? Found something?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/90 lg:mx-0">
            Post it with a photo, find it in one place, and get it back through a checked handover:
            the owner proves it is theirs, and the item is marked returned only when you meet.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            {showDemo ? (
              <a href="#demo" className={HERO_ACTION}>
                Try the demo <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Link to="/signup" className={HERO_ACTION}>
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/70 bg-white/10 px-7 font-semibold text-white backdrop-blur-sm hover:bg-white/20"
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

const HERO_ACTION =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-white shadow-lg hover:bg-primary-dark';

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From “I lost it” to “I got it back”"
            intro="Follow one wallet through the portal, from the moment it goes missing to the handover."
          />
        </Reveal>
        <Reveal>
          <Suspense fallback={<div className="min-h-136" aria-hidden />}>
            <HandoverStory />
          </Suspense>
        </Reveal>
      </div>
    </section>
  );
}

function TryTheDemo() {
  if (!useShowDemo()) return null;
  return (
    <section
      id="demo"
      className="relative isolate scroll-mt-16 overflow-hidden bg-[#1d0b0e] py-20 sm:py-24"
    >
      {/* A soft glow in the brand colours, behind the cards. */}
      <div
        className="absolute left-1/2 top-1/2 -z-10 h-136 w-[min(60rem,140vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-r from-primary/40 via-primary-dark/30 to-secondary/25 blur-3xl"
        aria-hidden
      />
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            dark
            eyebrow="Try it now, no sign-up"
            title="Be Ravi, or be Asha"
            intro="Sign in as one of two sample students and walk through a real claim. For the whole story, claim the wallet as Ravi, then sign out and approve his claim as Asha."
          />
        </Reveal>
        <Reveal>
          <DemoPersonaCards />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-white/80">
            Demo accounts are shared by every visitor and the sample posts reset every hour. They
            can’t post, edit or remove items, or change their profile.
          </p>
        </Reveal>
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
    <section id="safeguards" className="scroll-mt-16 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Safeguards"
            title="Built so items reach the right person"
            intro="Every step is designed so a lost item goes back to its owner, and only to its owner."
          />
        </Reveal>
        <Reveal>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map((item) => (
              <li
                key={item.title}
                className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-sans text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{item.text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function GetStarted() {
  const card = useRef<HTMLDivElement>(null);
  // The slow zoom only runs while the card can be seen.
  const visible = useInView(card, 0.1);
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24">
      <Reveal>
        <div
          ref={card}
          className="relative isolate overflow-hidden rounded-3xl px-6 py-16 text-center text-white shadow-2xl sm:px-12 sm:py-20"
        >
          <img
            {...CAMPUS_PHOTO}
            alt=""
            loading="lazy"
            className="absolute inset-0 -z-20 h-full w-full object-cover animate-kenburns"
            style={{ animationPlayState: visible ? 'running' : 'paused' }}
          />
          <div
            className="absolute inset-0 -z-10 bg-linear-to-br from-primary-dark/95 via-primary/85 to-black/75"
            aria-hidden
          />
          <p className="text-sm font-semibold uppercase tracking-widest text-white/90">
            {brand.organisation.name}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
            Ready to use it for real?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">{brand.emailHint}</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 font-semibold text-primary shadow-lg hover:bg-surface"
            >
              Create your account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/70 px-8 font-semibold text-white hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
