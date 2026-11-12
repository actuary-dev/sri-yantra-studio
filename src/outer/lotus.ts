/** Lotus band builder: petals, insets, veins, second row (geometrically hidden-line-removed), fills, anchors. */
import type { Anchor, LotusBand, PathCmd, Prim } from '../core/types';
import { circlePath } from '../core/path';
import {
  Poly, Pt, Seg, clamp, clipRuns, distToPolyline, fin, flattenSegs, lineSeg, makePoly, mapSeg, pt, segsToCmds,
} from './geom';
import { petalProfile } from './petal';

export interface LotusOut {
  fills: Prim[];
  cover: Prim | null;
  strokes: Prim[];
  anchors: Anchor[];
  /** largest radius reached by any outline */
  maxRad: number;
}

/** Ordering used for anchors: index 0 nearest the bottom (+90°), then decreasing angle (anticlockwise on screen). */
export function orderFromBottom(anglesDeg: number[]): number[] {
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const key = anglesDeg.map((a) => norm(90 - a));
  let idx = anglesDeg.map((_, i) => i).sort((a, b) => key[a] - key[b]);
  if (idx.length > 1) {
    const first = key[idx[0]];
    const last = 360 - key[idx[idx.length - 1]];
    if (last < first - 1e-7) idx = [idx[idx.length - 1], ...idx.slice(0, -1)];
  }
  return idx;
}

export const normDeg = (a: number) => {
  let v = ((a % 360) + 360) % 360;
  if (v > 180) v -= 360;
  return v;
};

const INSET_SCALES = [0.8, 0.62, 0.46];

export function buildLotus(b: LotusBand, r: number, ctx: { ink: string; paper: string; filled: boolean }): LotusOut {
  const layer = `band:${b.id}`;
  const n = clamp(Math.round(fin(b.petals, 8)), 3, 360);
  const height = Math.max(1e-4, fin(b.height, 0.2));
  const rows = b.rows === 2 ? 2 : 1;
  const insets = clamp(Math.round(fin(b.insets, 0)), 0, 3);
  const prof = petalProfile(b.shape, n, r, height, fin(b.fullness, 0.6), fin(b.tip, 0.6));
  const step = 360 / n;
  const theta0 = b.tipAtTop ? -90 : -90 + step / 2;
  const stroke = { stroke: ctx.ink, strokeMm: b.lineMm, fill: null };

  const rotator = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    return (p: Pt): Pt => pt(c * p.x - s * p.y, s * p.x + c * p.y);
  };
  const place = (segs: Seg[], deg: number) => {
    const f = rotator(deg);
    return segs.map((s) => mapSeg(s, f));
  };

  // local helper geometry
  const cx = r + 0.4 * height;
  const insetSegs: Seg[][] = [];
  for (let j = 0; j < insets; j++) {
    const s = INSET_SCALES[j];
    const sc = (p: Pt) => pt(cx + (p.x - cx) * s, p.y * s);
    const segs = prof.outline.map((sg) => mapSeg(sg, sc));
    segs.push(lineSeg(segs[segs.length - 1].p3, segs[0].p0));
    insetSegs.push(segs);
  }
  const veinSeg: Seg = lineSeg(pt(r + 0.12 * height, 0), pt(r + 0.75 * height, 0));

  // base arc closure for fills (from B+ back to B-)
  const phi = -2 * prof.h;
  const kk = (4 / 3) * Math.tan(Math.abs(phi) / 4);
  const arcCmd = (deg: number): PathCmd => {
    const f = rotator(deg);
    const A = f(pt(prof.bx, prof.by)), Bp = f(pt(prof.bx, -prof.by));
    const tA = f(pt(-Math.sin(prof.h), Math.cos(prof.h)));
    const tB = f(pt(Math.sin(prof.h), Math.cos(prof.h)));
    // moving from +h to -h = decreasing angle: tangent direction is -(−sin a, cos a)
    const c1 = pt(A.x - kk * r * tA.x, A.y - kk * r * tA.y);
    const c2 = pt(Bp.x + kk * r * tB.x, Bp.y + kk * r * tB.y);
    return ['C', c1.x, c1.y, c2.x, c2.y, Bp.x, Bp.y];
  };
  const fillPath = (deg: number): PathCmd[] => {
    const d = segsToCmds(place(prof.outline, deg), false);
    d.push(arcCmd(deg));
    d.push(['Z']);
    return d;
  };

  const fills: Prim[] = [];
  const strokes: Prim[] = [];
  let maxRad = r + height;
  const track = (segs: Seg[]) => {
    for (const p of flattenSegs(segs, 24)) maxRad = Math.max(maxRad, Math.hypot(p.x, p.y));
  };
  track(prof.outline);

  const axes: number[] = [];
  for (let i = 0; i < n; i++) axes.push(theta0 + i * step);

  /* ---- fills: back row first, then front row */
  const doFill = ctx.filled && !!b.fill;
  if (doFill) {
    if (rows === 2) {
      for (let i = 0; i < n; i++)
        fills.push({ kind: 'path', layer, role: `petal-back-fill:${i}`, d: fillPath(axes[i] + step / 2), paint: { stroke: null, strokeMm: b.lineMm, fill: b.fill } });
    }
    for (let i = 0; i < n; i++)
      fills.push({ kind: 'path', layer, role: `petal-fill:${i}`, d: fillPath(axes[i]), paint: { stroke: null, strokeMm: b.lineMm, fill: b.fill } });
  }
  const cover: Prim | null = ctx.filled
    ? { kind: 'path', layer, role: 'cover', d: circlePath(0, 0, r), paint: { stroke: null, strokeMm: b.lineMm, fill: ctx.paper } }
    : null;

  /* ---- strokes */
  // Local polygon of a front petal used for hiding: outline closed well below the base circle.
  const localPoly = flattenSegs(prof.outline, 48);
  localPoly.push(pt(0.8 * prof.bx, 0.8 * prof.by), pt(0.8 * prof.bx, -0.8 * prof.by));
  const frontPoly = (i: number): Poly => {
    const f = rotator(axes[i]);
    return makePoly(localPoly.map(f));
  };

  if (rows === 2) {
    const polys: Poly[] = [];
    for (let i = 0; i < n; i++) polys.push(frontPoly(i));
    for (let i = 0; i < n; i++) {
      const deg = axes[i] + step / 2;
      const pair = [polys[i], polys[(i + 1) % n]];
      const items: { segs: Seg[]; closed: boolean; role: string }[] = [{ segs: prof.outline, closed: false, role: `petal-back:${i}` }];
      insetSegs.forEach((s, j) => items.push({ segs: s, closed: true, role: `inset-back:${i}:${j}` }));
      if (b.vein) items.push({ segs: [veinSeg], closed: false, role: `vein-back:${i}` });
      for (const it of items) {
        const g = place(it.segs, deg);
        const res = clipRuns(g, pair, it.closed);
        if (res.full) strokes.push({ kind: 'path', layer, role: it.role, d: segsToCmds(g, true), paint: stroke });
        else res.runs.forEach((run) => strokes.push({ kind: 'path', layer, role: it.role, d: segsToCmds(run, false), paint: stroke }));
      }
    }
  }
  for (let i = 0; i < n; i++) {
    strokes.push({ kind: 'path', layer, role: `petal:${i}`, d: segsToCmds(place(prof.outline, axes[i]), false), paint: stroke });
    insetSegs.forEach((s, j) =>
      strokes.push({ kind: 'path', layer, role: `inset:${i}:${j}`, d: segsToCmds(place(s, axes[i]), true), paint: stroke }));
    if (b.vein) strokes.push({ kind: 'path', layer, role: `vein:${i}`, d: segsToCmds(place([veinSeg], axes[i]), false), paint: stroke });
  }

  /* ---- anchors: front row only */
  const xa = r + 0.47 * height;
  const outlinePts = flattenSegs(prof.outline, 64);
  const rFree = Math.max(0, Math.min(distToPolyline(pt(xa, 0), outlinePts), xa - r));
  const order = orderFromBottom(axes);
  const anchors: Anchor[] = order.map((src, index) => {
    const t = (axes[src] * Math.PI) / 180;
    return {
      id: `${layer}:${index}`,
      group: layer,
      index,
      x: xa * Math.cos(t),
      y: xa * Math.sin(t),
      r: rFree,
      outDeg: normDeg(axes[src]),
    };
  });
  return { fills, cover, strokes, anchors, maxRad };
}
