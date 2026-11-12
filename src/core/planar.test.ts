import { describe, expect, it } from 'vitest';
import { arrange, type Seg } from './planar';
import { polygonLoops } from './figures';
import { buildScene } from './scene';
import { createDesign, polygonFigure, gridFigure, circleFigure, simpleBands } from '../presets';
import type { PolygonFigure } from './types';

const segsOf = (f: PolygonFigure): Seg[] => {
  const out: Seg[] = [];
  for (const c of polygonLoops(f).copies)
    for (const loop of c.loops) loop.forEach((p, i) => out.push({ a: p, b: loop[(i + 1) % loop.length] }));
  return out;
};

describe('general arrangement', () => {
  it('hexagram: 12 points, 6 tips + 1 hexagon', () => {
    const a = arrange(segsOf(polygonFigure('h', 6, { step: 2 })));
    expect(a.points.length).toBe(12);
    expect(a.regions.length).toBe(7);
    expect(a.regions.filter((r) => r.pts.length === 3).length).toBe(6);
    const hex = a.regions.find((r) => r.pts.length === 6)!;
    expect(Math.hypot(hex.centre.x, hex.centre.y)).toBeLessThan(0.05);
  });

  it('pentagram: 10 points, 5 tips + 1 pentagon', () => {
    const a = arrange(segsOf(polygonFigure('p', 5, { step: 2 })));
    expect(a.points.length).toBe(10);
    expect(a.regions.length).toBe(6);
  });

  it('nested triangles that do not touch: the ring between them is one region whose label sits inside the ring', () => {
    const outer = polygonFigure('o', 3, { rotationDeg: 180 });
    const a = arrange(segsOf({ ...outer, nest: 2, nestRatio: 0.5 }));
    expect(a.points.length).toBe(6);
    expect(a.regions.length).toBe(2);
    const inner = polygonLoops({ ...outer, radius: 0.5 }).copies[0].loops[0];
    const ring = a.regions.find((r) => r.r < 0.2)!;
    // the ring's label point must NOT fall inside the inner triangle
    const inside = (p: { x: number; y: number }) => {
      let s = 0;
      for (let i = 0; i < 3; i++) {
        const u = inner[i], v = inner[(i + 1) % 3];
        s += Math.sign((v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x));
      }
      return Math.abs(s) === 3;
    };
    expect(inside(ring.centre)).toBe(false);
    expect(ring.r).toBeGreaterThan(0.05);
  });

  it('copes with nothing, a single line and very dense stars', () => {
    expect(arrange([]).regions.length).toBe(0);
    expect(arrange([{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }]).regions.length).toBe(0);
    const dense = arrange(segsOf(polygonFigure('d', 24, { step: 11 })));
    expect(dense.points.length).toBeGreaterThan(100);
    for (const r of dense.regions) expect(Number.isFinite(r.centre.x + r.centre.y + r.r)).toBe(true);
  });
});

describe('generic yantras', () => {
  it('draws without any Sri Yantra figure and offers places for text', () => {
    const d = createDesign({ centre: [polygonFigure('h', 6, { step: 2 }), polygonFigure('t', 3, { radius: 0.36 })], bands: simpleBands() });
    const s = buildScene(d);
    expect(s.report.hasSri).toBe(false);
    expect(s.report.ok).toBe(true);
    expect(s.anchors.filter((a) => a.group === 'points').length).toBe(15);
    expect(s.anchors.filter((a) => a.group === 'regions').length).toBe(8); // 6 tips + ring around the triangle + the triangle
    expect(s.anchors.filter((a) => a.group === 'marma').length).toBe(0);
    expect(s.anchors.some((a) => a.group === 'bindu')).toBe(true);
  });

  it('an empty centre is a valid design', () => {
    const s = buildScene(createDesign({ centre: [], bands: simpleBands() }));
    expect(s.report.ok).toBe(true);
    expect(s.prims.length).toBeGreaterThan(3);
  });

  it('number squares put one text in each cell and obey the text switch', () => {
    const d = createDesign({ centre: [gridFigure('g', 3, 3, [6, 1, 8, 7, 5, 3, 2, 9, 4]), circleFigure('c', 0.95)], bands: [] });
    const s = buildScene(d);
    const texts = s.prims.filter((p) => p.kind === 'text');
    expect(texts.length).toBe(9);
    expect(texts.map((p) => (p.kind === 'text' ? p.text : '')).join('')).toBe('६१८७५३२९४');
    expect(buildScene({ ...d, text: { ...d.text, visible: false } }).prims.filter((p) => p.kind === 'text').length).toBe(0);
  });

  it('old saved designs without a centre list still show their Sri Yantra', () => {
    const d = createDesign();
    const legacy = { ...d } as Record<string, unknown>;
    delete legacy.centre;
    const s = buildScene(legacy as never);
    expect(s.report.hasSri).toBe(true);
    expect(s.report.ringCounts).toEqual([14, 10, 10, 8, 1]);
  });

  it('a smaller Sri Yantra keeps all its places for text, scaled', () => {
    const d = createDesign();
    d.centre = [{ id: 'sri', type: 'sri', visible: true, radius: 0.5 }];
    const s = buildScene(d);
    expect(s.anchors.filter((a) => a.group === 'cells').length).toBe(43);
    expect(Math.max(...s.anchors.filter((a) => a.group === 'marma').map((a) => Math.hypot(a.x, a.y)))).toBeLessThan(0.5);
    expect(s.anchors.filter((a) => a.group === 'regions').length).toBe(74);
    expect(s.anchors.filter((a) => a.group === 'points').length).toBe(69);
  });
});
