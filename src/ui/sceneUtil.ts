import { buildScene } from '../core';
import type { Anchor, Design, Scene } from '../core/types';
import type { Shaper } from '../text';

export interface Built {
  scene: Scene | null;
  error: string | null;
}

/**
 * buildScene, but never throws: if a sibling module (text, bands) fails, retry
 * without the shaper, then without labels, so the drawing still shows.
 */
export function safeBuildScene(design: Design, shaper: Shaper | null): Built {
  try {
    return { scene: buildScene(design, shaper ?? undefined), error: null };
  } catch (e) {
    console.warn('buildScene failed', e);
    if (shaper) {
      try {
        return { scene: buildScene(design), error: null };
      } catch {
        /* fall through */
      }
    }
    try {
      return { scene: buildScene({ ...design, text: { ...design.text, visible: false } }), error: String(e) };
    } catch (e2) {
      return { scene: null, error: String(e2) };
    }
  }
}

/** Anchors without duplicates (the 'cells' group repeats the ring anchors). */
export function placeAnchors(anchors: Anchor[]): Anchor[] {
  const out: Anchor[] = [];
  const seen = new Set<string>();
  for (const a of anchors) {
    if (a.group === 'cells') continue;
    const k = `${a.x.toFixed(5)},${a.y.toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export const mmText = (v: number, digits = 1) => `${v.toFixed(digits)} mm`;
