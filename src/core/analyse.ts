/**
 * Accuracy checks for ANY yantra, not only the Sri Yantra.
 *
 * A drawing can look right and still be wrong by a hair: three lines that were
 * meant to cross at one point but leave a tiny triangle, a corner that stops just
 * short of the line or circle it should rest on, a figure that is a fraction of a
 * degree off its mirror image. These are exactly the faults a craftsman checks
 * for with a lens. This module finds them from the straight lines and circles of
 * the scene and reports how far off each one is.
 */
import type { Pt } from './planar';
import type { SceneLine } from './types';

export type NearMissKind = 'crossing' | 'corner' | 'circle';

export interface NearMiss {
  kind: NearMissKind;
  x: number;
  y: number;
  /** how far from exact, scene units */
  error: number;
}

export interface Symmetry {
  /** left half mirrors the right half */
  mirrorX: boolean;
  /** top half mirrors the bottom half */
  mirrorY: boolean;
  /** largest n for which a turn of 360/n degrees leaves the lines unchanged (1 = none) */
  turns: number;
  /** when not mirrored left-to-right but nearly so: the largest distance by which a corner misses its mirror image */
  mirrorXError: number | null;
}

export interface Precision {
  lineCount: number;
  /** distinct directions of the lines, degrees from horizontal in [0, 180), ascending */
  directions: number[];
  /** the largest "round" angle of which every direction is a whole multiple, or null */
  angleGrid: number | null;
  nearMisses: NearMiss[];
  symmetry: Symmetry;
  /** false when the drawing has too many lines to check */
  complete: boolean;
}

/** Anything closer than this (scene units; the first circle has radius 1) counts as exactly meeting. */
export const EXACT = 1e-7;
/** Default distance below which two things are taken to have been meant to meet. */
export const NEAR = 0.005;

const GRID_STEPS = [90, 60, 45, 36, 30, 22.5, 20, 18, 15, 12, 11.25, 10, 9, 7.5, 6, 5];

function lineLine(p1: Pt, p2: Pt, p3: Pt, p4: Pt): { u: number; v: number; p: Pt } | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  const scale = Math.hypot(p2.x - p1.x, p2.y - p1.y) * Math.hypot(p4.x - p3.x, p4.y - p3.y);
  if (Math.abs(d) < 1e-9 * scale) return null;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return { u, v, p: { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) } };
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Direction of a line in [0, 180): 0 = level, 90 = upright, measured anticlockwise as seen on screen. */
export function lineDirection(a: Pt, b: Pt): number {
  const d = mod((Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI, 180);
  return d > 180 - 1e-7 ? 0 : d;
}

/** Interior angle at `at` between the rays to p and q, in degrees. */
export function angleAt(at: Pt, p: Pt, q: Pt): number {
  const a1 = Math.atan2(p.y - at.y, p.x - at.x), a2 = Math.atan2(q.y - at.y, q.x - at.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Bearing from a to b: 0 = straight up, clockwise, in [0, 360). */
export function bearing(a: Pt, b: Pt): number {
  return mod((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI, 360);
}

function symmetryOf(lines: SceneLine[], near: number): Symmetry {
  // a line as an unordered pair of rounded end points
  const q = (v: number) => Math.round(v * 1e6);
  const keyOf = (a: Pt, b: Pt) => {
    const ka = `${q(a.x)},${q(a.y)}`, kb = `${q(b.x)},${q(b.y)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  // rounding can fall either side of a boundary: accept a neighbouring cell on any coordinate
  const set = new Set(lines.map((l) => keyOf(l.a, l.b)));
  const has = (a: Pt, b: Pt): boolean => {
    if (set.has(keyOf(a, b))) return true;
    for (const l of lines) {
      const same = (p: Pt, r: Pt) => Math.abs(p.x - r.x) < 2e-6 && Math.abs(p.y - r.y) < 2e-6;
      if ((same(l.a, a) && same(l.b, b)) || (same(l.a, b) && same(l.b, a))) return true;
    }
    return false;
  };
  const invariant = (map: (p: Pt) => Pt) => lines.every((l) => has(map(l.a), map(l.b)));
  const empty = lines.length === 0;
  const mirrorX = !empty && invariant((p) => ({ x: -p.x, y: p.y }));
  const mirrorY = !empty && invariant((p) => ({ x: p.x, y: -p.y }));
  let turns = 1;
  if (!empty)
    for (let n = 36; n >= 2; n--) {
      const a = (2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a);
      if (invariant((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }))) { turns = n; break; }
    }
  let mirrorXError: number | null = null;
  if (!mirrorX && !empty) {
    const pts: Pt[] = [];
    for (const l of lines) pts.push(l.a, l.b);
    let worst = 0;
    for (const p of pts) {
      let best = Infinity;
      for (const r of pts) best = Math.min(best, Math.hypot(-p.x - r.x, p.y - r.y));
      worst = Math.max(worst, best);
    }
    if (worst < near) mirrorXError = worst;
  }
  return { mirrorX, mirrorY, turns, mirrorXError };
}

/**
 * Check the straight lines (and the circles they may rest on) of a drawing.
 * `near` is the distance, in scene units, within which things are taken to have been meant to meet.
 */
export function analyse(lines: SceneLine[], rounds: { x: number; y: number; r: number }[] = [], near = NEAR): Precision {
  const usable = lines.filter((l) => Math.hypot(l.a.x - l.b.x, l.a.y - l.b.y) > EXACT);
  const complete = usable.length <= 400;
  const L = complete ? usable : usable.slice(0, 400);

  // --- directions
  const dirs: number[] = [];
  for (const l of L) {
    const d = lineDirection(l.a, l.b);
    if (!dirs.some((e) => Math.abs(e - d) < 1e-6 || Math.abs(Math.abs(e - d) - 180) < 1e-6)) dirs.push(d);
  }
  dirs.sort((a, b) => a - b);
  let angleGrid: number | null = null;
  if (dirs.length > 0)
    for (const step of GRID_STEPS) {
      if (dirs.every((d) => Math.abs(d / step - Math.round(d / step)) < 1e-6 / step)) { angleGrid = step; break; }
    }

  // --- which infinite line each segment lies on (so that two pieces of one line are not counted as two lines)
  const lineId: number[] = [];
  const reps: { a: Pt; b: Pt }[] = [];
  for (const l of L) {
    let id = -1;
    for (let k = 0; k < reps.length; k++) {
      const r = reps[k];
      const len = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
      const off = (p: Pt) => Math.abs((r.b.x - r.a.x) * (p.y - r.a.y) - (r.b.y - r.a.y) * (p.x - r.a.x)) / len;
      if (off(l.a) < EXACT && off(l.b) < EXACT) { id = k; break; }
    }
    if (id < 0) { reps.push({ a: l.a, b: l.b }); id = reps.length - 1; }
    lineId.push(id);
  }

  const misses: NearMiss[] = [];
  const addMiss = (m: NearMiss) => {
    // one mark per place: keep the larger error
    for (const e of misses) {
      if (Math.hypot(e.x - m.x, e.y - m.y) < near * 1.5) {
        if (m.error > e.error) { e.error = m.error; e.kind = m.kind; }
        return;
      }
    }
    misses.push(m);
  };

  // --- crossings: three lines that leave a tiny triangle instead of meeting in a point
  interface Cross { p: Pt; i: number; j: number }
  const crosses: Cross[] = [];
  const slack = near; // a line may stop just short of the crossing
  for (let i = 0; i < L.length; i++) {
    for (let j = i + 1; j < L.length; j++) {
      if (lineId[i] === lineId[j]) continue;
      const r = lineLine(L[i].a, L[i].b, L[j].a, L[j].b);
      if (!r) continue;
      if (distToSeg(r.p, L[i].a, L[i].b) > slack || distToSeg(r.p, L[j].a, L[j].b) > slack) continue;
      crosses.push({ p: r.p, i: lineId[i], j: lineId[j] });
    }
  }
  const cell = near;
  const grid = new Map<string, number[]>();
  crosses.forEach((c, k) => {
    const key = `${Math.floor(c.p.x / cell)},${Math.floor(c.p.y / cell)}`;
    const list = grid.get(key);
    if (list) list.push(k);
    else grid.set(key, [k]);
  });
  const neighbours = (c: Cross): number[] => {
    const gx = Math.floor(c.p.x / cell), gy = Math.floor(c.p.y / cell);
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(`${gx + dx},${gy + dy}`);
        if (list) for (const k of list) if (Math.hypot(crosses[k].p.x - c.p.x, crosses[k].p.y - c.p.y) < near) out.push(k);
      }
    return out;
  };
  crosses.forEach((c) => {
    // lines i and j cross here; look for a third line that crosses both of them close by
    const around = neighbours(c);
    const withI = new Map<number, Pt>(), withJ = new Map<number, Pt>();
    for (const k of around) {
      const o = crosses[k];
      if (o.i === c.i && o.j !== c.j) withI.set(o.j, o.p);
      else if (o.j === c.i && o.i !== c.j) withI.set(o.i, o.p);
      if (o.i === c.j && o.j !== c.i) withJ.set(o.j, o.p);
      else if (o.j === c.j && o.i !== c.i) withJ.set(o.i, o.p);
    }
    for (const [third, p1] of withI) {
      const p2 = withJ.get(third);
      if (!p2) continue;
      const err = Math.max(Math.hypot(p1.x - c.p.x, p1.y - c.p.y), Math.hypot(p2.x - c.p.x, p2.y - c.p.y), Math.hypot(p1.x - p2.x, p1.y - p2.y));
      if (err > EXACT && err < near) addMiss({ kind: 'crossing', x: (c.p.x + p1.x + p2.x) / 3, y: (c.p.y + p1.y + p2.y) / 3, error: err });
    }
  });

  // --- corners that stop just short of (or just past) a line or a circle
  const corners: Pt[] = [];
  for (const l of L)
    for (const p of [l.a, l.b]) if (!corners.some((c) => Math.abs(c.x - p.x) < EXACT && Math.abs(c.y - p.y) < EXACT)) corners.push(p);
  for (const p of corners) {
    for (let k = 0; k < L.length; k++) {
      const d = distToSeg(p, L[k].a, L[k].b);
      if (d > EXACT && d < near) addMiss({ kind: 'corner', x: p.x, y: p.y, error: d });
    }
    for (const c of rounds) {
      const d = Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - c.r);
      if (d > EXACT && d < near) addMiss({ kind: 'circle', x: p.x, y: p.y, error: d });
    }
  }

  misses.sort((a, b) => b.error - a.error);
  return { lineCount: usable.length, directions: dirs, angleGrid, nearMisses: misses, symmetry: symmetryOf(L, near), complete };
}
