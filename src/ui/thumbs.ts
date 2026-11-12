/**
 * Lazily built thumbnail scenes: built one at a time in idle callbacks so the
 * first paint of the gallery is quick, and cached by key.
 */
import { useSyncExternalStore } from 'react';
import { buildScene } from '../core';
import type { Design, Scene } from '../core/types';

type Entry = Scene | 'error';

const cache = new Map<string, Entry>();
const queue: { key: string; make: () => Design }[] = [];
const queued = new Set<string>();
const listeners = new Set<() => void>();
let scheduled = false;

type IdleWin = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };

function scheduleWork() {
  if (scheduled) return;
  scheduled = true;
  const w = window as IdleWin;
  const run = () => {
    scheduled = false;
    const job = queue.shift();
    if (!job) return;
    queued.delete(job.key);
    try {
      cache.set(job.key, buildScene(job.make()));
    } catch (e) {
      console.warn('Thumbnail failed', job.key, e);
      cache.set(job.key, 'error');
    }
    listeners.forEach((l) => l());
    if (queue.length) scheduleWork();
  };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 400 });
  else setTimeout(run, 16);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Returns the scene for `key` once it has been built (null while waiting). */
export function useThumbScene(key: string, make: () => Design): Entry | null {
  const snap = () => cache.get(key) ?? null;
  const entry = useSyncExternalStore(subscribe, snap, snap);
  if (!entry && !queued.has(key)) {
    queued.add(key);
    queue.push({ key, make });
    if (typeof window !== 'undefined') scheduleWork();
  }
  return entry;
}

/** Forget cached thumbnails whose keys start with `prefix` (e.g. a deleted design). */
export function dropThumbs(prefix: string): void {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
