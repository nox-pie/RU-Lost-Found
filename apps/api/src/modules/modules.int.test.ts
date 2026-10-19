import { describe, expect, it } from 'vitest';
import { useTestApp } from '../testing/testApp';
import { isDomainEventType } from './events';

const t = useTestApp();

const duplicates = (names: string[]) => names.filter((name, i) => names.indexOf(name) !== i);

describe('the modules', () => {
  it('each have their own name, and so do their event handlers and jobs', () => {
    const { modules } = t.container;
    // Handler names record which handlers already processed an event; job names are their
    // leases. A duplicate would silently skip work.
    expect(duplicates(modules.map((module) => module.name))).toEqual([]);
    expect(duplicates(modules.flatMap((m) => (m.handlers ?? []).map((h) => h.name)))).toEqual([]);
    expect(duplicates(modules.flatMap((m) => (m.jobs ?? []).map((j) => j.name)))).toEqual([]);
  });

  it('only react to events that exist in the catalogue (a misspelt name would never fire)', () => {
    const handled = t.container.modules.flatMap((m) =>
      (m.handlers ?? []).flatMap((h) => h.handles),
    );
    expect(handled.filter((type) => !isDomainEventType(type))).toEqual([]);
  });
});
