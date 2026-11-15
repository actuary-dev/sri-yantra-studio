/**
 * Snapping: corners, crossings, middles of lines, circles, and the two centre
 * axes of the drawing, collected from the built scene (minus the figures being moved).
 */
import type { Pt } from '../core';
import type { Scene } from '../core/types';
import { distToSegment } from '../core';

export type SnapKind = 'corner' | 'crossing' | 'middle' | 'centre' | 'line' | 'circle';

export interface SnapSet {
  points: { p: Pt; kind: SnapKind }[];
  segs: [Pt, Pt][];
  circles: { c: Pt; r: number }[];
  /** spatial hash of points: cell size → key → indices */
  cell: number;
  hash: Map<string, number[]>;
}

export interface SnapHit {
  p: Pt;
  kind: SnapKind;
  /** distance from the asked-for point */
  d: number;
  /** a point target (not just "somewhere on a line") */
  point: boolean;
}

const SKIP_LAYERS = new Set(['guides', 'text']);
const MAX_PAIR_SEGS = 4000;

/** Which figure a prim belongs to ('triangles'/'cells' belong to the Sri Yantra). */
export function primFigure(layer: string, sriId: string | null): string | null {
  if (layer.startsWith('fig:')) return layer.slice(4);
  if ((layer === 'triangles' || layer === 'cells') && sriId) return sriId;
  return null;
}

function intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-14) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  const e = 1e-9;
  if (t < -e || t > 1 + e || u < -e || u > 1 + e) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function segCircle(a: Pt, b: Pt, c: Pt, r: number): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - c.x, fy = a.y - c.y;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (A < 1e-18 || disc < 0) return [];
  const q = Math.sqrt(disc);
  const out: Pt[] = [];
  for (const t of [(-B - q) / (2 * A), (-B + q) / (2 * A)]) if (t >= -1e-9 && t <= 1 + 1e-9) out.push({ x: a.x + t * dx, y: a.y + t * dy });
  return out;
}

/** Straight segments of a path, or null when it has curves. */
function pathSegs(d: Scene['prims'][number] & { kind: 'path' }): [Pt, Pt][] | null {
  const out: [Pt, Pt][] = [];
  let cur: Pt | null = null, start: Pt | null = null;
  for (const c of d.d) {
    if (c[0] === 'M') { cur = { x: c[1], y: c[2] }; start = cur; }
    else if (c[0] === 'L') { const p = { x: c[1], y: c[2] }; if (cur) out.push([cur, p]); cur = p; }
    else if (c[0] === 'Z') { if (cur && start && (cur.x !== start.x || cur.y !== start.y)) out.push([cur, start]); cur = start; }
    else return null;
  }
  return out;
}

export function collectSnaps(scene: Scene, exclude: Set<string>, sriId: string | null, cellSize: number): SnapSet {
  const segs: [Pt, Pt][] = [];
  const circles: { c: Pt; r: number }[] = [];
  const points: { p: Pt; kind: SnapKind }[] = [];
  for (const pr of scene.prims) {
    if (SKIP_LAYERS.has(pr.layer) || pr.role === 'fill' || pr.role === 'ground') continue;
    const fid = primFigure(pr.layer, sriId);
    if (fid && exclude.has(fid)) continue;
    if (pr.kind === 'circle') {
      if (pr.paint.stroke) circles.push({ c: { x: pr.cx, y: pr.cy }, r: pr.r });
      points.push({ p: { x: pr.cx, y: pr.cy }, kind: 'centre' });
    } else if (pr.kind === 'path' && pr.paint.stroke) {
      const s = pathSegs(pr);
      if (s) segs.push(...s);
    }
  }
  const E = scene.extent;
  const axes: [Pt, Pt][] = [[{ x: 0, y: -E }, { x: 0, y: E }], [{ x: -E, y: 0 }, { x: E, y: 0 }]];
  points.push({ p: { x: 0, y: 0 }, kind: 'centre' });
  for (const [a, b] of segs) {
    points.push({ p: a, kind: 'corner' }, { p: b, kind: 'corner' }, { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: 'middle' });
  }
  const all = [...segs, ...axes];
  if (all.length <= MAX_PAIR_SEGS) {
    const box = all.map(([a, b]) => [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const A = box[i], B = box[j];
        if (A[0] > B[2] + 1e-9 || B[0] > A[2] + 1e-9 || A[1] > B[3] + 1e-9 || B[1] > A[3] + 1e-9) continue;
        const p = intersect(all[i][0], all[i][1], all[j][0], all[j][1]);
        if (p) points.push({ p, kind: 'crossing' });
      }
    if (circles.length * all.length < 400000)
      for (const c of circles) for (const [a, b] of all) for (const p of segCircle(a, b, c.c, c.r)) points.push({ p, kind: 'crossing' });
  }
  // the axes are lines to slide along, as well
  segs.push(...axes);
  // de-duplicate, keeping the most specific kind
  const rank: Record<SnapKind, number> = { centre: 0, corner: 1, crossing: 2, middle: 3, line: 4, circle: 5 };
  const uniq = new Map<string, { p: Pt; kind: SnapKind }>();
  for (const q of points) {
    const k = `${Math.round(q.p.x * 1e6)},${Math.round(q.p.y * 1e6)}`;
    const o = uniq.get(k);
    if (!o || rank[q.kind] < rank[o.kind]) uniq.set(k, q);
  }
  const list = [...uniq.values()];
  const cell = Math.max(cellSize, 1e-4);
  const hash = new Map<string, number[]>();
  list.forEach((q, i) => {
    const k = `${Math.floor(q.p.x / cell)},${Math.floor(q.p.y / cell)}`;
    const arr = hash.get(k);
    if (arr) arr.push(i);
    else hash.set(k, [i]);
  });
  return { points: list, segs, circles, cell, hash };
}

/** Nearest point target within `tol`. */
export function nearestPoint(p: Pt, set: SnapSet, tol: number): SnapHit | null {
  let best: SnapHit | null = null;
  const reach = Math.ceil(tol / set.cell);
  const cx = Math.floor(p.x / set.cell), cy = Math.floor(p.y / set.cell);
  for (let i = -reach; i <= reach; i++)
    for (let j = -reach; j <= reach; j++) {
      const idx = set.hash.get(`${cx + i},${cy + j}`);
      if (!idx) continue;
      for (const k of idx) {
        const q = set.points[k];
        const d = Math.hypot(q.p.x - p.x, q.p.y - p.y);
        // prefer crossings and corners over middles when nearly as close
        const bias = q.kind === 'middle' ? tol * 0.25 : 0;
        if (d <= tol && (!best || d + bias < best.d)) best = { p: q.p, kind: q.kind, d, point: true };
      }
    }
  return best;
}

/** Nearest place on a line or circle within `tol`. */
export function nearestCurve(p: Pt, set: SnapSet, tol: number): SnapHit | null {
  let best: SnapHit | null = null;
  for (const [a, b] of set.segs) {
    const d = distToSegment(p, a, b);
    if (d > tol || (best && d >= best.d)) continue;
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
    best = { p: { x: a.x + t * dx, y: a.y + t * dy }, kind: 'line', d, point: false };
  }
  for (const c of set.circles) {
    const dd = Math.hypot(p.x - c.c.x, p.y - c.c.y);
    const d = Math.abs(dd - c.r);
    if (dd < 1e-12 || d > tol || (best && d >= best.d)) continue;
    best = { p: { x: c.c.x + ((p.x - c.c.x) * c.r) / dd, y: c.c.y + ((p.y - c.c.y) * c.r) / dd }, kind: 'circle', d, point: false };
  }
  return best;
}

/** Points first; a line or circle only when no point is close. */
export function snapPoint(p: Pt, set: SnapSet, tol: number): SnapHit | null {
  return nearestPoint(p, set, tol) ?? nearestCurve(p, set, tol * 0.8);
}

/** Round an angle to the nearest multiple of `step` when it is within `within` degrees of it. */
export function snapAngle(deg: number, step = 15, within = 4): { deg: number; snapped: boolean } {
  const r = Math.round(deg / step) * step;
  return Math.abs(r - deg) <= within ? { deg: r, snapped: true } : { deg, snapped: false };
}

/**
 * Where the straight line through `p` along `dir` meets a line or circle, nearest to `p` and within `tol`.
 * Used to land a corner exactly on a curve while it only slides the way the shape lets it (keeping the angle).
 */
export function snapAlong(p: Pt, dir: Pt, set: SnapSet, tol: number): SnapHit | null {
  const L = Math.hypot(dir.x, dir.y);
  if (L < 1e-12) return null;
  const u = { x: dir.x / L, y: dir.y / L };
  let best: SnapHit | null = null;
  const consider = (t: number, kind: SnapKind) => {
    const d = Math.abs(t);
    if (d <= tol && (!best || d < best.d)) best = { p: { x: p.x + u.x * t, y: p.y + u.y * t }, kind, d, point: false };
  };
  for (const [a, b] of set.segs) {
    const s = { x: b.x - a.x, y: b.y - a.y };
    const den = u.x * s.y - u.y * s.x;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - p.x) * s.y - (a.y - p.y) * s.x) / den;
    const w = ((a.x - p.x) * u.y - (a.y - p.y) * u.x) / den;
    if (w >= -1e-9 && w <= 1 + 1e-9) consider(t, 'line');
  }
  for (const c of set.circles) {
    const fx = p.x - c.c.x, fy = p.y - c.c.y;
    const B = 2 * (fx * u.x + fy * u.y), C = fx * fx + fy * fy - c.r * c.r;
    const disc = B * B - 4 * C;
    if (disc < 0) continue;
    const q = Math.sqrt(disc);
    consider((-B - q) / 2, 'circle');
    consider((-B + q) / 2, 'circle');
  }
  return best;
}
