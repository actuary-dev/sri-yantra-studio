/**
 * Application state (zustand): the open design with undo/redo, the saved
 * library (localStorage) and persisted UI settings.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Design } from '../core/types';
import type { ExportOptions } from '../export';

export type Lang = 'en' | 'hi';
export type Screen = 'gallery' | 'editor';

export interface Settings {
  lang: Lang;
  /** last export options used (merged over DEFAULT_EXPORT when read) */
  exportOptions: ExportOptions | null;
  /** "Type in English letters" helper on by default */
  translit: boolean;
  /** dragged corners and shapes jump onto corners, crossings, lines and circles */
  snap: boolean;
}

export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DESIGNS_KEY = 'sriyantra.designs.v1';
export const SETTINGS_KEY = 'sriyantra.settings.v1';
export const UNDO_LIMIT = 100;
/** updates with the same coalesce key closer together than this form one undo step */
export const COALESCE_MS = 1200;

export interface UpdateOptions {
  /** consecutive updates with the same key (e.g. one slider drag) become a single undo step */
  coalesceKey?: string;
}

export interface StudioState {
  screen: Screen;
  design: Design | null;
  past: Design[];
  future: Design[];
  /** saved designs, most recently changed first */
  library: Design[];
  settings: Settings;
  /** the open design has unsaved changes */
  dirty: boolean;

  /** open a design in the editor (a fresh preset copy or a saved one) */
  open(design: Design): void;
  /** back to the gallery (saves first) */
  close(): void;
  /** apply an immutable change: the recipe mutates a deep copy */
  update(recipe: (draft: Design) => void, opts?: UpdateOptions): void;
  undo(): void;
  redo(): void;
  /** write the open design into the library right now */
  saveNow(): void;
  duplicate(id: string): Design | null;
  rename(id: string, name: string): void;
  remove(id: string): void;
  setLang(lang: Lang): void;
  setExportOptions(opts: ExportOptions): void;
  setTranslit(on: boolean): void;
  setSnap(on: boolean): void;
  /** add designs read from a file; returns how many were added */
  importDesigns(list: unknown[]): Design[];
}

export interface StudioStoreOptions {
  storage?: KVStorage | null;
  autosaveMs?: number;
  now?: () => number;
}

export type StudioStore = StoreApi<StudioState> & {
  /** run any pending autosave immediately */
  flush(): void;
};

const DEFAULT_SETTINGS: Settings = { lang: 'en', exportOptions: null, translit: false, snap: true };

export function isDesign(v: unknown): v is Design {
  if (!v || typeof v !== 'object') return false;
  const d = v as Partial<Design>;
  return (
    d.schema === 1 &&
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.sizeMm === 'number' &&
    !!d.geometry &&
    typeof d.geometry === 'object' &&
    Array.isArray(d.bands) &&
    !!d.text &&
    Array.isArray(d.text.sets) &&
    !!d.style &&
    !!d.triangles &&
    !!d.cells &&
    !!d.bindu &&
    !!d.guides
  );
}

function readJson(storage: KVStorage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: KVStorage | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — keep working in memory */
  }
}

export function loadLibrary(storage: KVStorage | null): Design[] {
  const data = readJson(storage, DESIGNS_KEY);
  const list = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as { designs?: unknown }).designs : null;
  if (!Array.isArray(list)) return [];
  // unknown schemas are ignored (never crash on old/foreign data)
  return list
    .filter(isDesign)
    .map((d) => (Array.isArray(d.centre) ? d : { ...d, centre: [{ id: 'sri', type: 'sri' as const, visible: true, radius: 1 }] }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadSettings(storage: KVStorage | null): Settings {
  const data = readJson(storage, SETTINGS_KEY);
  if (!data || typeof data !== 'object') return { ...DEFAULT_SETTINGS };
  const s = data as Partial<Settings>;
  return {
    lang: s.lang === 'hi' ? 'hi' : 'en',
    exportOptions: s.exportOptions && typeof s.exportOptions === 'object' ? s.exportOptions : null,
    translit: s.translit === true,
    snap: s.snap !== false,
  };
}

export function safeLocalStorage(): KVStorage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    const k = '__sy_probe__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}

const clone = <T,>(v: T): T => structuredClone(v);

export function createStudioStore(options: StudioStoreOptions = {}): StudioStore {
  const storage = options.storage ?? null;
  const autosaveMs = options.autosaveMs ?? 500;
  const now = options.now ?? (() => Date.now());

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;
  let lastTime = 0;

  const persistLibrary = (library: Design[]) => writeJson(storage, DESIGNS_KEY, { version: 1, designs: library });
  const persistSettings = (settings: Settings) => writeJson(storage, SETTINGS_KEY, settings);

  const store = createStore<StudioState>()((set, get) => {
    const save = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const { design, library, dirty } = get();
      if (!design || !dirty) return;
      const copy = clone(design);
      const next = [copy, ...library.filter((d) => d.id !== design.id)];
      set({ library: next, dirty: false });
      persistLibrary(next);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, autosaveMs);
    };
    const breakCoalesce = () => {
      lastKey = null;
      lastTime = 0;
    };

    return {
      screen: 'gallery',
      design: null,
      past: [],
      future: [],
      library: loadLibrary(storage),
      settings: loadSettings(storage),
      dirty: false,

      open(design) {
        save();
        breakCoalesce();
        set({ design: clone(design), past: [], future: [], screen: 'editor', dirty: false });
      },

      close() {
        save();
        breakCoalesce();
        set({ screen: 'gallery', design: null, past: [], future: [] });
      },

      update(recipe, opts) {
        const cur = get().design;
        if (!cur) return;
        const draft = clone(cur);
        recipe(draft);
        draft.updatedAt = now();
        const t = now();
        const key = opts?.coalesceKey ?? null;
        const coalesce = key !== null && key === lastKey && t - lastTime < COALESCE_MS;
        lastKey = key;
        lastTime = t;
        if (coalesce) {
          set({ design: draft, future: [], dirty: true });
        } else {
          const past = [...get().past, cur];
          if (past.length > UNDO_LIMIT) past.splice(0, past.length - UNDO_LIMIT);
          set({ design: draft, past, future: [], dirty: true });
        }
        schedule();
      },

      undo() {
        const { past, design, future } = get();
        if (!design || past.length === 0) return;
        breakCoalesce();
        const prev = past[past.length - 1];
        set({ design: prev, past: past.slice(0, -1), future: [design, ...future].slice(0, UNDO_LIMIT), dirty: true });
        schedule();
      },

      redo() {
        const { past, design, future } = get();
        if (!design || future.length === 0) return;
        breakCoalesce();
        const next = future[0];
        set({ design: next, past: [...past, design].slice(-UNDO_LIMIT), future: future.slice(1), dirty: true });
        schedule();
      },

      saveNow() {
        if (get().design) set({ dirty: true });
        save();
      },

      duplicate(id) {
        const src = get().library.find((d) => d.id === id);
        if (!src) return null;
        const t = now();
        const copy: Design = {
          ...clone(src),
          id: `d${t.toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`,
          name: `${src.name} (2)`,
          createdAt: t,
          updatedAt: t,
        };
        const next = [copy, ...get().library];
        set({ library: next });
        persistLibrary(next);
        return copy;
      },

      rename(id, name) {
        const clean = name.trim();
        if (!clean) return;
        const t = now();
        const next = get().library.map((d) => (d.id === id ? { ...d, name: clean, updatedAt: t } : d));
        set({ library: next });
        persistLibrary(next);
        const cur = get().design;
        if (cur && cur.id === id && cur.name !== clean) get().update((d) => { d.name = clean; });
      },

      remove(id) {
        const next = get().library.filter((d) => d.id !== id);
        set({ library: next });
        persistLibrary(next);
      },

      setLang(lang) {
        const settings = { ...get().settings, lang };
        set({ settings });
        persistSettings(settings);
      },

      setExportOptions(exportOptions) {
        const settings = { ...get().settings, exportOptions };
        set({ settings });
        persistSettings(settings);
      },

      setTranslit(translit) {
        const settings = { ...get().settings, translit };
        set({ settings });
        persistSettings(settings);
      },

      setSnap(snap) {
        const settings = { ...get().settings, snap };
        set({ settings });
        persistSettings(settings);
      },

      importDesigns(list) {
        save();
        const t = now();
        const lib = get().library;
        const added: Design[] = [];
        for (const raw of list) {
          if (!isDesign(raw)) continue;
          const d = clone(raw);
          if (!Array.isArray(d.centre)) d.centre = [{ id: 'sri', type: 'sri', visible: true, radius: 1 }];
          const same = lib.find((x) => x.id === d.id) ?? added.find((x) => x.id === d.id);
          if (same) {
            // never overwrite: an identical copy is skipped, a different one is kept beside it
            if (JSON.stringify({ ...same, updatedAt: 0 }) === JSON.stringify({ ...d, updatedAt: 0 })) continue;
            d.id = `d${t.toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}${added.length}`;
            d.name = `${d.name} (2)`;
          }
          d.updatedAt = t;
          added.push(d);
        }
        if (added.length) {
          const next = [...added, ...lib];
          set({ library: next });
          persistLibrary(next);
        }
        return added;
      },
    };
  });

  return Object.assign(store, {
    flush() {
      const s = store.getState();
      if (s.dirty) s.saveNow();
    },
  });
}

/** The app-wide store. */
export const studio: StudioStore = createStudioStore({ storage: safeLocalStorage() });

/** Shorthand for studio.getState().update. */
export const updateDesign: StudioState['update'] = (recipe, opts) => studio.getState().update(recipe, opts);

export function useStudio<T>(selector: (s: StudioState) => T): T {
  return useStore(studio, selector);
}
