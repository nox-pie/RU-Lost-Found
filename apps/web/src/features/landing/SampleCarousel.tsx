import { ChevronLeft, ChevronRight, MapPin, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '../../components/ui/misc';
import { CATEGORY_ICONS } from '../../lib/categories';
import { CATEGORY_LABELS, ITEM_STATUS } from '../../lib/format';
import { useInView, usePrefersReducedMotion } from '../../lib/hooks';
import { SAMPLE_POSTS, type SamplePost } from './samplePosts';

const SLIDE_MS = 4500;

/** True once the visitor has scrolled, pointed, touched or pressed a key on the page. */
function useFirstInteraction(): boolean {
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (engaged) return;
    const events = ['scroll', 'pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
    const engage = () => setEngaged(true);
    for (const event of events)
      window.addEventListener(event, engage, { once: true, passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, engage);
    };
  }, [engaged]);
  return engaged;
}

/**
 * Sample posts, one at a time, as they look in the app. Moves on by itself while visible
 * (never for people who reduce motion), pauses on hover or keyboard focus, and has a pause
 * button (WCAG 2.2.2).
 */
export function SampleCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const engaged = useFirstInteraction();
  const [hovered, setHovered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const root = useRef<HTMLElement>(null);
  const visible = useInView(root);
  const count = SAMPLE_POSTS.length;
  // Nothing moves until the visitor does something (scrolls, points, touches, types): they
  // read the headline first, and the page settles before any motion.
  const playing = engaged && !paused && !reducedMotion && !hovered && visible;
  const current = SAMPLE_POSTS[index] as SamplePost;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [playing, index, count]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Sample posts"
      className="relative mx-auto w-full max-w-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="relative">
        {/* Two cards peeking out behind, for depth. */}
        <div
          className="absolute inset-x-6 -bottom-3 top-6 rotate-3 rounded-3xl bg-white/40 backdrop-blur-xs"
          aria-hidden
        />
        <div
          className="absolute inset-x-3 -bottom-1.5 top-3 -rotate-2 rounded-3xl bg-white/60 backdrop-blur-xs"
          aria-hidden
        />

        <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {SAMPLE_POSTS.map((post, i) => (
              <div
                key={post.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={i !== index}
                className="w-full shrink-0"
              >
                <PostCard post={post} eager={i === 0} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-center gap-2">
        <ControlButton label="Previous post" onClick={() => go(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </ControlButton>
        <div className="flex items-center gap-0.5">
          {SAMPLE_POSTS.map((post, i) => (
            <button
              key={post.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show post ${i + 1}: ${post.title}`}
              aria-current={i === index}
              className="group flex h-6 min-w-6 items-center justify-center rounded-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
            >
              {/* A small dot inside a 24 px target, big enough to tap. */}
              <span
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 group-hover:bg-white/80'}`}
              />
            </button>
          ))}
        </div>
        <ControlButton label="Next post" onClick={() => go(1)}>
          <ChevronRight className="h-4 w-4" />
        </ControlButton>
        {!reducedMotion && (
          <ControlButton
            label={paused ? 'Play the posts' : 'Pause the posts'}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </ControlButton>
        )}
      </div>

      {/* Announced only when people move through the posts themselves, not while playing. */}
      <p className="sr-only" aria-live={playing ? 'off' : 'polite'}>
        Post {index + 1} of {count}: {current.type === 'LOST' ? 'Lost' : 'Found'}, {current.title},{' '}
        {current.place}
      </p>
    </section>
  );
}

function PostCard({ post, eager }: { post: SamplePost; eager: boolean }) {
  const status = ITEM_STATUS[post.status];
  const Icon = CATEGORY_ICONS[post.category];
  return (
    <article>
      <div className="relative aspect-4/3 bg-gray-100">
        <img
          src={post.photo}
          alt=""
          width={640}
          height={480}
          loading={eager ? 'eager' : 'lazy'}
          className="h-full w-full object-cover"
        />
        <span
          className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ${post.type === 'LOST' ? 'bg-primary text-primary-contrast' : 'bg-secondary text-secondary-contrast'}`}
        >
          {post.type === 'LOST' ? 'Lost' : 'Found'}
        </span>
        {post.status !== 'OPEN' && (
          <span className="absolute left-3 top-3">
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {CATEGORY_LABELS[post.category]}
        </p>
        <p className="mt-1.5 line-clamp-1 text-lg font-semibold text-gray-900">{post.title}</p>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{post.place}</span>
          </span>
          <span className="shrink-0 pl-3">{post.when}</span>
        </div>
      </div>
    </article>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
    >
      {children}
    </button>
  );
}
