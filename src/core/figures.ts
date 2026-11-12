/** Geometry of the simple centre figures: polygons, stars, number squares. Scene coordinates (y down). */
import type { GridFigure, LatticeFigure, Orbit, PolygonFigure, RaysFigure } from './types';
import type { Pt } from './planar';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

export interface Placement {
  x: number;
  y: number;
  /** extra rotation so that each copy faces outward */
  turnDeg: number;
}
const CENTRED: Placement = { x: 0, y: 0, turnDeg: 0 };

/** Where the copies of an orbiting figure sit. No orbit → one copy at the centre. */
export function orbitPlacements(o?: Orbit): Placement[] {
  if (!o || !(o.count >= 1)) return [CENTRED];
  const count = Math.round(clamp(o.count, 1, 72));
  const r = clamp(o.radius, 0, 5);
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const turn = (Number.isFinite(o.phaseDeg) ? o.phaseDeg : 0) + (i * 360) / count;
    const a = ((turn - 90) * Math.PI) / 180;
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a), turnDeg: turn });
  }
  return out;
}

export interface PolygonLoops {
  /** one array of loops per nested copy; each loop is a closed run of corners (2 corners = a single line) */
  copies: { radius: number; loops: Pt[][] }[];
  /** distance from the centre to the middle of a side, as a fraction of the corner radius */
  apothemRatio: number;
}

/**
 * Corners of a regular polygon or star {sides/step}. When sides and step share a
 * factor the star splits into separate interlaced polygons — sides 6, step 2 is the
 * hexagram made of two triangles.
 */
export function polygonLoops(f: PolygonFigure, place: Placement = CENTRED): PolygonLoops {
  const n = Math.round(clamp(f.sides, 3, 36));
  const k = Math.round(clamp(f.step, 1, Math.max(1, Math.floor(n / 2))));
  const d = gcd(n, k);
  const per = n / d;
  const nest = Math.round(clamp(f.nest, 1, 12));
  const ratio = clamp(f.nestRatio, 0.2, 0.98);
  const base = clamp(f.radius, 0.005, 5);
  const copies: PolygonLoops['copies'] = [];
  for (let c = 0; c < nest; c++) {
    const r = base * Math.pow(ratio, c);
    const loops: Pt[][] = [];
    for (let s = 0; s < d; s++) {
      const loop: Pt[] = [];
      for (let i = 0; i < per; i++) {
        const idx = (s + i * k) % n;
        const a = ((-90 + (Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0) + place.turnDeg + (idx * 360) / n) * Math.PI) / 180;
        loop.push({ x: place.x + r * Math.cos(a), y: place.y + r * Math.sin(a) });
      }
      loops.push(loop);
    }
    copies.push({ radius: r, loops });
  }
  return { copies, apothemRatio: Math.cos((Math.PI * k) / n) };
}

export interface GridLayout {
  rows: number;
  cols: number;
  cell: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
}

export function gridLayout(f: GridFigure): GridLayout {
  const rows = Math.round(clamp(f.rows, 1, 12));
  const cols = Math.round(clamp(f.cols, 1, 12));
  const width = clamp(f.size, 0.02, 5);
  const cell = width / cols;
  const height = cell * rows;
  return { rows, cols, cell, x0: -width / 2, y0: -height / 2, width, height };
}

/** Spokes as [from, to] pairs, plus the direction of each sector's middle. */
export function raySegments(f: RaysFigure): { segs: [Pt, Pt][]; sectorDeg: number[]; inner: number; outer: number } {
  const n = Math.round(clamp(f.count, 1, 360));
  const inner = clamp(f.inner, 0, 5);
  const outer = Math.max(inner + 1e-4, clamp(f.outer, 0.01, 5));
  const segs: [Pt, Pt][] = [];
  const sectorDeg: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = -90 + (Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0) + (i * 360) / n;
    const a = (d * Math.PI) / 180;
    segs.push([{ x: inner * Math.cos(a), y: inner * Math.sin(a) }, { x: outer * Math.cos(a), y: outer * Math.sin(a) }]);
    sectorDeg.push(d + 180 / n);
  }
  return { segs, sectorDeg, inner, outer };
}

/** Largest valid `hollow` not above the requested one: the centre triangle must sit on the lattice. */
export function latticeHollow(rows: number, hollow: number): number {
  const n = Math.round(clamp(rows, 1, 24));
  let h = Math.round(clamp(hollow, 0, n));
  while (h > 0 && ((n - h) % 3 !== 0 || h >= n)) h--;
  return h;
}

/** A triangle cut into rows of small triangles, as long straight lines. */
export function latticeLines(f: LatticeFigure): { lines: [Pt, Pt][]; cells: number } {
  const n = Math.round(clamp(f.rows, 1, 24));
  const h = latticeHollow(n, f.hollow);
  const m = h > 0 ? (n - h) / 3 : Infinity; // lattice distance of the hollow from each side
  const R = clamp(f.radius, 0.01, 5);
  const rot = ((Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0) * Math.PI) / 180;
  const corner = (deg: number): Pt => {
    const a = (deg * Math.PI) / 180 + rot;
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  };
  const A = corner(-90), B = corner(150), C = corner(30);
  const P = (i: number, j: number, k: number): Pt => ({ x: (i * A.x + j * B.x + k * C.x) / n, y: (i * A.y + j * B.y + k * C.y) / n });
  // unit edges grouped by the line they lie on: family 0 = constant i, 1 = constant j, 2 = constant k
  const runs = new Map<string, Set<number>>();
  const edge = (family: number, c: number, t: number) => {
    const key = `${family}:${c}`;
    const set = runs.get(key);
    if (set) set.add(t);
    else runs.set(key, new Set([t]));
  };
  let cells = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; i + j < n; j++) {
      const k = n - 1 - i - j; // upright: (i+1,j,k) (i,j+1,k) (i,j,k+1)
      if (Math.min(i, j, k) >= m) continue;
      cells++;
      edge(0, i, k); edge(1, j, k); edge(2, k, j);
    }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; i + j < n - 1; j++) {
      const k = n - 2 - i - j; // inverted: (i,j+1,k+1) (i+1,j,k+1) (i+1,j+1,k)
      if (Math.min(i, j, k) >= m) continue;
      cells++;
      edge(0, i + 1, k); edge(1, j + 1, k); edge(2, k + 1, j);
    }
  const lines: [Pt, Pt][] = [];
  for (const [key, set] of runs) {
    const [family, c] = key.split(':').map(Number);
    const ts = [...set].sort((a, b) => a - b);
    let start = ts[0], prev = ts[0];
    const flush = (a: number, b: number) => {
      const pt = (t: number): Pt => (family === 0 ? P(c, n - c - t, t) : family === 1 ? P(n - c - t, c, t) : P(n - c - t, t, c));
      lines.push([pt(a), pt(b + 1)]);
    };
    for (let q = 1; q < ts.length; q++) {
      if (ts[q] !== prev + 1) { flush(start, prev); start = ts[q]; }
      prev = ts[q];
    }
    flush(start, prev);
  }
  return { lines, cells };
}
