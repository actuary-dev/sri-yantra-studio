/**
 * Free-standing triangles and squares: corners, exact corner dragging, copies
 * turned / mirrored / shifted / nested. Scene coordinates (y down, angles clockwise).
 */
import type { ShapeFigure, ShapeLock } from './types';
import type { Pt } from './planar';

const RAD = Math.PI / 180;
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
export const isTriangleLock = (l: ShapeLock) => l !== 'square' && l !== 'rect';
export const isTriangle = (f: Pick<ShapeFigure, 'lock'>) => isTriangleLock(f.lock);
const MIN = 1e-4;

export function rot(p: Pt, deg: number): Pt {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Make the stored numbers agree with the lock (equilateral height, square sides, no skew…). */
export function normaliseShape(f: ShapeFigure): ShapeFigure {
  f.w = Math.max(MIN, Math.abs(fin(f.w, 0.5)));
  f.h = Math.max(MIN, Math.abs(fin(f.h, 0.5)));
  f.x = fin(f.x);
  f.y = fin(f.y);
  f.rotationDeg = fin(f.rotationDeg);
  f.skew = fin(f.skew);
  if (f.lock === 'equilateral') { f.h = (f.w * Math.sqrt(3)) / 2; f.skew = 0; }
  else if (f.lock === 'isosceles') f.skew = 0;
  else if (f.lock === 'right') f.skew = -0.5;
  else if (f.lock === 'square') { f.h = f.w; f.skew = 0; }
  else if (f.lock === 'rect') f.skew = 0;
  else f.skew = Math.max(-3, Math.min(3, f.skew));
  return f;
}

/** Corners in the shape's own frame. Triangles: [apex, base left, base right]. Quads: [top left, top right, bottom right, bottom left]. */
export function localCorners(f: ShapeFigure): Pt[] {
  const w = f.w / 2, h = f.h / 2;
  if (isTriangle(f)) return [{ x: f.skew * f.w, y: -h }, { x: -w, y: h }, { x: w, y: h }];
  return [{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }];
}

export function toWorld(f: ShapeFigure, p: Pt): Pt {
  const r = rot(p, f.rotationDeg);
  return { x: f.x + r.x, y: f.y + r.y };
}

export function toLocal(f: ShapeFigure, p: Pt): Pt {
  return rot({ x: p.x - f.x, y: p.y - f.y }, -f.rotationDeg);
}

/** Corners on the drawing. */
export function shapeCorners(f: ShapeFigure): Pt[] {
  return localCorners(f).map((p) => toWorld(f, p));
}

/** The point the shape turns about by default: the centroid for triangles, the middle for quads. */
export function shapeCentre(f: ShapeFigure): Pt {
  const c = shapeCorners(f);
  return { x: c.reduce((s, p) => s + p.x, 0) / c.length, y: c.reduce((s, p) => s + p.y, 0) / c.length };
}

/** Rebuild a triangle shape from its three corners (apex, base left, base right), keeping `lock` as it is. */
export function fromTriangle(f: ShapeFigure, A: Pt, B: Pt, C: Pt): ShapeFigure {
  let bx = C.x - B.x, by = C.y - B.y;
  let w = Math.hypot(bx, by);
  if (w < MIN) return f;
  let ux = bx / w, uy = by / w;
  let up = { x: uy, y: -ux };
  let h = (A.x - B.x) * up.x + (A.y - B.y) * up.y;
  let Bl = B;
  if (h < 0) {
    // apex on the other side: walk the base the other way
    Bl = C;
    bx = -bx; by = -by; ux = -ux; uy = -uy;
    up = { x: uy, y: -ux };
    h = -h;
  }
  if (h < MIN) h = MIN;
  const skew = ((A.x - Bl.x) * ux + (A.y - Bl.y) * uy) / w - 0.5;
  const mid = { x: Bl.x + (ux * w) / 2, y: Bl.y + (uy * w) / 2 };
  return { ...f, w, h, skew, x: mid.x + (up.x * h) / 2, y: mid.y + (up.y * h) / 2, rotationDeg: Math.atan2(uy, ux) / RAD };
}

/** Turn and scale the whole shape about `pivot` so that the corner `from` lands exactly on `to`. */
function similarity(f: ShapeFigure, pivot: Pt, from: Pt, to: Pt): ShapeFigure {
  const r0 = Math.hypot(from.x - pivot.x, from.y - pivot.y);
  const r1 = Math.hypot(to.x - pivot.x, to.y - pivot.y);
  if (r0 < MIN || r1 < MIN) return f;
  const k = r1 / r0;
  const turn = (Math.atan2(to.y - pivot.y, to.x - pivot.x) - Math.atan2(from.y - pivot.y, from.x - pivot.x)) / RAD;
  const c = rot({ x: (f.x - pivot.x) * k, y: (f.y - pivot.y) * k }, turn);
  return { ...f, x: pivot.x + c.x, y: pivot.y + c.y, w: f.w * k, h: f.h * k, rotationDeg: f.rotationDeg + turn };
}

/**
 * Drag corner `i` to `to`. The corner always lands exactly on `to`; the lock decides what else moves:
 *  free — only that corner · isosceles — apex: base middle stays, base corner: apex stays and the axis keeps its direction ·
 *  equilateral / square — the shape turns and grows about its centre · right — the right-angle corner stays ·
 *  rect — the opposite corner stays.
 */
export function dragCorner(f: ShapeFigure, i: number, to: Pt): ShapeFigure {
  const c = shapeCorners(f);
  let out: ShapeFigure = f;
  if (f.lock === 'free') {
    const p = [...c];
    p[i] = to;
    out = fromTriangle(f, p[0], p[1], p[2]);
  } else if (f.lock === 'equilateral' || f.lock === 'square') {
    out = similarity(f, shapeCentre(f), c[i], to);
  } else if (f.lock === 'isosceles') {
    const B = c[1], C = c[2];
    const mid = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    if (i === 0) {
      const h = Math.hypot(to.x - mid.x, to.y - mid.y);
      if (h < MIN) return f;
      const upx = (to.x - mid.x) / h, upy = (to.y - mid.y) / h;
      out = { ...f, h, x: (to.x + mid.x) / 2, y: (to.y + mid.y) / 2, rotationDeg: Math.atan2(upx, -upy) / RAD };
    } else {
      const A = c[0];
      const down = rot({ x: 0, y: 1 }, f.rotationDeg), u = rot({ x: 1, y: 0 }, f.rotationDeg);
      const h = (to.x - A.x) * down.x + (to.y - A.y) * down.y;
      const s = (to.x - A.x) * u.x + (to.y - A.y) * u.y;
      if (h < MIN || Math.abs(s) < MIN) return f;
      out = { ...f, h, w: 2 * Math.abs(s), x: A.x + (down.x * h) / 2, y: A.y + (down.y * h) / 2 };
    }
  } else if (f.lock === 'right') {
    const B = c[1];
    if (i === 1) return moveShape(f, to.x - B.x, to.y - B.y);
    const d = Math.hypot(to.x - B.x, to.y - B.y);
    if (d < MIN) return f;
    // i === 0: apex direction from B is "up"; i === 2: base direction from B is "right"
    const ang = Math.atan2(to.y - B.y, to.x - B.x) / RAD;
    const rotationDeg = i === 0 ? ang + 90 : ang;
    const w = i === 2 ? d : f.w, h = i === 0 ? d : f.h;
    const centreLocal = rot({ x: w / 2, y: -h / 2 }, rotationDeg); // from B (local −w/2, h/2) to the box middle
    out = { ...f, w, h, rotationDeg, x: B.x + centreLocal.x, y: B.y + centreLocal.y };
  } else if (f.lock === 'rect') {
    const o = c[(i + 2) % 4];
    const l = rot({ x: to.x - o.x, y: to.y - o.y }, -f.rotationDeg);
    if (Math.abs(l.x) < MIN || Math.abs(l.y) < MIN) return f;
    out = { ...f, w: Math.abs(l.x), h: Math.abs(l.y), x: (o.x + to.x) / 2, y: (o.y + to.y) / 2 };
  }
  return normaliseShape({ ...out });
}

export function moveShape(f: ShapeFigure, dx: number, dy: number): ShapeFigure {
  return { ...f, x: f.x + dx, y: f.y + dy };
}

export function rotateShape(f: ShapeFigure, pivot: Pt, deg: number): ShapeFigure {
  const c = rot({ x: f.x - pivot.x, y: f.y - pivot.y }, deg);
  return { ...f, x: pivot.x + c.x, y: pivot.y + c.y, rotationDeg: f.rotationDeg + deg };
}

export function scaleShape(f: ShapeFigure, pivot: Pt, k: number): ShapeFigure {
  return { ...f, x: pivot.x + (f.x - pivot.x) * k, y: pivot.y + (f.y - pivot.y) * k, w: f.w * k, h: f.h * k };
}

/** Mirror across the vertical line x = pivot.x ('lr') or the horizontal line y = pivot.y ('tb'). */
export function mirrorShape(f: ShapeFigure, pivot: Pt, axis: 'lr' | 'tb'): ShapeFigure {
  if (axis === 'lr') return { ...f, x: 2 * pivot.x - f.x, rotationDeg: -f.rotationDeg, skew: -f.skew };
  return { ...f, y: 2 * pivot.y - f.y, rotationDeg: 180 - f.rotationDeg, skew: -f.skew };
}

/** Flip a triangle so its apex points the other way, keeping its box where it is. */
export function flipShape(f: ShapeFigure): ShapeFigure {
  return { ...f, rotationDeg: f.rotationDeg + 180, skew: -f.skew };
}

/** Lines that divide a triangle into rows² small triangles (the lattice inside it). */
export function triangleRows(c: Pt[], rows: number): [Pt, Pt][] {
  const n = Math.max(1, Math.min(24, Math.round(rows)));
  const out: [Pt, Pt][] = [];
  if (n < 2 || c.length !== 3) return out;
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (let v = 0; v < 3; v++) {
    const A = c[v], B = c[(v + 1) % 3], C = c[(v + 2) % 3];
    for (let i = 1; i < n; i++) out.push([lerp(A, B, i / n), lerp(A, C, i / n)]);
  }
  return out;
}

/** Inset outline `dist` inside the shape (same angles), or null when it would vanish. */
export function insetCorners(f: ShapeFigure, dist: number): Pt[] | null {
  const c = shapeCorners(f);
  if (!isTriangle(f)) {
    const w = f.w - 2 * dist, h = f.h - 2 * dist;
    if (w < f.w * 0.08 || h < f.h * 0.08) return null;
    return localCorners({ ...f, w, h }).map((p) => toWorld(f, p));
  }
  const [A, B, C] = c;
  const a = Math.hypot(B.x - C.x, B.y - C.y), b = Math.hypot(A.x - C.x, A.y - C.y), cc = Math.hypot(A.x - B.x, A.y - B.y);
  const per = a + b + cc;
  if (per < MIN) return null;
  const I = { x: (a * A.x + b * B.x + cc * C.x) / per, y: (a * A.y + b * B.y + cc * C.y) / per };
  const s = per / 2;
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
  const r = area / s;
  const k = 1 - dist / r;
  if (!(k > 0.12)) return null;
  return c.map((p) => ({ x: I.x + (p.x - I.x) * k, y: I.y + (p.y - I.y) * k }));
}

/** Facts for the panel: side lengths and corner angles (degrees), in corner order. */
export function shapeFacts(f: ShapeFigure): { sides: number[]; angles: number[] } {
  const c = shapeCorners(f);
  const n = c.length;
  const sides: number[] = [], angles: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = c[i], q = c[(i + 1) % n], o = c[(i + n - 1) % n];
    sides.push(Math.hypot(q.x - p.x, q.y - p.y));
    const a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(o.y - p.y, o.x - p.x);
    let d = Math.abs(a1 - a2) / RAD;
    if (d > 180) d = 360 - d;
    angles.push(d);
  }
  return { sides, angles };
}

/** Apex angle of an isosceles / equilateral triangle, degrees. */
export const apexAngle = (f: Pick<ShapeFigure, 'w' | 'h'>) => (2 * Math.atan(f.w / 2 / f.h)) / RAD;

export interface ArrangeSpec {
  mode: 'turn' | 'mirror' | 'row' | 'nest';
  /** number of new copies */
  count: number;
  /** turn: degrees between copies */
  stepDeg: number;
  pivot: Pt;
  /** mirror */
  axis: 'lr' | 'tb';
  /** row: shift between copies, scene units */
  dx: number;
  dy: number;
  /** nest: each copy is this fraction of the previous */
  ratio: number;
}

/** The new copies an arrangement makes (ids are left to the caller). */
export function arrangeCopies(shapes: ShapeFigure[], a: ArrangeSpec): ShapeFigure[][] {
  const out: ShapeFigure[][] = [];
  if (a.mode === 'mirror') {
    out.push(shapes.map((f) => mirrorShape(f, a.pivot, a.axis)));
    return out;
  }
  const n = Math.max(1, Math.min(120, Math.round(a.count)));
  for (let k = 1; k <= n; k++) {
    if (a.mode === 'turn') out.push(shapes.map((f) => rotateShape(f, a.pivot, a.stepDeg * k)));
    else if (a.mode === 'row') out.push(shapes.map((f) => moveShape(f, a.dx * k, a.dy * k)));
    else out.push(shapes.map((f) => scaleShape(f, a.pivot, Math.pow(Math.max(0.05, Math.min(3, a.ratio)), k))));
  }
  return out;
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function polygonArea(c: Pt[]): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
