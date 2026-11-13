/** Curved and free-form centre figures: arcs, crescents, symbols and hand-placed lines. Scene coordinates (y down). */
import type { Placement } from './figures';
import { transformPath } from './path';
import type { Pt } from './planar';
import type { ArcFigure, CrescentFigure, FreeFigure, GridMerge, PathCmd, SymbolFigure, SymbolName } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const rad = (d: number) => (d * Math.PI) / 180;

/** Cubic Béziers along a circle from angle a0 to a1 (radians, clockwise on screen when a1 > a0). No leading move. */
function arcCubics(cx: number, cy: number, r: number, a0: number, a1: number): PathCmd[] {
  const out: PathCmd[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(step / 4);
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * step, t1 = t0 + step;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    out.push(['C', cx + r * (c0 - k * s0), cy + r * (s0 + k * c0), cx + r * (c1 + k * s1), cy + r * (s1 - k * c1), cx + r * c1, cy + r * s1]);
  }
  return out;
}

/** Place a shape drawn around the origin: turn it to face outward, then move it to its place. */
function placed(d: PathCmd[], turnDeg: number, pl: Placement): PathCmd[] {
  const t = rad(turnDeg + pl.turnDeg);
  const c = Math.cos(t), s = Math.sin(t);
  return transformPath(d, [c, s, -s, c, pl.x, pl.y]);
}

/** Part of a circle. startDeg 0 = straight up, clockwise; sweep 360 = a whole circle. */
export function arcPath(f: ArcFigure, pl: Placement): PathCmd[] {
  const r = clamp(f.radius, 0.005, 5);
  const sweep = clamp(f.sweepDeg, -360, 360);
  const a0 = rad(clamp(f.startDeg, -720, 720) - 90);
  const a1 = a0 + rad(sweep);
  const d: PathCmd[] = [['M', r * Math.cos(a0), r * Math.sin(a0)], ...arcCubics(0, 0, r, a0, a1)];
  if (Math.abs(Math.abs(sweep) - 360) < 1e-9) d.push(['Z']);
  return placed(d, 0, pl);
}

/**
 * A true crescent: the part of a disc left when a second disc is taken out of it.
 * Drawn with its horns pointing up (rotationDeg 0); `thickness` is the width at the
 * middle as a fraction of the radius; `inner` is the radius of the inner curve as a
 * fraction of the outer (1 = the classic thin moon, less than 1 = horns curl further round).
 */
export function crescentPath(f: CrescentFigure, pl: Placement): PathCmd[] {
  const R = clamp(f.radius, 0.005, 5);
  const r2 = R * clamp(f.inner, 0.4, 1.6);
  const t = clamp(f.thickness, 0.02, 1.9) * R;
  // inner disc centre sits d above the outer centre so that the gap at the bottom is t
  let d = t + r2 - R;
  const lo = Math.abs(R - r2) + 1e-4 * R, hi = R + r2 - 1e-4 * R;
  d = clamp(d, lo, hi);
  const yi = (r2 * r2 - R * R - d * d) / (2 * d); // y of the two horn tips (y down)
  const xi = Math.sqrt(Math.max(0, R * R - yi * yi));
  const aR = Math.atan2(yi, xi); // right horn on the outer circle
  const aL = Math.PI - aR;
  const bR = Math.atan2(yi + d, xi); // right horn seen from the inner centre (0, -d)
  const bL = Math.PI - bR;
  const path: PathCmd[] = [
    ['M', xi, yi],
    ...arcCubics(0, 0, R, aR, aL), // outer curve, round the bottom, right horn → left horn
    ...arcCubics(0, -d, r2, bL, bR), // inner curve back, left horn → right horn
    ['Z'],
  ];
  return placed(path, f.rotationDeg, pl);
}

/** Symbols drawn as plain strokes in a box reaching from -1 to 1; "up" is the direction they point. */
const SYMBOLS: Record<SymbolName, PathCmd[]> = {
  // the auspicious right-turning svastika
  swastika: [
    ['M', 0, -1], ['L', 0, 1], ['M', -1, 0], ['L', 1, 0],
    ['M', 0, -1], ['L', 1, -1], ['M', 1, 0], ['L', 1, 1], ['M', 0, 1], ['L', -1, 1], ['M', -1, 0], ['L', -1, -1],
  ],
  // triśūla: a staff with three prongs
  trident: [
    ['M', 0, 1], ['L', 0, -1],
    ['M', -0.62, -0.95], ['C', -0.66, -0.4, -0.3, -0.18, 0, -0.18],
    ['M', 0.62, -0.95], ['C', 0.66, -0.4, 0.3, -0.18, 0, -0.18],
    ['M', -0.22, 0.12], ['L', 0.22, 0.12],
  ],
  // a T standing on its foot at the origin (the marks on the sides of the Maṇipūra triangle)
  tmark: [['M', 0, 0], ['L', 0, -1], ['M', -0.7, -1], ['L', 0.7, -1]],
};

export const SYMBOL_NAMES = Object.keys(SYMBOLS) as SymbolName[];

export function symbolPath(f: SymbolFigure, pl: Placement): PathCmd[] {
  const k = clamp(f.size, 0.005, 5);
  const base = SYMBOLS[f.symbol] ?? SYMBOLS.swastika;
  return placed(transformPath(base, [k, 0, 0, k, 0, 0]), f.rotationDeg, pl);
}

/** The points of a hand-placed shape, once for each turn around the centre. */
export function freeLoops(f: FreeFigure): Pt[][] {
  const pts = (Array.isArray(f.points) ? f.points : []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return [];
  const n = Math.round(clamp(f.repeat, 1, 72));
  const out: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const a = rad((i * 360) / n);
    const c = Math.cos(a), s = Math.sin(a);
    out.push(pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c })));
  }
  return out;
}

/** Joined blocks that lie inside the grid and do not overlap an earlier one. */
export function validMerges(merges: GridMerge[] | undefined, rows: number, cols: number): GridMerge[] {
  const out: GridMerge[] = [];
  const used = new Set<number>();
  for (const m of merges ?? []) {
    const r0 = Math.round(m.row), c0 = Math.round(m.col), h = Math.round(m.rows), w = Math.round(m.cols);
    if (!(r0 >= 0 && c0 >= 0 && h >= 1 && w >= 1 && r0 + h <= rows && c0 + w <= cols) || h * w < 2) continue;
    let clash = false;
    for (let r = r0; r < r0 + h && !clash; r++) for (let c = c0; c < c0 + w; c++) if (used.has(r * cols + c)) { clash = true; break; }
    if (clash) continue;
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) used.add(r * cols + c);
    out.push({ row: r0, col: c0, rows: h, cols: w });
  }
  return out;
}
