import { DEMO_PERSONAS, type ItemDto } from '@ru-lost-found/shared';
import { Bell, Check, CheckCircle2, MessageCircleQuestion, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { Input, Textarea } from '../../components/ui/Field';
import { Avatar, Badge } from '../../components/ui/misc';
import { CATEGORY_OPTIONS } from '../../lib/categories';
import { ItemCardPreview } from '../items/ItemCard';

/**
 * The scenes of the landing page's story. Each is drawn from its elapsed time `t` (ms): what
 * has been typed so far, which button is being pressed, which digits have appeared. They use
 * the app's own components (item card, inputs, dropdown, badges, buttons), so the story shows
 * the real product.
 */
export interface Scene {
  /** Where the browser would be. */
  path: string;
  /** How long the scene plays before it rests on its last frame. */
  duration: number;
  render: (t: number) => ReactNode;
}

const CODE = '482193';
const [ASHA_PICTURE, RAVI_PICTURE] = DEMO_PERSONAS.map((persona) => persona.avatarUrl);

/** The part of `text` typed by `t`, starting at `start`, `perSecond` characters a second. */
function typed(text: string, t: number, start: number, perSecond = 14): string {
  const count = Math.floor(((t - start) / 1000) * perSecond);
  return text.slice(0, Math.max(0, Math.min(text.length, count)));
}

const typingDone = (text: string, start: number, perSecond = 14) =>
  start + (text.length / perSecond) * 1000;

const item = (overrides: Partial<ItemDto>): ItemDto =>
  ({
    id: 'sample',
    type: 'FOUND',
    status: 'OPEN',
    category: 'WALLET',
    title: 'Black bifold wallet',
    description: 'Found on a table in the library reading room after the evening session.',
    location: 'Library reading room',
    occurredOn: '2026-10-03',
    photos: ['/landing/black-bifold-wallet.webp'],
    heldAtSecurityDesk: false,
    isSample: false,
    ...overrides,
  }) as ItemDto;

const WALLET = item({});

/** A button that looks pressed for a moment at `at`. */
function pressed(t: number, at: number): string {
  return t >= at && t < at + 260 ? 'scale-95 brightness-90' : '';
}

/** The app's success toast, shown from `show` on. */
function toast(show: boolean, children: ReactNode): ReactNode {
  if (!show) return null;
  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 shadow-lg animate-slide-down">
      <CheckCircle2 className="h-4 w-4" /> {children}
    </div>
  );
}

/** A blinking text cursor while typing. */
function caret(show: boolean): ReactNode {
  return show ? (
    <span className="ml-px inline-block h-4 w-px animate-pulse bg-gray-900 align-middle" />
  ) : null;
}

/* ---------- 1. Ravi searches ---------- */

const SEARCH = 'wallet';

const searchScene: Scene = {
  path: '/',
  duration: 4600,
  render: (t) => {
    const query = typed(SEARCH, t, 400, 7);
    const results = t >= typingDone(SEARCH, 400, 7) + 300;
    const picked = t >= 3400;
    return (
      <div className="space-y-4">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <div className="w-full rounded-full border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm shadow-xs ring-2 ring-primary/40">
            {query || <span className="text-gray-400">Search by name, place or description</span>}
            {caret(!results)}
          </div>
        </div>
        {results && (
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3 animate-rise">
            <ItemCardPreview
              item={WALLET}
              className={`transition ${picked ? 'scale-[1.03] ring-2 ring-primary' : ''}`}
            />
            <ItemCardPreview
              item={item({
                title: 'Brown leather wallet',
                location: 'Auditorium',
                status: 'RESOLVED',
                photos: ['/demo/worn-leather-wallet.jpg'],
              })}
              className="opacity-70"
            />
          </div>
        )}
      </div>
    );
  },
};

/* ---------- 2. Asha posts it ---------- */

const TITLE = 'Black bifold wallet';
const QUESTION = 'What is the name on the library card inside?';

const reportScene: Scene = {
  path: '/  ·  Report an item',
  duration: 6400,
  render: (t) => {
    const photo = t >= 500;
    const title = typed(TITLE, t, 900, 18);
    const category = t >= 2300;
    const question = typed(QUESTION, t, 2800, 26);
    const publishAt = 5000;
    return (
      <div className="relative rounded-2xl bg-white p-4 shadow-xs">
        {toast(t >= publishAt + 350, 'Your report is published')}
        <p className="font-display text-lg font-semibold text-gray-900">Report an item</p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-center text-sm font-medium">
          <span className="rounded-lg py-1.5 text-gray-600">I lost something</span>
          <span className="rounded-lg bg-secondary py-1.5 text-secondary-contrast shadow-sm">
            I found something
          </span>
        </div>
        <div className="mt-3 flex gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
            {photo && (
              <img
                src={WALLET.photos[0]}
                alt=""
                className="h-full w-full object-cover animate-fade-in"
              />
            )}
          </div>
          <div className="grid flex-1 gap-2">
            <Input label="Item name" value={title} readOnly />
            <Dropdown
              label="Category"
              value={category ? 'WALLET' : ''}
              onChange={() => undefined}
              options={CATEGORY_OPTIONS}
            />
          </div>
        </div>
        <div className="mt-3">
          <Input label="Question for the owner" value={question} readOnly />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" className={`transition ${pressed(t, publishAt)}`}>
            Publish report
          </Button>
        </div>
      </div>
    );
  },
};

/* ---------- 3. Ravi claims it ---------- */

const ANSWER = 'Ravi Singh';
const MESSAGE = 'I lost it after the evening session.';

const claimScene: Scene = {
  path: '/items/black-bifold-wallet',
  duration: 5600,
  render: (t) => {
    const answer = typed(ANSWER, t, 500, 12);
    const message = typed(MESSAGE, t, 1600, 26);
    const sendAt = 3600;
    const sent = t >= sendAt + 300;
    return (
      <div className="relative grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {toast(sent, 'Claim sent to Asha')}
        <ItemCardPreview item={WALLET} className="hidden sm:flex" />
        <div className="rounded-2xl bg-white p-4 shadow-xs">
          <p className="font-display text-lg font-semibold text-gray-900">This is mine</p>
          <div className="mt-3 space-y-2.5">
            <Input label={QUESTION} value={answer} readOnly />
            <Textarea label="Message" value={message} readOnly rows={2} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            {sent ? (
              <Badge tone="info">Waiting for reply</Badge>
            ) : (
              <span className="text-xs text-gray-500">Only Asha sees your answer.</span>
            )}
            <Button className={`transition ${pressed(t, sendAt)}`}>Send</Button>
          </div>
        </div>
      </div>
    );
  },
};

/* ---------- 4. Asha approves, Ravi gets a code ---------- */

const approveScene: Scene = {
  path: '/claims/ravi-singh',
  duration: 6200,
  render: (t) => {
    const notified = t >= 300;
    const opened = t >= 1100;
    const approveAt = 2500;
    const approved = t >= approveAt + 300;
    const digits = Math.max(0, Math.min(6, Math.floor((t - 3200) / 300) + 1));
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Avatar name="Asha Verma" url={ASHA_PICTURE} size="sm" /> Asha
            </p>
            <span className="relative text-gray-600">
              <Bell className="h-5 w-5" />
              {notified && !opened && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-contrast animate-fade-in">
                  1
                </span>
              )}
            </span>
          </div>
          {opened ? (
            <div className="space-y-2.5 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Avatar name="Ravi Singh" url={RAVI_PICTURE} size="sm" />
                <p className="text-sm font-medium text-gray-900">Ravi Singh</p>
                <span className="ml-auto">
                  {approved ? (
                    <Badge tone="success">Approved</Badge>
                  ) : (
                    <Badge tone="info">Waiting for reply</Badge>
                  )}
                </span>
              </div>
              <div className="rounded-xl bg-gray-50 p-2.5 text-sm">
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MessageCircleQuestion className="h-3.5 w-3.5" /> {QUESTION}
                </p>
                <p className="mt-1 font-semibold text-gray-900">{ANSWER}</p>
              </div>
              <Button className={`w-full transition ${pressed(t, approveAt)}`}>Approve</Button>
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              {notified ? 'New claim on “Black bifold wallet”' : 'No new notifications'}
            </p>
          )}
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-xs">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Avatar name="Ravi Singh" url={RAVI_PICTURE} size="sm" /> Ravi
          </p>
          <p className="text-sm font-medium text-gray-900">Your handover code</p>
          <div className="flex gap-1.5">
            {CODE.split('').map((digit, i) => (
              <span
                key={i}
                className={`flex h-10 w-8 items-center justify-center rounded-lg font-mono text-lg font-bold transition ${approved && i < digits ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-transparent'}`}
              >
                {approved && i < digits ? digit : '·'}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {approved ? 'Show it to Asha when you meet.' : 'You’ll get a code once Asha approves.'}
          </p>
        </div>
      </div>
    );
  },
};

/* ---------- 5. They meet: the code, and the wallet is returned ---------- */

const handoverScene: Scene = {
  path: '/claims/ravi-singh',
  duration: 5400,
  render: (t) => {
    const entered = Math.max(0, Math.min(6, Math.floor((t - 400) / 320) + 1));
    const confirmAt = 2700;
    const done = t >= confirmAt + 350;
    return (
      <div className="relative grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {toast(done, 'Handed over. Thanks, Asha!')}
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-xs">
          <p className="font-display text-lg font-semibold text-gray-900">Confirm the handover</p>
          <p className="text-sm text-gray-600">Enter the code Ravi shows you.</p>
          <div className="flex gap-1.5">
            {CODE.split('').map((digit, i) => (
              <span
                key={i}
                className={`flex h-11 w-9 items-center justify-center rounded-lg border-2 bg-white font-mono text-lg font-bold transition ${i < entered ? (done ? 'border-green-500 text-gray-900' : 'border-primary/50 text-gray-900') : 'border-gray-200 text-transparent'}`}
              >
                {i < entered ? digit : '·'}
              </span>
            ))}
          </div>
          <Button className={`transition ${pressed(t, confirmAt)}`}>
            {done ? (
              <>
                <Check className="h-4 w-4" /> Confirmed
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
        <ItemCardPreview
          item={done ? { ...WALLET, status: 'RESOLVED' } : { ...WALLET, status: 'RESERVED' }}
          className="hidden sm:flex"
        />
      </div>
    );
  },
};

export const SCENES: readonly Scene[] = [
  searchScene,
  reportScene,
  claimScene,
  approveScene,
  handoverScene,
];
