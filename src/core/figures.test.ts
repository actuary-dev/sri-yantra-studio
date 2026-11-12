import { describe, expect, it } from 'vitest';
import { latticeHollow, latticeLines, orbitPlacements, raySegments } from './figures';
import { arrange } from './planar';
import { buildScene } from './scene';
import { circleFigure, createDesign, gridFigure, latticeFigure, lotusBand, lotusFigure, polygonFigure, raysFigure, PRESETS } from '../presets';
import type { Prim } from './types';

const finite = (prims: Prim[]) =>
  prims.every((p) =>
    p.kind === 'circle'
      ? Number.isFinite(p.cx + p.cy + p.r)
      : p.kind === 'path'
        ? p.d.every((c) => c.slice(1).every((v) => Number.isFinite(v as number)))
        : Number.isFinite(p.x + p.y + p.size),
  );

describe('triangle lattice', () => {
  it('rows n make n² small triangles', () => {
    for (const n of [1, 2, 3, 4, 5, 8]) expect(latticeLines(latticeFigure('l', n)).cells).toBe(n * n);
  });

  it('five rows with an open centre of two leave twenty-one triangles around one', () => {
    const f = latticeFigure('l', 5, { hollow: 2 });
    const { lines, cells } = latticeLines(f);
    expect(cells).toBe(21);
    const a = arrange(lines.map(([p, q]) => ({ a: p, b: q })));
    expect(a.regions.length).toBe(22); // 21 small + the central one
    expect(a.regions.filter((r) => r.pts.length === 3).length).toBe(22);
    // the central triangle is centred on the figure and four times the area of a small one
    const centre = a.regions.reduce((best, r) => (Math.hypot(r.centre.x, r.centre.y) < Math.hypot(best.centre.x, best.centre.y) ? r : best));
    expect(Math.hypot(centre.centre.x, centre.centre.y)).toBeLessThan(1e-9);
    expect(centre.r).toBeCloseTo(2 * Math.min(...a.regions.map((r) => r.r)), 9);
  });

  it('only centre sizes that sit on the lattice are allowed', () => {
    expect(latticeHollow(5, 2)).toBe(2);
    expect(latticeHollow(5, 3)).toBe(2);
    expect(latticeHollow(5, 1)).toBe(0);
    expect(latticeHollow(4, 1)).toBe(1);
    expect(latticeHollow(7, 4)).toBe(4);
    expect(latticeHollow(6, 6)).toBe(3);
  });
});

describe('spokes and repeats', () => {
  it('spokes give one place for text per sector, starting at the bottom', () => {
    const d = createDesign({ centre: [raysFigure('r', 12, { inner: 0.3, outer: 1 })], bands: [] });
    const sectors = buildScene(d).anchors.filter((a) => a.group === 'band:r');
    expect(sectors.length).toBe(12);
    expect(sectors[0].y).toBeGreaterThan(0.5);
    expect(raySegments(raysFigure('r', 27)).segs.length).toBe(27);
  });

  it('a figure repeated around the centre is evenly spaced and faces outward', () => {
    const pl = orbitPlacements({ count: 12, radius: 0.76, phaseDeg: 0 });
    expect(pl.length).toBe(12);
    expect(pl[0].x).toBeCloseTo(0, 12);
    expect(pl[0].y).toBeCloseTo(-0.76, 12);
    expect(pl[3].x).toBeCloseTo(0.76, 12);
    expect(pl[3].turnDeg).toBe(90);
    expect(orbitPlacements(undefined)).toEqual([{ x: 0, y: 0, turnDeg: 0 }]);
    const s = buildScene(createDesign({ centre: [polygonFigure('t', 3, { radius: 0.2, orbit: { count: 12, radius: 0.76, phaseDeg: 0 } })], bands: [] }));
    expect(s.prims.filter((p) => p.layer === 'fig:t').length).toBe(12);
    expect(s.anchors.filter((a) => a.group === 'regions').length).toBe(12);
  });

  it('one copy at a distance simply moves a figure off-centre', () => {
    const s = buildScene(createDesign({ centre: [circleFigure('c', 0.3, { orbit: { count: 1, radius: 0.2, phaseDeg: 0 } })], bands: [] }));
    const c = s.prims.find((p) => p.layer === 'fig:c');
    expect(c && c.kind === 'circle' && Math.abs(c.cx) < 1e-12 && Math.abs(c.cy + 0.2) < 1e-12).toBe(true);
  });
});

describe('lotus rings anywhere', () => {
  it('a petal ring at the centre offers one place per petal', () => {
    const s = buildScene(createDesign({ centre: [lotusFigure('li', 8, 0.2, { height: 0.15 })], bands: [] }));
    expect(s.anchors.filter((a) => a.group === 'band:li').length).toBe(8);
    expect(finite(s.prims)).toBe(true);
  });

  it('two petals stand opposite each other and stay a sensible size', () => {
    const s = buildScene(createDesign({ centre: [], bands: [lotusBand('l', 2, { height: 0.8, tipAtTop: false })] }));
    expect(finite(s.prims)).toBe(true);
    const petals = s.anchors.filter((a) => a.group === 'band:l');
    expect(petals.length).toBe(2);
    expect(petals[0].x * petals[1].x).toBeLessThan(0); // left and right
    expect(Math.abs(petals[0].y)).toBeLessThan(1e-6);
    expect(s.extent).toBeLessThan(2.2);
  });
});

describe('number squares', () => {
  it('heavier block lines every N cells', () => {
    const s = buildScene(createDesign({ centre: [gridFigure('g', 9, 9, Array.from({ length: 81 }, (_, i) => i + 1), { blocks: 3 })], bands: [] }));
    const blocks = s.prims.find((p) => p.role === 'grid-blocks');
    expect(blocks && blocks.kind === 'path' && blocks.d.length).toBe(16); // 4 + 4 lines
  });

  it('the nine planets: every 3 × 3 block is a magic square, totals 15 to 39', () => {
    const d = PRESETS.find((p) => p.id === 'navagraha')!.make();
    const g = d.centre[0];
    if (g.type !== 'grid') throw new Error('expected a grid');
    const num = (s: string) => Number(s.replace(/[०-९]/g, (ch) => String('०१२३४५६७८९'.indexOf(ch))));
    const totals: number[] = [];
    for (let br = 0; br < 3; br++)
      for (let bc = 0; bc < 3; bc++) {
        const v = (r: number, c: number) => num(g.texts[(br * 3 + r) * 9 + bc * 3 + c]);
        const sums = [0, 1, 2].flatMap((i) => [v(i, 0) + v(i, 1) + v(i, 2), v(0, i) + v(1, i) + v(2, i)]);
        sums.push(v(0, 0) + v(1, 1) + v(2, 2), v(0, 2) + v(1, 1) + v(2, 0));
        expect(new Set(sums).size).toBe(1);
        totals.push(sums[0]);
      }
    expect([...totals].sort((a, b) => a - b)).toEqual([15, 18, 21, 24, 27, 30, 33, 36, 39]);
    expect(totals[4]).toBe(15); // the Sun in the middle
  });
});

describe('the starting designs', () => {
  it('have unique ids and draw without errors', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRESETS) expect(finite(buildScene(p.make()).prims), p.id).toBe(true);
  });

  it('the thousand-petalled lotus really has a thousand petals', () => {
    const s = buildScene(PRESETS.find((p) => p.id === 'sahasrara')!.make());
    expect(s.anchors.filter((a) => /^band:s\d+$/.test(a.group)).length).toBe(1000);
  });

  it('each chakra lotus has the right number of lettered petals', () => {
    const want: Record<string, number> = { muladhara: 4, svadhisthana: 6, manipura: 10, anahata: 12, vishuddha: 16, ajna: 2 };
    for (const [id, n] of Object.entries(want)) {
      const d = PRESETS.find((p) => p.id === id)!.make();
      const s = buildScene(d);
      expect(s.anchors.filter((a) => a.group === 'band:l').length, id).toBe(n);
      expect(d.text.sets[0].texts.length, id).toBe(n);
      expect(s.prims.filter((p) => p.kind === 'text').length, id).toBe(n + 1); // letters + seed syllable
    }
  });
});
