/**
 * OUTER BANDS — everything outside the nine triangles: circles, lotus rings,
 * bead rings, mantra (text) rings and the bhupura square with its four gates.
 *
 * PUBLIC CONTRACT (do not change these signatures):
 */
import type { Anchor, BeadBand, BhupuraBand, Band, CircleBand, Paint, PathCmd, Prim, TextRingBand } from '../core/types';
import { circlePath, polygon } from '../core/path';
import { buildLotus, normDeg, orderFromBottom } from './lotus';
import { bhupuraGeometry } from './bhupura';
import { clamp, fin } from './geom';

export interface OuterContext {
  ink: string;
  paper: string;
  /** when true, bands with a `fill` colour paint it; otherwise line-work only */
  filled: boolean;
}

export interface OuterResult {
  /** in painting order (first = bottom) */
  prims: Prim[];
  anchors: Anchor[];
  /** everything drawn fits inside the square [-extent, extent]² */
  extent: number;
}

interface Group {
  prims: Prim[];
  anchors: Anchor[];
}

function circleGroup(b: CircleBand, r: number, ctx: OuterContext): { g: Group; height: number } {
  const count = clamp(Math.round(fin(b.count, 1)), 1, 50);
  const spacing = Math.max(0, fin(b.spacing, 0.03));
  const paint: Paint = { stroke: ctx.ink, strokeMm: b.lineMm, fill: null };
  const prims: Prim[] = [];
  for (let i = 0; i < count; i++)
    prims.push({ kind: 'circle', cx: 0, cy: 0, r: r + i * spacing, layer: `band:${b.id}`, role: `circle:${i}`, paint });
  return { g: { prims, anchors: [] }, height: (count - 1) * spacing };
}

function beadGroup(b: BeadBand, r: number, ctx: OuterContext): { g: Group; height: number } {
  const layer = `band:${b.id}`;
  const count = clamp(Math.round(fin(b.count, 12)), 1, 4096);
  const size = Math.max(1e-6, fin(b.size, 0.02));
  const rc = r + size;
  const prims: Prim[] = [];
  const angles: number[] = [];
  const stroke: Paint = { stroke: ctx.ink, strokeMm: b.lineMm, fill: null };
  const fillPaint: Paint | null = ctx.filled && b.fill ? { stroke: null, strokeMm: b.lineMm, fill: b.fill } : null;
  const fills: Prim[] = [];
  for (let i = 0; i < count; i++) {
    const deg = -90 + (i * 360) / count;
    angles.push(deg);
    const t = (deg * Math.PI) / 180;
    const ux = Math.cos(t), uy = Math.sin(t); // outward
    const vx = -uy, vy = ux; // tangential
    const cx = rc * ux, cy = rc * uy;
    const role = `bead:${i}`;
    if (b.shape === 'dot') {
      prims.push({ kind: 'circle', cx, cy, r: size, layer, role, paint: { stroke: null, strokeMm: b.lineMm, fill: ctx.ink } });
    } else if (b.shape === 'circle') {
      if (fillPaint) fills.push({ kind: 'circle', cx, cy, r: size, layer, role, paint: fillPaint });
      prims.push({ kind: 'circle', cx, cy, r: size, layer, role, paint: stroke });
    } else {
      const P = (a: number, t2: number) => ({ x: cx + a * ux + t2 * vx, y: cy + a * uy + t2 * vy });
      const pts =
        b.shape === 'diamond'
          ? [P(size, 0), P(0, size), P(-size, 0), P(0, -size)]
          : [P(size, 0), P(-size, size), P(-size, -size)];
      const d: PathCmd[] = polygon(pts);
      if (fillPaint) fills.push({ kind: 'path', layer, role, d, paint: fillPaint });
      prims.push({ kind: 'path', layer, role, d, paint: stroke });
    }
  }
  const order = orderFromBottom(angles);
  const anchors: Anchor[] = order.map((src, index) => {
    const t = (angles[src] * Math.PI) / 180;
    return { id: `${layer}:${index}`, group: layer, index, x: rc * Math.cos(t), y: rc * Math.sin(t), r: size, outDeg: normDeg(angles[src]) };
  });
  return { g: { prims: [...fills, ...prims], anchors }, height: 2 * size };
}

function textGroup(b: TextRingBand, r: number, ctx: OuterContext): { g: Group; height: number } {
  const size = Math.max(1e-6, fin(b.size, 0.07));
  const baseline = b.inward ? r + 1.1 * size : r + 0.4 * size;
  const prim: Prim = {
    kind: 'text',
    layer: `band:${b.id}`,
    role: 'ring-text',
    id: 'ring:' + b.id,
    text: b.text,
    x: 0,
    y: 0,
    size,
    angle: 0,
    font: b.font,
    fill: ctx.ink,
    arc: { r: baseline, centerDeg: -90, inward: b.inward, repeat: b.repeat, separator: b.separator },
  };
  return { g: { prims: [prim], anchors: [] }, height: 1.5 * size };
}

function bhupuraGroup(b: BhupuraBand, rBefore: number, h0: number, ctx: OuterContext): { g: Group; extent: number } {
  const layer = `band:${b.id}`;
  const geo = bhupuraGeometry(b, h0);
  const prims: Prim[] = [];
  const dOf = (pts: { x: number; y: number }[]): PathCmd[] => polygon(pts);
  if (ctx.filled && b.fill) {
    prims.push({ kind: 'path', layer, role: 'fill', d: dOf(geo.lines[0]), paint: { stroke: null, strokeMm: b.lineMm, fill: b.fill } });
    prims.push({
      kind: 'path', layer, role: 'cover', d: circlePath(0, 0, rBefore),
      paint: { stroke: null, strokeMm: b.lineMm, fill: ctx.paper },
    });
  }
  geo.lines.forEach((pts, k) =>
    prims.push({ kind: 'path', layer, role: `line:${k}`, d: dOf(pts), paint: { stroke: ctx.ink, strokeMm: b.lineMm, fill: null } }));

  const anchors: Anchor[] = [];
  // gates: bottom, right, top, left
  const gateAng = [90, 0, -90, 180];
  const gr = 0.5 * Math.min(geo.g, geo.depth);
  const gd = geo.h0 + geo.depth / 2;
  gateAng.forEach((a, index) => {
    const t = (a * Math.PI) / 180;
    anchors.push({ id: `gates:${index}`, group: 'gates', index, x: gd * Math.cos(t), y: gd * Math.sin(t), r: gr, outDeg: normDeg(a) });
  });
  // corners: bottom-right, top-right, top-left, bottom-left
  const rc = Math.min(Math.max(0, rBefore), geo.h0);
  const tDiag = (geo.h0 + rc) / (1 + Math.SQRT1_2);
  const cr = Math.max(0, tDiag - rc);
  [45, -45, -135, 135].forEach((a, index) => {
    const t = (a * Math.PI) / 180;
    anchors.push({ id: `corners:${index}`, group: 'corners', index, x: tDiag * Math.cos(t), y: tDiag * Math.sin(t), r: cr, outDeg: a });
  });
  return { g: { prims, anchors }, extent: geo.extent };
}

export function buildBands(bands: Band[], startRadius: number, ctx: OuterContext): OuterResult {
  const groups: Prim[][] = [];
  const anchors: Anchor[] = [];
  let r = Math.max(0, fin(startRadius, 1));
  let extent = r;
  for (const b of bands) {
    if (!b.visible) continue;
    const rBefore = r;
    r += Math.max(0, fin(b.gap, 0));
    switch (b.type) {
      case 'circle': {
        const { g, height } = circleGroup(b, r, ctx);
        groups.push(g.prims);
        r += height;
        extent = Math.max(extent, r);
        break;
      }
      case 'lotus': {
        const out = buildLotus(b, r, ctx);
        groups.push([...out.fills, ...(out.cover ? [out.cover] : []), ...out.strokes]);
        anchors.push(...out.anchors);
        extent = Math.max(extent, out.maxRad);
        r += Math.max(1e-4, fin(b.height, 0.2));
        extent = Math.max(extent, r);
        break;
      }
      case 'beads': {
        const { g, height } = beadGroup(b, r, ctx);
        groups.push(g.prims);
        anchors.push(...g.anchors);
        r += height;
        extent = Math.max(extent, r);
        break;
      }
      case 'textRing': {
        const { g, height } = textGroup(b, r, ctx);
        groups.push(g.prims);
        r += height;
        extent = Math.max(extent, r);
        break;
      }
      case 'bhupura': {
        const { g, extent: ext } = bhupuraGroup(b, rBefore, r, ctx);
        groups.push(g.prims);
        anchors.push(...g.anchors);
        r = ext;
        extent = Math.max(extent, ext);
        break;
      }
    }
  }
  const prims: Prim[] = [];
  for (let i = groups.length - 1; i >= 0; i--) prims.push(...groups[i]);
  return { prims, anchors, extent };
}
