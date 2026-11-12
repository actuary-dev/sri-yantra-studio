/**
 * Bhupura geometry: nested closed outlines of a square with a T-shaped gate on
 * every side. Line 0 is built from explicit vertices; line k is the exact
 * mitred parallel offset of line 0 by k·spacing (all corners are right angles,
 * so vertex' = vertex + d·(n1 + n2)).
 */
import type { BhupuraBand } from '../core/types';
import { Pt, pt, clamp, fin } from './geom';

export interface BhupuraGeo {
  /** closed polygons (no repeated first point), innermost first; clockwise on screen */
  lines: Pt[][];
  h0: number;
  /** gate opening half-width and outer bar half-width */
  g: number;
  gp: number;
  /** total gate depth actually used (>= band.gateDepth when nested lines need a longer stem) */
  depth: number;
  /** offset of the outermost line */
  dmax: number;
  /** half-extent of the whole enclosure including the gates */
  extent: number;
}

const rot = (p: Pt, k: number): Pt => {
  switch (k & 3) {
    case 0: return pt(p.x, p.y);
    case 1: return pt(-p.y, p.x);
    case 2: return pt(-p.x, -p.y);
    default: return pt(p.y, -p.x);
  }
};

function cleanPoly(v: Pt[]): Pt[] {
  let out = v.slice();
  for (let pass = 0; pass < 3; pass++) {
    const next: Pt[] = [];
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const a = out[(i + n - 1) % n], b = out[i], c = out[(i + 1) % n];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-12) continue; // duplicate
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
      if (Math.abs(cross) < 1e-12 && dot > 0) continue; // collinear
      next.push(b);
    }
    if (next.length === out.length) break;
    out = next;
  }
  return out;
}

export function offsetPoly(v: Pt[], d: number): Pt[] {
  const n = v.length;
  const normals: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = v[i], b = v[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    normals.push(pt(dy / l, -dx / l)); // outward for a clockwise (screen) polygon
  }
  return v.map((p, i) => {
    const n1 = normals[(i + n - 1) % n], n2 = normals[i];
    const k = 1 + n1.x * n2.x + n1.y * n2.y;
    const s = d / Math.max(k, 1e-9);
    return pt(p.x + (n1.x + n2.x) * s, p.y + (n1.y + n2.y) * s);
  });
}

export function bhupuraGeometry(b: BhupuraBand, h0In: number): BhupuraGeo {
  const h0 = Math.max(1e-6, h0In);
  const lines = clamp(Math.round(fin(b.lines, 1)), 1, 4);
  const sp = Math.max(1e-4, fin(b.spacing, 0.04));
  const dmax = (lines - 1) * sp;
  const g = clamp(fin(b.gateWidth, 0.3), 0.02, 0.8) * h0;
  const flare = clamp(fin(b.gateFlare, 1.6), 1, 3);
  const D = Math.max(1e-3, fin(b.gateDepth, 0.1));
  const style = b.style ?? 'classic';
  const gp = style === 'plain' ? g : clamp(g * flare, g, Math.max(g, 0.9 * h0));
  const flared = gp - g > 1e-9;
  /** a nested line k turns round the stem at distance k·spacing from both sides, so the stem must be longer than 2·dmax */
  const pocketMin = flared ? 2 * dmax + 0.5 * sp : 0;

  // levels: [outward extent from wall, half-width]
  let levels: [number, number][];
  let depth: number;
  if (style === 'plain' || !flared) {
    levels = [[D, g]];
    depth = D;
  } else if (style === 'stepped') {
    const s1 = Math.max(D / 3, pocketMin), s2 = D / 3, s3 = D / 3;
    levels = [[s1, g], [s1 + s2, (g + gp) / 2], [s1 + s2 + s3, gp]];
    depth = s1 + s2 + s3;
  } else {
    const s1 = Math.max(D / 2, pocketMin), s2 = D / 2;
    levels = [[s1, g], [s1 + s2, gp]];
    depth = s1 + s2;
  }

  // right side, from the top-right corner down to the bottom edge of the gate opening
  const neg: Pt[] = [pt(h0, -levels[0][1])];
  levels.forEach(([e, w], i) => {
    neg.push(pt(h0 + e, -w));
    if (i + 1 < levels.length) neg.push(pt(h0 + e, -levels[i + 1][1]));
  });
  const pos = neg.map((p) => pt(p.x, -p.y)).reverse();
  const side: Pt[] = [pt(h0, -h0), ...neg, ...pos];

  const base: Pt[] = [];
  for (let k = 0; k < 4; k++) for (const p of side) base.push(rot(p, k));
  const poly0 = cleanPoly(base);

  const out: Pt[][] = [];
  for (let k = 0; k < lines; k++) out.push(k === 0 ? poly0 : offsetPoly(poly0, k * sp));
  return { lines: out, h0, g, gp, depth, dmax, extent: h0 + dmax + depth };
}
