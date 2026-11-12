import { describe, expect, it } from 'vitest';
import { createStudioStore, DESIGNS_KEY, SETTINGS_KEY, UNDO_LIMIT, type KVStorage } from './store';
import { createDesign } from '../presets';

class FakeStorage implements KVStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** a controllable clock */
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('undo / redo', () => {
  it('coalesces rapid changes from the same control into one undo step', () => {
    const c = clock();
    const store = createStudioStore({ storage: null, now: c.now });
    const s = () => store.getState();
    s().open(createDesign({ sizeMm: 300 }));

    // one slider drag: many updates with the same key in quick succession
    for (let i = 1; i <= 20; i++) {
      c.advance(16);
      s().update((d) => { d.sizeMm = 300 + i; }, { coalesceKey: 'size' });
    }
    expect(s().design!.sizeMm).toBe(320);
    expect(s().past.length).toBe(1);

    // a different control is a new step
    c.advance(16);
    s().update((d) => { d.triangles.lineMm = 1; }, { coalesceKey: 'line' });
    expect(s().past.length).toBe(2);

    // the same key after a pause is a new step too
    c.advance(5000);
    s().update((d) => { d.triangles.lineMm = 2; }, { coalesceKey: 'line' });
    expect(s().past.length).toBe(3);

    s().undo();
    expect(s().design!.triangles.lineMm).toBe(1);
    s().undo();
    expect(s().design!.triangles.lineMm).toBe(0.5);
    expect(s().design!.sizeMm).toBe(320);
    s().undo();
    expect(s().design!.sizeMm).toBe(300);
    expect(s().past.length).toBe(0);

    s().redo();
    expect(s().design!.sizeMm).toBe(320);
    s().redo();
    s().redo();
    expect(s().design!.triangles.lineMm).toBe(2);
    expect(s().future.length).toBe(0);
  });

  it('never mutates earlier states and caps the history', () => {
    const c = clock();
    const store = createStudioStore({ storage: null, now: c.now });
    const s = () => store.getState();
    s().open(createDesign());
    const first = s().design!;
    s().update((d) => { d.bands.pop(); });
    expect(first.bands.length).toBe(s().design!.bands.length + 1);

    for (let i = 0; i < UNDO_LIMIT + 30; i++) {
      c.advance(10);
      s().update((d) => { d.sizeMm = 100 + i; });
    }
    expect(s().past.length).toBe(UNDO_LIMIT);
  });

  it('a new change clears the redo stack', () => {
    const store = createStudioStore({ storage: null });
    const s = () => store.getState();
    s().open(createDesign());
    s().update((d) => { d.name = 'A'; });
    s().undo();
    expect(s().future.length).toBe(1);
    s().update((d) => { d.name = 'B'; });
    expect(s().future.length).toBe(0);
  });
});

describe('library persistence', () => {
  it('autosaves the open design and loads it back in a new session', () => {
    const storage = new FakeStorage();
    const a = createStudioStore({ storage });
    a.getState().open(createDesign({ name: 'Temple plate', sizeMm: 222 }));
    a.getState().update((d) => { d.guides.marma = true; });
    a.flush();

    const raw = storage.getItem(DESIGNS_KEY);
    expect(raw).toBeTruthy();

    const b = createStudioStore({ storage });
    const lib = b.getState().library;
    expect(lib.length).toBe(1);
    expect(lib[0].name).toBe('Temple plate');
    expect(lib[0].sizeMm).toBe(222);
    expect(lib[0].guides.marma).toBe(true);
    expect(lib[0]).toEqual(a.getState().design);
  });

  it('renames, duplicates and deletes saved designs', () => {
    const storage = new FakeStorage();
    const a = createStudioStore({ storage });
    a.getState().open(createDesign({ name: 'One' }));
    a.getState().saveNow();
    const id = a.getState().library[0].id;
    a.getState().rename(id, '  Two  ');
    expect(a.getState().library[0].name).toBe('Two');
    const copy = a.getState().duplicate(id)!;
    expect(copy.id).not.toBe(id);
    expect(a.getState().library.length).toBe(2);
    a.getState().remove(id);
    const b = createStudioStore({ storage });
    expect(b.getState().library.map((d) => d.id)).toEqual([copy.id]);
  });

  it('survives corrupt JSON and ignores unknown schemas', () => {
    const storage = new FakeStorage();
    storage.setItem(SETTINGS_KEY, '{not json');
    storage.setItem(DESIGNS_KEY, JSON.stringify({ version: 1, designs: [{ schema: 99, id: 'x' }, createDesign({ name: 'Good' }), null, 'junk'] }));
    const s = createStudioStore({ storage }).getState();
    expect(s.settings.lang).toBe('en');
    expect(s.library.map((d) => d.name)).toEqual(['Good']);

    storage.setItem(DESIGNS_KEY, 'garbage{');
    expect(createStudioStore({ storage }).getState().library).toEqual([]);
  });

  it('persists settings', () => {
    const storage = new FakeStorage();
    createStudioStore({ storage }).getState().setLang('hi');
    expect(createStudioStore({ storage }).getState().settings.lang).toBe('hi');
  });
});
