import { ArrowRight, Check, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInView, usePrefersReducedMotion } from '../../lib/hooks';
import { AppWindow } from './AppWindow';
import { SCENES, type Scene } from './storyScenes';

/** How long a scene rests on its last frame before the next one starts. */
const REST_MS = 1800;
const TICK_MS = 50;

/** The whole flow as a short story with the two demo students, Asha (finder) and Ravi (owner). */
const STEPS = [
  {
    title: 'Ravi searches for his wallet',
    text: 'He left it on a table in the library. He opens the portal and searches “wallet”.',
  },
  {
    title: 'Asha found it, and posts it',
    text: 'A photo, the place, and a question only the real owner can answer.',
  },
  {
    title: 'Ravi claims it',
    text: 'He answers Asha’s question. She is told in the app and by email.',
  },
  {
    title: 'Asha approves, Ravi gets a code',
    text: 'The answer is right, so Asha approves. Ravi receives a 6-digit handover code.',
  },
  {
    title: 'They meet, the wallet goes home',
    text: 'Asha enters Ravi’s code. Only then is the wallet marked returned.',
  },
] as const;

/**
 * Plays the story scene by scene while it is on screen: typing, button presses and codes as
 * in the real app. A pause button stops it (WCAG 2.2.2); for people who reduce motion it doesn't
 * play at all and each step shows its finished screen.
 */
export function HandoverStory() {
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, 0.25);
  const playing = !paused && !reducedMotion && visible;
  const scene = SCENES[active] as Scene;
  const total = scene.duration + REST_MS;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - last; // read before `last` moves on: the update below runs later
      last = now;
      setElapsed((value) => value + delta);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (elapsed < total) return;
    setActive((index) => (index + 1) % STEPS.length);
    setElapsed(0);
  }, [elapsed, total]);

  const show = (index: number) => {
    setActive(index);
    setElapsed(0);
  };
  // Without motion, a step shows its finished screen.
  const t = reducedMotion ? scene.duration : elapsed;
  const progress = Math.min(1, elapsed / total);
  const step = STEPS[active] ?? STEPS[0];

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
          onClick={() => setPaused((value) => !value)}
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
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-12"
    >
      <div>
        {/* Phones: a compact row of steps and the active one's text, right above its scene. */}
        <div className="lg:hidden">
          <div role="group" aria-label="Steps" className="flex justify-center gap-2">
            {STEPS.map((item, i) => (
              <button
                key={item.title}
                type="button"
                onClick={() => show(i)}
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
                  onClick={() => show(i)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`relative w-full overflow-hidden rounded-2xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? 'bg-white shadow-card ring-1 ring-black/5' : 'hover:bg-white/60'}`}
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
                  {isActive && !reducedMotion && (
                    <span
                      className="absolute bottom-0 left-0 h-1 bg-primary/70"
                      style={{ width: `${progress * 100}%` }}
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

      {/* A picture of the active step; its words are in the list above (read by screen readers). */}
      <div aria-hidden {...({ inert: '' } as Record<string, string>)}>
        <AppWindow path={scene.path}>
          <div key={active} className="animate-fade-in">
            {scene.render(t)}
          </div>
        </AppWindow>
      </div>

      {controls('justify-center lg:hidden')}
    </div>
  );
}
