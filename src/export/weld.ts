/**
 * Weld overlapping glyph contours into clean outlines.
 *
 * Devanagari letters join along the headline, so the outlines of neighbouring
 * glyphs overlap. Filled on paper that is invisible, but an engraver following
 * the contours would cut every overlap as a stray crossing line. Welding takes
 * the union of the solid shapes and then removes the counters (holes), leaving
 * one closed outline per connected piece of lettering.
 */
import polygonClipping from 'polygon-clipping';

type P = { x: number; y: number };
type Ring = [number, number][];

function signedArea(c: P[]): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i], q = c[(i + 1) % c.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

const toRing = (c: P[]): Ring => {
  const r: Ring = c.map((p) => [p.x, p.y]);
  r.push([c[0].x, c[0].y]);
  return r;
};

/** Returns closed rings (first point not repeated). Falls back to the input if welding fails. */
export function weldContours(contours: P[][]): P[][] {
  const rings = contours.filter((c) => c.length >= 3 && Math.abs(signedArea(c)) > 1e-12);
  if (rings.length < 2) return rings;
  try {
    // Font contours are wound one way for solid shapes and the other way for counters;
    // the largest contour is always a solid shape and tells us which is which.
    let largest = rings[0];
    for (const c of rings) if (Math.abs(signedArea(c)) > Math.abs(signedArea(largest))) largest = c;
    const solidSign = Math.sign(signedArea(largest));
    const solids = rings.filter((c) => Math.sign(signedArea(c)) === solidSign).map((c) => [toRing(c)]);
    const holes = rings.filter((c) => Math.sign(signedArea(c)) !== solidSign).map((c) => [toRing(c)]);
    let merged = polygonClipping.union(solids[0], ...solids.slice(1));
    if (holes.length) merged = polygonClipping.difference(merged, polygonClipping.union(holes[0], ...holes.slice(1)));
    const out: P[][] = [];
    for (const poly of merged)
      for (const ring of poly) {
        const pts = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
        if (pts.length >= 3) out.push(pts);
      }
    return out.length ? out : rings;
  } catch {
    return rings;
  }
}
