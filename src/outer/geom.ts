/** Small curve toolkit used by the outer-bands module (cubic segments, clipping against polygons). */
import type { PathCmd } from '../core/types';

export interface Pt {
  x: number;
  y: number;
}
/** A cubic Bézier segment; `line` marks a straight segment stored as a degenerate cubic. */
export interface Seg {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  line?: boolean;
}

export const pt = (x: number, y: number): Pt => ({ x, y });
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** finite number or fallback */
export const fin = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function lineSeg(a: Pt, b: Pt): Seg {
  return { p0: a, p1: lerpPt(a, b, 1 / 3), p2: lerpPt(a, b, 2 / 3), p3: b, line: true };
}

export function cubicAt(s: Seg, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x, y: a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y };
}

export function splitSeg(s: Seg, t: number): [Seg, Seg] {
  const a = lerpPt(s.p0, s.p1, t), b = lerpPt(s.p1, s.p2, t), c = lerpPt(s.p2, s.p3, t);
  const d = lerpPt(a, b, t), e = lerpPt(b, c, t), f = lerpPt(d, e, t);
  return [
    { p0: s.p0, p1: a, p2: d, p3: f, line: s.line },
    { p0: f, p1: e, p2: c, p3: s.p3, line: s.line },
  ];
}

/** The portion of the segment between parameters ta < tb. */
export function subSeg(s: Seg, ta: number, tb: number): Seg {
  let cur = s;
  if (tb < 1) cur = splitSeg(cur, tb)[0];
  if (ta > 0) cur = splitSeg(cur, ta / tb)[1];
  return cur;
}

export function mapSeg(s: Seg, f: (p: Pt) => Pt): Seg {
  return { p0: f(s.p0), p1: f(s.p1), p2: f(s.p2), p3: f(s.p3), line: s.line };
}
export const reverseSeg = (s: Seg): Seg => ({ p0: s.p3, p1: s.p2, p2: s.p1, p3: s.p0, line: s.line });
export const mirrorSeg = (s: Seg): Seg => mapSeg(s, (p) => ({ x: p.x, y: -p.y }));

export function segsToCmds(segs: Seg[], close: boolean): PathCmd[] {
  if (!segs.length) return [];
  const d: PathCmd[] = [['M', segs[0].p0.x, segs[0].p0.y]];
  for (const s of segs) {
    if (s.line) d.push(['L', s.p3.x, s.p3.y]);
    else d.push(['C', s.p1.x, s.p1.y, s.p2.x, s.p2.y, s.p3.x, s.p3.y]);
  }
  if (close) d.push(['Z']);
  return d;
}

/** Points along the segments, `n` per segment, starting with the first start point. */
export function flattenSegs(segs: Seg[], n: number): Pt[] {
  const out: Pt[] = [];
  if (!segs.length) return out;
  out.push(segs[0].p0);
  for (const s of segs) for (let j = 1; j <= n; j++) out.push(cubicAt(s, j / n));
  return out;
}

/* --------------------------------------------------------------- polygons */

export interface Poly {
  pts: Pt[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
export function makePoly(pts: Pt[]): Poly {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { pts, minX, maxX, maxY, minY };
}
export function inPoly(p: Pt, q: Poly): boolean {
  if (p.x < q.minX || p.x > q.maxX || p.y < q.minY || p.y > q.maxY) return false;
  const v = q.pts;
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i], b = v[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from p to the polyline (open). */
export function distToPolyline(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/* -------------------------------------------------------------- clipping */

export interface ClipResult {
  /** visible runs, each a chain of contiguous segments */
  runs: Seg[][];
  /** the whole (closed) curve is visible */
  full: boolean;
}

/**
 * Remove the parts of a curve that lie inside any of `polys`. Cut points are
 * found by bisection on the curve parameter, and the curve is split there
 * exactly (de Casteljau), so every kept run ends on the polygon boundary.
 */
export function clipRuns(segs: Seg[], polys: Poly[], closed: boolean, samples = 48): ClipResult {
  const hidden = (p: Pt) => {
    for (const q of polys) if (inPoly(p, q)) return true;
    return false;
  };
  const pieces: { si: number; a: number; b: number }[] = [];
  segs.forEach((s, si) => {
    let prevT = 0;
    let prevVis = !hidden(cubicAt(s, 0));
    let start: number | null = prevVis ? 0 : null;
    for (let j = 1; j <= samples; j++) {
      const t = j / samples;
      const vis = !hidden(cubicAt(s, t));
      if (vis !== prevVis) {
        let lo = prevT, hi = t;
        for (let it = 0; it < 44; it++) {
          const mid = (lo + hi) / 2;
          if (!hidden(cubicAt(s, mid)) === prevVis) lo = mid;
          else hi = mid;
        }
        // report the parameter on the visible side of the boundary
        const tc = prevVis ? lo : hi;
        if (prevVis) {
          pieces.push({ si, a: start as number, b: tc });
          start = null;
        } else start = tc;
      }
      prevT = t;
      prevVis = vis;
    }
    if (prevVis && start !== null) pieces.push({ si, a: start, b: 1 });
  });

  const full = closed && pieces.length === segs.length && pieces.every((p, i) => p.si === i && p.a === 0 && p.b === 1);
  const runs: Seg[][] = [];
  let cur: Seg[] | null = null;
  let last: { si: number; b: number } | null = null;
  for (const pc of pieces) {
    const sub = subSeg(segs[pc.si], pc.a, pc.b);
    if (Math.hypot(sub.p3.x - sub.p0.x, sub.p3.y - sub.p0.y) < 1e-9 && pc.b - pc.a < 1e-7) {
      cur = null;
      last = null;
      continue;
    }
    if (cur && last && last.b === 1 && pc.a === 0 && pc.si === last.si + 1) cur.push(sub);
    else {
      cur = [sub];
      runs.push(cur);
    }
    last = { si: pc.si, b: pc.b };
  }
  if (closed && !full && runs.length > 1 && pieces.length) {
    const f = pieces[0], l = pieces[pieces.length - 1];
    if (f.si === 0 && f.a === 0 && l.si === segs.length - 1 && l.b === 1) {
      const lastRun = runs.pop() as Seg[];
      runs[0] = lastRun.concat(runs[0]);
    }
  }
  return { runs, full };
}
