import {
  ArrowRight,
  Camera,
  Check,
  KeyRound,
  MapPin,
  MessageCircleQuestion,
  Pause,
  Play,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../../components/ui/misc';
import { useInView, usePrefersReducedMotion } from '../../lib/hooks';

const STEP_MS = 6000;
const CODE = ['4', '8', '2', '1', '9', '3'];

interface Step {
  title: string;
  text: string;
  icon: typeof Camera;
  scene: () => ReactNode;
}

/** The whole flow as a short story with the two demo students, Asha (finder) and Ravi (owner). */
const STEPS: Step[] = [
  {
    title: 'Ravi loses his wallet',
    text: 'He left it on a table in the library reading room. He opens the portal and searches for it.',
    icon: Search,
    scene: LostScene,
  },
  {
    title: 'Asha finds it and posts it',
    text: 'A photo, the place, and a question only the real owner can answer. Nothing private is shown.',
    icon: Camera,
    scene: PostedScene,
  },
  {
    title: 'Ravi claims it',
    text: 'He answers Asha’s question. She is notified in the app and by email.',
    icon: MessageCircleQuestion,
    scene: ClaimScene,
  },
  {
    title: 'Asha approves, Ravi gets a code',
    text: 'The answer matches, so Asha approves. Ravi receives a 6-digit handover code.',
    icon: KeyRound,
    scene: ApproveScene,
  },
  {
    title: 'They meet, the wallet goes home',
    text: 'Asha enters Ravi’s code when they meet. Only then is the wallet marked returned.',
    icon: ShieldCheck,
    scene: ReturnedScene,
  },
];

export function HandoverStory() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root);
  const playing = !paused && !reducedMotion && !hovered && visible;
  const step = STEPS[active] as Step;
  const Scene = step.scene;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, active]);

  const controls = (className: string) => (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href="#demo"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
      >
        Try it yourself <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-gray-700 hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {paused ? (
            <>
              <Play className="h-4 w-4" aria-hidden /> Play the story
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" aria-hidden /> Pause the story
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={root}
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div>
        {/* Phones: a compact row of steps and the active one's text, right above its scene. */}
        <div className="lg:hidden">
          <div role="group" aria-label="Steps" className="flex justify-center gap-2">
            {STEPS.map((item, i) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Step ${i + 1}: ${item.title}`}
                aria-current={i === active ? 'step' : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${i === active ? 'bg-primary text-primary-contrast shadow' : i < active ? 'bg-primary/10 text-primary' : 'bg-white text-gray-500 shadow-sm'}`}
              >
                {i < active ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </button>
            ))}
          </div>
          <div key={active} className="mt-5 text-center animate-fade-in">
            <h3 className="font-sans text-lg font-semibold text-gray-900">{step.title}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{step.text}</p>
          </div>
        </div>

        <ol className="hidden space-y-2 lg:block">
          {STEPS.map((item, i) => {
            const isActive = i === active;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`relative w-full overflow-hidden rounded-2xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? 'bg-white shadow-card' : 'hover:bg-white/60'}`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${isActive ? 'bg-primary text-primary-contrast' : i < active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {i < active ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    <span
                      className={`font-sans font-semibold ${isActive ? 'text-gray-900' : 'text-gray-600'}`}
                    >
                      {item.title}
                    </span>
                  </span>
                  {isActive && (
                    <span className="mt-2 block pl-12 text-sm text-gray-600 animate-fade-in">
                      {item.text}
                    </span>
                  )}
                  {isActive && playing && (
                    <span
                      key={`progress-${active}`}
                      className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary/70 animate-progress"
                      style={{ animationDuration: `${STEP_MS}ms` }}
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        {controls('mt-5 hidden pl-1 lg:flex')}
      </div>

      {/* The scene illustrates the active step, whose text is in the list (read by screen readers). */}
      <div
        className="relative min-h-[23rem] overflow-hidden rounded-3xl bg-gradient-to-br from-white to-secondary/10 p-5 shadow-card sm:p-8"
        aria-hidden
      >
        <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <step.icon className="h-4 w-4" /> Step {active + 1} of {STEPS.length}
        </p>
        <div key={active} className="animate-rise">
          <Scene />
        </div>
      </div>

      {controls('justify-center lg:hidden')}
    </div>
  );
}

/* ---------- Scenes: small pictures of the real screens ---------- */

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 ${className}`}>
      {children}
    </div>
  );
}

function Person({ name, note }: { name: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} url={null} size="sm" />
      <div>
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{note}</p>
      </div>
    </div>
  );
}

function LostScene() {
  return (
    <div className="space-y-4">
      <Panel>
        <Person name="Ravi Singh" note="3rd year · just now" />
        <p className="mt-3 rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm text-gray-700">
          My wallet was on the table in the reading room last night. Now it’s gone.
        </p>
      </Panel>
      <Panel className="flex items-center gap-3">
        <Search className="h-5 w-5 text-gray-400" />
        <span className="text-sm text-gray-900">black wallet</span>
        <span className="ml-0.5 h-5 w-px animate-pulse bg-primary" />
        <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Found · Wallet
        </span>
      </Panel>
      <p className="flex items-center gap-1.5 text-sm text-gray-500">
        <MapPin className="h-4 w-4" /> Library reading room
      </p>
    </div>
  );
}

function PostedScene() {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="relative aspect-[16/9] bg-gray-100">
        <img
          src="/landing/black-bifold-wallet.webp"
          alt=""
          className="h-full w-full object-cover"
        />
        <span className="absolute right-3 top-3 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-contrast shadow">
          Found
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Black bifold wallet</p>
          <span className="text-xs text-gray-500">Posted by Asha · just now</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-4 w-4" /> Library reading room
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-secondary/15 px-3 py-2 text-sm text-gray-800">
          <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
          What is the name on the library card inside?
        </p>
      </div>
    </Panel>
  );
}

function ClaimScene() {
  return (
    <Panel className="space-y-4">
      <p className="font-semibold text-gray-900">“This is mine”</p>
      <div>
        <p className="text-xs font-medium text-gray-500">
          What is the name on the library card inside?
        </p>
        <p className="mt-1 rounded-xl border border-primary/40 bg-white px-3 py-2 text-sm text-gray-900 ring-2 ring-primary/15">
          Ravi Singh
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Message</p>
        <p className="mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
          I lost it last night after the evening session.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Waiting for Asha
        </span>
        <span className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          Send claim
        </span>
      </div>
    </Panel>
  );
}

function ApproveScene() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="space-y-3">
        <Person name="Asha Verma" note="Finder" />
        <p className="text-sm text-gray-700">
          Ravi answered <span className="font-semibold text-gray-900">“Ravi Singh”</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
          <Check className="h-4 w-4" /> Matches the card
        </p>
        <span className="block rounded-xl bg-primary py-2 text-center text-sm font-semibold text-white">
          Approve
        </span>
      </Panel>
      <Panel className="space-y-3">
        <Person name="Ravi Singh" note="Owner" />
        <p className="text-xs font-medium text-gray-500">Your handover code</p>
        <div className="flex gap-1.5">
          {CODE.map((digit, i) => (
            <span
              key={i}
              className="flex h-10 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-lg font-bold text-primary"
            >
              {digit}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500">Show it to Asha when you meet.</p>
      </Panel>
    </div>
  );
}

function ReturnedScene() {
  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Asha enters Ravi’s code</p>
        <div className="flex gap-1.5">
          {CODE.map((digit, i) => (
            <span
              key={i}
              className="flex h-10 w-8 items-center justify-center rounded-lg border-2 border-green-500 bg-white font-mono text-lg font-bold text-gray-900"
            >
              {digit}
            </span>
          ))}
        </div>
      </Panel>
      <Panel className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Check className="h-7 w-7" />
        </span>
        <div>
          <p className="font-semibold text-gray-900">Black bifold wallet · Returned</p>
          <p className="text-sm text-gray-600">
            Handed over in the library. Both of them get a confirmation.
          </p>
        </div>
      </Panel>
    </div>
  );
}
