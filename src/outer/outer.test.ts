// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildBands } from './index';
import { bhupuraGeometry } from './bhupura';
import { flattenPath } from '../core/path';
import { distToPolyline, inPoly, makePoly, pt } from './geom';
import type { Pt } from './geom';
import { beadBand, bhupuraBand, circleBand, lotusBand, standardBands, textRingBand } from '../presets';
import type { Band, PathPrim, PetalShape, Prim } from '../core/types';

const ctx = { ink: '#111', paper: '#fff', filled: false };
const SHAPES: PetalShape[] = ['classic', 'pointed', 'round', 'flame', 'lotus'];

const paths = (prims: Prim[], role: RegExp) => prims.filter((p): p is PathPrim => p.kind === 'path' && !!p.role && role.test(p.role));
const poly = (p: PathPrim, tol = 1e-5): Pt[] => flattenPath(p.d, tol)[0].pts;
const rotPt = (p: Pt, deg: number): Pt => {
  const t = (deg * Math.PI) / 180;
  return pt(Math.cos(t) * p.x - Math.sin(t) * p.y, Math.sin(t) * p.x + Math.cos(t) * p.y);
};
const angDiff = (a: number, b: number) => {
  let d = (((a - b) % 360) + 540) % 360 - 180;
  return d;
};

function allNumbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allNumbers(x, out));
  else if (v && typeof v === 'object') Object.values(v as object).forEach((x) => allNumbers(x, out));
  return out;
}

describe('radial bookkeeping', () => {
  it('lays out the standard bands outward and reports the extent', () => {
    const res = buildBands(standardBands(), 1, ctx);
    const radii = res.prims.filter((p) => p.kind === 'circle').map((p) => (p as { r: number }).r).sort((a, b) => a - b);
    const expected = [1, 1.24, 1.44, 1.48, 1.52];
    expect(radii).toHaveLength(expected.length);
    radii.forEach((r, i) => expect(r).toBeCloseTo(expected[i], 12));

    // lotus tips reach the outer radius exactly
    const petal = paths(res.prims, /^petal:0$/).filter((p) => p.layer === 'band:l8')[0];
    const maxR = Math.max(...poly(petal).map((q) => Math.hypot(q.x, q.y)));
    expect(maxR).toBeCloseTo(1.24, 3);

    // bhupura: square tangent to circle of radius 1.52 + gap 0.07
    const h0 = 1.59;
    const geo = bhupuraGeometry(standardBands().at(-1) as never, h0);
    expect(res.extent).toBeCloseTo(h0 + 0.08 + geo.depth, 12);
    expect(geo.depth).toBeGreaterThanOrEqual(0.13);
    const line0 = paths(res.prims, /^line:0$/)[0];
    const xs = poly(line0).map((q) => q.x);
    expect(Math.max(...xs.filter((x) => x < h0 + 0.01))).toBeCloseTo(h0, 12);
    // everything fits in the extent
    for (const p of res.prims) {
      if (p.kind === 'path') for (const q of poly(p, 1e-4)) expect(Math.max(Math.abs(q.x), Math.abs(q.y))).toBeLessThanOrEqual(res.extent + 1e-9);
      if (p.kind === 'circle') expect(p.r).toBeLessThanOrEqual(res.extent);
    }
  });

  it('computes heights for circles, beads and text rings', () => {
    const bands: Band[] = [
      circleBand('a', { count: 3, spacing: 0.05, gap: 0.1 }),
      beadBand('b', 20, { size: 0.02, gap: 0.01 }),
      textRingBand('t', 'om', { size: 0.1, gap: 0, inward: true }),
    ];
    const res = buildBands(bands, 1, ctx);
    // 1.1 + 2*.05 = 1.2 ; +0.01 + 0.04 = 1.25 ; text 0.15 -> 1.40
    expect(res.extent).toBeCloseTo(1.4, 12);
    const t = res.prims.find((p) => p.kind === 'text');
    expect(t && t.kind === 'text' && t.arc && Math.abs(t.arc.r - (1.25 + 0.11)) < 1e-12).toBe(true);
    if (t && t.kind === 'text') {
      expect(t.id).toBe('ring:t');
      expect(t.arc?.centerDeg).toBe(-90);
      expect(t.fill).toBe(ctx.ink);
    }
    const out = buildBands([textRingBand('t', 'om', { size: 0.1, gap: 0, inward: false })], 1, ctx);
    const to = out.prims[0];
    expect(to.kind === 'text' && to.arc && Math.abs(to.arc.r - 1.04) < 1e-12).toBe(true);
    // bead centres at r + size
    const beads = res.prims.filter((p) => p.kind === 'circle' && p.layer === 'band:b') as { cx: number; cy: number; r: number }[];
    expect(beads).toHaveLength(20);
    beads.forEach((c) => expect(Math.hypot(c.cx, c.cy)).toBeCloseTo(1.2 + 0.01 + 0.02, 12));
  });

  it('invisible bands take no space and produce nothing', () => {
    const a = standardBands();
    const b = standardBands();
    const hidden = { ...lotusBand('hid', 12, { visible: false, gap: 0.5, height: 0.5 }) };
    b.splice(2, 0, hidden);
    const ra = buildBands(a, 1, ctx);
    const rb = buildBands(b, 1, ctx);
    expect(rb).toEqual(ra);
    expect(rb.prims.some((p) => p.layer === 'band:hid')).toBe(false);
  });

  it('paints outer bands first and adds paper covers when filled', () => {
    const bands: Band[] = [circleBand('in'), lotusBand('lo', 8, { fill: '#c00' }), bhupuraBand('bh', { fill: '#cc0' })];
    const res = buildBands(bands, 1, { ink: '#000', paper: '#fff', filled: true });
    const first = (layer: string) => res.prims.findIndex((p) => p.layer === layer);
    expect(first('band:bh')).toBeLessThan(first('band:lo'));
    expect(first('band:lo')).toBeLessThan(first('band:in'));
    const lotus = res.prims.filter((p) => p.layer === 'band:lo') as PathPrim[];
    const iCover = lotus.findIndex((p) => p.role === 'cover');
    expect(iCover).toBe(8);
    expect(lotus.slice(0, 8).every((p) => p.paint.fill === '#c00' && p.paint.stroke === null)).toBe(true);
    expect(lotus[iCover].paint.fill).toBe('#fff');
    expect(lotus.slice(iCover + 1).every((p) => p.paint.fill === null && p.paint.stroke === '#000')).toBe(true);
    const bh = res.prims.filter((p) => p.layer === 'band:bh') as PathPrim[];
    expect(bh[0].paint.fill).toBe('#cc0');
    expect(bh[1].role).toBe('cover');
    // cover disc has the radius where the bhupura band started (before its gap) = 1 + 0.22
    const cov = bh[1];
    const rr = Math.max(...poly(cov).map((q) => Math.hypot(q.x, q.y)));
    expect(rr).toBeCloseTo(1.22, 2);
  });
});

describe('lotus petals', { timeout: 60000 }, () => {
  it('has the requested count, mirror symmetry and 360/N rotational symmetry', () => {
    for (const shape of SHAPES) {
      const n = 16;
      const res = buildBands([lotusBand('l', n, { shape, fullness: 0.7, tip: 0.5, height: 0.2 })], 1, ctx);
      const ps = paths(res.prims, /^petal:\d+$/);
      expect(ps).toHaveLength(n);
      const step = 360 / n;
      const base = poly(ps[0]);
      for (let i = 0; i < n; i++) {
        const q = poly(ps[i]);
        expect(q.length).toBe(base.length);
        // rotation
        base.forEach((p, k) => {
          const e = rotPt(p, i * step);
          expect(Math.hypot(e.x - q[k].x, e.y - q[k].y)).toBeLessThan(1e-9);
        });
        // mirror about its own axis (axis = -90 + i*step)
        const axis = -90 + i * step;
        const m = q.map((p) => {
          const a = rotPt(p, -axis);
          return rotPt(pt(a.x, -a.y), axis);
        }).reverse();
        q.forEach((p, k) => expect(Math.hypot(p.x - m[k].x, p.y - m[k].y)).toBeLessThan(1e-9));
      }
      // tip points straight up
      const top = ps[0];
      const tip = poly(top).reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a));
      expect(Math.abs(tip.x)).toBeLessThan(1e-6);
      expect(tip.y).toBeCloseTo(-1.2, 6);
    }
  });

  it('tipAtTop false puts a gap at the top', () => {
    const res = buildBands([lotusBand('l', 8, { tipAtTop: false })], 1, ctx);
    const ps = paths(res.prims, /^petal:\d+$/);
    const tip = poly(ps[0]).reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a));
    const ang = (Math.atan2(tip.y, tip.x) * 180) / Math.PI;
    expect(Math.abs(angDiff(ang, -90 + 22.5))).toBeLessThan(1e-6);
  });

  it('keeps every petal inside its own angular sector', () => {
    let worst = -Infinity;
    let count = 0;
    for (const shape of SHAPES)
      for (const fullness of [0, 0.5, 1])
        for (const n of [8, 16, 64])
          for (const tip of [0, 1]) {
            const res = buildBands([lotusBand('l', n, { shape, fullness, tip, height: 0.22 })], 1, ctx);
            const ps = paths(res.prims, /^petal:\d+$/);
            expect(ps).toHaveLength(n);
            const half = 180 / n;
            ps.forEach((p, i) => {
              const axis = -90 + (i * 360) / n;
              for (const q of poly(p, 1e-4)) {
                const a = (Math.atan2(q.y, q.x) * 180) / Math.PI;
                worst = Math.max(worst, Math.abs(angDiff(a, axis)) - half);
                count++;
              }
            });
          }
    expect(count).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(1e-7);
  });

  it('survives extreme parameters without NaN', () => {
    for (const shape of SHAPES)
      for (const n of [4, 128])
        for (const height of [0, 1e-5, 0.6])
          for (const fullness of [-1, 0.5, 3])
            for (const rows of [1, 2] as const) {
              const b = lotusBand('x', n, { shape, height, fullness, tip: fullness, rows, insets: 3, vein: true, fill: '#f00' });
              const res = buildBands([b], 1, { ...ctx, filled: true });
              expect(allNumbers(res.prims).every(Number.isFinite)).toBe(true);
              expect(allNumbers(res.anchors).every(Number.isFinite)).toBe(true);
              expect(Number.isFinite(res.extent)).toBe(true);
            }
  });

  it('row 2: the visible parts of back petals lie outside the front petals and end on their edges', () => {
    for (const shape of SHAPES)
      for (const n of [8, 16, 32])
        for (const fullness of [0.2, 0.9]) {
          const res = buildBands([lotusBand('l', n, { shape, fullness, rows: 2, insets: 1, vein: true, height: 0.24 })], 1, ctx);
          const fronts = paths(res.prims, /^petal:\d+$/).map((p) => poly(p, 1e-6));
          const polys = fronts.map((f) => makePoly(f));
          const edges = fronts.map((f) => f);
          const backs = paths(res.prims, /^(petal|inset|vein)-back:/);
          expect(paths(res.prims, /^petal-back:/).length).toBeGreaterThan(0);
          for (const bk of backs) {
            const pts = poly(bk, 1e-5);
            for (const p of pts) {
              const inside = polys.some((q) => inPoly(p, q));
              if (inside) {
                const dmin = Math.min(...edges.map((f) => distToPolyline(p, f)));
                expect(dmin).toBeLessThan(2e-4);
              }
            }
            // a run that is not the full closed ring must start and end on a front edge (or at the petal tip/free end)
            const ends = [pts[0], pts[pts.length - 1]];
            if (/^petal-back:/.test(bk.role as string)) {
              for (const e of ends) {
                const dmin = Math.min(...edges.map((f) => distToPolyline(e, f)));
                expect(dmin).toBeLessThan(2e-4);
              }
            }
          }
        }
  });

  it('fills close along the base and cover disc follows the fills', () => {
    const res = buildBands([lotusBand('l', 8, { fill: '#f00', rows: 2 })], 1, { ...ctx, filled: true });
    const fills = paths(res.prims, /fill:/);
    expect(fills).toHaveLength(16);
    expect(fills.every((f) => f.d[f.d.length - 1][0] === 'Z')).toBe(true);
    // back fills come before front fills
    expect(fills[0].role).toBe('petal-back-fill:0');
    expect(fills[8].role).toBe('petal-fill:0');
  });

  it('inset copies are nested inside the petal', () => {
    const res = buildBands([lotusBand('l', 8, { insets: 3, vein: true })], 1, ctx);
    const outer = poly(paths(res.prims, /^petal:0$/)[0]);
    const poly0 = makePoly(outer);
    for (let j = 0; j < 3; j++) {
      const ins = poly(paths(res.prims, new RegExp(`^inset:0:${j}$`))[0]);
      ins.forEach((p) => expect(inPoly(p, poly0) || distToPolyline(p, outer) < 1e-6).toBe(true));
    }
    expect(paths(res.prims, /^vein:/)).toHaveLength(8);
  });
});

describe('bhupura', () => {
  const lineVerts = (res: ReturnType<typeof buildBands>, k: number) => poly(paths(res.prims, new RegExp(`^line:${k}$`))[0]);
  const segInter = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return o1 * o2 < -1e-12 && o3 * o4 < -1e-12;
  };

  for (const style of ['classic', 'plain', 'stepped'] as const) {
    it(`${style}: closed, 4-fold symmetric, evenly spaced, non-crossing`, () => {
      const lines = 4, spacing = 0.04;
      const res = buildBands([bhupuraBand('b', { style, lines, spacing, gateWidth: 0.3, gateDepth: 0.13, gateFlare: 1.6, gap: 0 })], 1, ctx);
      const ps = paths(res.prims, /^line:/);
      expect(ps).toHaveLength(lines);
      ps.forEach((p) => expect(p.d[p.d.length - 1][0]).toBe('Z'));
      const L = [0, 1, 2, 3].map((k) => lineVerts(res, k));
      L.forEach((v, k) => {
        // 4-fold symmetry
        for (const q of v) {
          const rq = rotPt(q, 90);
          expect(Math.min(...v.map((w) => Math.hypot(w.x - rq.x, w.y - rq.y)))).toBeLessThan(1e-9);
        }
        // no self-crossing
        const n = v.length;
        for (let i = 0; i < n; i++)
          for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            expect(segInter(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])).toBe(false);
          }
        if (k > 0) {
          const prev = [...L[k - 1], L[k - 1][0]];
          // vertices of line k are at least `spacing` away from line k-1 ...
          v.forEach((p) => expect(distToPolyline(p, prev)).toBeGreaterThanOrEqual(spacing - 1e-9));
          // ... and every edge lies exactly `spacing` outside the matching edge of line k-1
          expect(v.length).toBe(L[k - 1].length);
          const pv = L[k - 1];
          for (let i = 0; i < n; i++) {
            const a = pv[i], b = pv[(i + 1) % n];
            const l = Math.hypot(b.x - a.x, b.y - a.y);
            const nx = (b.y - a.y) / l, ny = -(b.x - a.x) / l; // outward for clockwise polygons
            for (const q of [v[i], v[(i + 1) % n]]) expect((q.x - a.x) * nx + (q.y - a.y) * ny).toBeCloseTo(spacing, 9);
          }
          // lines never cross each other
          const cur = [...v, v[0]];
          for (let i = 0; i + 1 < cur.length; i++)
            for (let j = 0; j + 1 < prev.length; j++) expect(segInter(cur[i], cur[i + 1], prev[j], prev[j + 1])).toBe(false);
        }
      });
      // extent covers the gates
      const geo = bhupuraGeometry(bhupuraBand('b', { style, lines, spacing, gateWidth: 0.3, gateDepth: 0.13, gateFlare: 1.6 }), 1);
      expect(res.extent).toBeCloseTo(1 + 3 * spacing + geo.depth, 12);
      const xs = Math.max(...L[3].map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
      expect(xs).toBeCloseTo(res.extent, 12);
    });
  }

  it('gate geometry: opening width, flare and depth of line 0', () => {
    const res = buildBands([bhupuraBand('b', { lines: 1, style: 'classic', gateWidth: 0.3, gateDepth: 0.2, gateFlare: 1.6, gap: 0 })], 1, ctx);
    const v = lineVerts(res, 0);
    // right-hand side gate (x >= 1): stem half width 0.3, bar half width 0.48, depth 0.2
    const right = v.filter((p) => p.x > 1 + 1e-9);
    expect(right.length).toBeGreaterThan(0);
    expect(Math.max(...right.map((p) => p.x))).toBeCloseTo(1.2, 12);
    expect(Math.max(...right.map((p) => p.y))).toBeCloseTo(0.48, 12);
    const stem = right.filter((p) => Math.abs(p.x - 1.1) < 1e-9 || Math.abs(p.x - 1.2) > 1e-9);
    expect(Math.min(...stem.map((p) => Math.abs(p.y)))).toBeCloseTo(0.3, 12);
    // plain has no flare
    const pl = lineVerts(buildBands([bhupuraBand('b', { lines: 1, style: 'plain', gateWidth: 0.3, gateDepth: 0.2, gap: 0 })], 1, ctx), 0);
    expect(Math.max(...pl.filter((p) => p.x > 1.01).map((p) => p.y))).toBeCloseTo(0.3, 12);
  });

  it('anchors: 4 gates then 4 corners in the documented order', () => {
    const res = buildBands([circleBand('c'), bhupuraBand('b', { gap: 0.07 })], 1, ctx);
    const gates = res.anchors.filter((a) => a.group === 'gates');
    const corners = res.anchors.filter((a) => a.group === 'corners');
    expect(gates).toHaveLength(4);
    expect(corners).toHaveLength(4);
    expect(gates.map((a) => a.id)).toEqual(['gates:0', 'gates:1', 'gates:2', 'gates:3']);
    // bottom, right, top, left
    expect(gates[0].y).toBeGreaterThan(1.07);
    expect(Math.abs(gates[0].x)).toBeLessThan(1e-12);
    expect(gates[1].x).toBeGreaterThan(1.07);
    expect(gates[2].y).toBeLessThan(-1.07);
    expect(gates[3].x).toBeLessThan(-1.07);
    gates.forEach((g) => expect(g.r).toBeGreaterThan(0));
    // bottom-right, top-right, top-left, bottom-left
    expect([corners[0].x > 0 && corners[0].y > 0, corners[1].x > 0 && corners[1].y < 0, corners[2].x < 0 && corners[2].y < 0, corners[3].x < 0 && corners[3].y > 0]).toEqual([true, true, true, true]);
    corners.forEach((c) => {
      expect(c.r).toBeGreaterThan(0.02);
      // free circle really is free: clear of circle r=1 and of the square lines (h0 = 1.07)
      expect(Math.hypot(c.x, c.y) - c.r).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(1.07 - Math.max(Math.abs(c.x), Math.abs(c.y)) - c.r).toBeGreaterThanOrEqual(-1e-9);
    });
  });
});

describe('anchors', () => {
  it('lotus: one per front petal, index 0 at the bottom, then anticlockwise (decreasing angle)', () => {
    const res = buildBands([lotusBand('l', 16, { rows: 2 })], 1, ctx);
    const an = res.anchors.filter((a) => a.group === 'band:l');
    expect(an).toHaveLength(16);
    expect(an[0].id).toBe('band:l:0');
    expect(an[0].outDeg).toBeCloseTo(90, 9);
    expect(an[0].y).toBeGreaterThan(0);
    expect(Math.abs(an[0].x)).toBeLessThan(1e-9);
    an.forEach((a, i) => {
      expect(a.index).toBe(i);
      expect(angDiff(an[0].outDeg - i * 22.5, a.outDeg)).toBeCloseTo(0, 9);
      expect(a.r).toBeGreaterThan(0);
      // position along its axis at 47 % of height
      expect(Math.hypot(a.x, a.y)).toBeCloseTo(1 + 0.47 * 0.22, 9);
    });
    // second one is to the right of the bottom one (bottom -> right -> top -> left)
    expect(an[1].x).toBeGreaterThan(0);
    expect(an[4].outDeg).toBeCloseTo(0, 9);
    expect(an[8].outDeg).toBeCloseTo(-90, 9);
    expect(an[12].outDeg).toBeCloseTo(180, 9);
  });

  it('lotus with a gap at the top: nearest-to-bottom first', () => {
    const res = buildBands([lotusBand('l', 8, { tipAtTop: false })], 1, ctx);
    const an = res.anchors;
    expect(Math.abs(an[0].outDeg - 90)).toBeLessThanOrEqual(22.5 + 1e-9);
    expect(an[0].outDeg).toBeCloseTo(67.5, 9);
    expect(an[1].outDeg).toBeCloseTo(22.5, 9);
  });

  it('anchor circle fits inside the petal', () => {
    for (const shape of SHAPES) {
      const res = buildBands([lotusBand('l', 12, { shape, height: 0.25 })], 1, ctx);
      const petal = paths(res.prims, /^petal:\d+$/)[3];
      const pl = poly(petal, 1e-6);
      const a = res.anchors.find((q) => Math.abs(q.outDeg - (-90 + 3 * 30)) < 1e-6 || Math.abs(q.outDeg - (-90 + 3 * 30 - 360)) < 1e-6);
      expect(a).toBeDefined();
      const c = pt((a as { x: number }).x, (a as { y: number }).y);
      expect(inPoly(c, makePoly(pl))).toBe(true);
      expect(distToPolyline(c, pl)).toBeGreaterThanOrEqual((a as { r: number }).r - 1e-4);
    }
  });

  it('beads: ordered from the bottom, anticlockwise', () => {
    const res = buildBands([beadBand('b', 12, { gap: 0, size: 0.03 })], 1, ctx);
    expect(res.anchors).toHaveLength(12);
    expect(res.anchors[0].outDeg).toBeCloseTo(90, 9);
    expect(res.anchors[0].y).toBeGreaterThan(0);
    expect(res.anchors[1].x).toBeGreaterThan(0);
    expect(res.anchors[3].outDeg).toBeCloseTo(0, 9);
    const odd = buildBands([beadBand('b', 5, { gap: 0 })], 1, ctx).anchors;
    expect(Math.abs(angDiff(odd[0].outDeg, 90))).toBeLessThanOrEqual(36 + 1e-9);
    for (let i = 1; i < 5; i++) expect(angDiff(odd[i - 1].outDeg - 72, odd[i].outDeg)).toBeCloseTo(0, 9);
  });

  it('circle and text bands have no anchors', () => {
    const res = buildBands([circleBand('c'), textRingBand('t', 'x')], 1, ctx);
    expect(res.anchors).toHaveLength(0);
  });
});

describe('beads shapes', () => {
  it('produces the requested shapes', () => {
    for (const shape of ['circle', 'dot', 'diamond', 'triangle'] as const) {
      const res = buildBands([beadBand('b', 24, { shape, fill: '#a00', gap: 0 })], 1, { ...ctx, filled: true });
      const mine = res.prims.filter((p) => p.layer === 'band:b');
      if (shape === 'dot') {
        expect(mine).toHaveLength(24);
        expect(mine.every((p) => p.kind === 'circle' && p.paint.fill === ctx.ink && p.paint.stroke === null)).toBe(true);
      } else {
        expect(mine).toHaveLength(48);
        expect(mine.filter((p) => p.kind === (shape === 'circle' ? 'circle' : 'path') && (p as { paint: { stroke: string | null } }).paint.stroke === null)).toHaveLength(24);
      }
      expect(allNumbers(mine).every(Number.isFinite)).toBe(true);
    }
    // triangles point outward: apex further from the centre than the base
    const t = buildBands([beadBand('b', 4, { shape: 'triangle', gap: 0, size: 0.1 })], 1, ctx).prims[0] as PathPrim;
    const rs = poly(t).slice(0, 3).map((q) => Math.hypot(q.x, q.y));
    expect(rs[0]).toBeGreaterThan(rs[1]);
    expect(rs[0]).toBeCloseTo(1.2, 12);
  });
});

describe('robustness', () => {
  it('no NaN for any band type across parameter ranges', () => {
    const bands: Band[] = [];
    for (const lines of [0, 1, 2, 3, 4, 9])
      for (const style of ['classic', 'plain', 'stepped'] as const)
        for (const gateWidth of [0.1, 0.6, 5])
          for (const gateFlare of [1, 2.2, 10])
            for (const gateDepth of [0, 0.01, 0.3])
              bands.push(bhupuraBand('b' + bands.length, { lines, style, gateWidth, gateFlare, gateDepth, spacing: 0.04, fill: '#abc' }));
    for (const b of bands) {
      const res = buildBands([circleBand('c', { count: 6 }), b], 1, { ...ctx, filled: true });
      expect(allNumbers(res.prims).every(Number.isFinite)).toBe(true);
      expect(allNumbers(res.anchors).every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(res.extent)).toBe(true);
    }
    const mix: Band[] = [
      circleBand('c', { count: 0, spacing: 0 }),
      beadBand('b', 0, { size: 0 }),
      textRingBand('t', '', { size: 0 }),
      lotusBand('l', 3, { height: -1 }),
    ];
    const res = buildBands(mix, 0, { ...ctx, filled: true });
    expect(allNumbers(res.prims).every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(res.extent)).toBe(true);
    expect(buildBands([], 1, ctx)).toEqual({ prims: [], anchors: [], extent: 1 });
  });
});
