import { describe, expect, it } from 'vitest';
import { flattenPath, pathBounds } from './path';
import { buildScene } from './scene';
import { arcPath, crescentPath, freeLoops, symbolPath, validMerges, SYMBOL_NAMES } from './shapes';
import { arcFigure, createDesign, crescentFigure, freeFigure, gridFigure, symbolFigure, PRESETS } from '../presets';

const HERE = { x: 0, y: 0, turnDeg: 0 };

describe('arcs and crescents', () => {
  it('an arc stays on its circle and ends where asked', () => {
    const d = arcPath(arcFigure('a', 0.8, { startDeg: -90, sweepDeg: 180 }), HERE);
    const pts = flattenPath(d, 1e-4)[0].pts;
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(0.8, 3);
    expect(pts[0].x).toBeCloseTo(-0.8, 9); // begins at the left (−90° from up)
    expect(pts[pts.length - 1].x).toBeCloseTo(0.8, 9); // half-way round, at the right
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(-0.8, 3); // passing over the top
  });

  it('a full sweep closes into a circle', () => {
    const d = arcPath(arcFigure('a', 0.5, { startDeg: 0, sweepDeg: 360 }), HERE);
    expect(d[d.length - 1][0]).toBe('Z');
  });

  it('a crescent is closed, has its horns up, and is as thick as asked', () => {
    const f = crescentFigure('c', 1, { thickness: 0.4 });
    const d = crescentPath(f, HERE);
    expect(d[d.length - 1][0]).toBe('Z');
    const sub = flattenPath(d, 1e-5)[0];
    expect(sub.closed).toBe(true);
    const ys = sub.pts.filter((p) => Math.abs(p.x) < 0.01).map((p) => p.y).sort((a, b) => a - b);
    // on the axis the outline is crossed twice near the bottom: outer curve at y = 1, inner at y = 0.6
    expect(ys[ys.length - 1]).toBeCloseTo(1, 2);
    expect(ys[0]).toBeCloseTo(0.6, 2);
    // horns: the highest points, well to either side
    const top = sub.pts.reduce((a, b) => (b.y < a.y ? b : a));
    expect(Math.abs(top.x)).toBeGreaterThan(0.8);
    expect(top.y).toBeLessThan(0);
    // mirror-symmetric
    const b = pathBounds(d);
    expect(b.minX).toBeCloseTo(-b.maxX, 6);
  });

  it('turning a crescent upside down puts its horns at the bottom', () => {
    const d = crescentPath(crescentFigure('c', 1, { thickness: 0.4, rotationDeg: 180 }), HERE);
    const pts = flattenPath(d, 1e-4)[0].pts;
    const low = pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(low.x)).toBeGreaterThan(0.8);
  });

  it('extreme crescent settings never produce broken numbers', () => {
    for (const thickness of [0.02, 0.5, 1.9]) for (const inner of [0.4, 1, 1.6]) {
      const d = crescentPath(crescentFigure('c', 0.7, { thickness, inner }), HERE);
      expect(d.every((c) => c.slice(1).every((v) => Number.isFinite(v as number)))).toBe(true);
    }
  });
});

describe('symbols', () => {
  it('every symbol fits its size and can be placed', () => {
    for (const symbol of SYMBOL_NAMES) {
      const d = symbolPath(symbolFigure('s', symbol, { size: 0.2 }), { x: 1, y: 0, turnDeg: 90 });
      const b = pathBounds(d);
      expect(b.maxX - b.minX).toBeLessThanOrEqual(0.41);
      expect(b.maxY - b.minY).toBeLessThanOrEqual(0.41);
      expect(Math.abs((b.minY + b.maxY) / 2)).toBeLessThan(0.2);
    }
  });

  it('the svastika turns to the right (its top arm bends east)', () => {
    const d = symbolPath(symbolFigure('s', 'swastika', { size: 1 }), HERE);
    const hook = d.findIndex((c, i) => c[0] === 'M' && c[1] === 0 && c[2] === -1 && i > 0);
    const next = d[hook + 1];
    expect(next[0] === 'L' && next[1]).toBe(1);
  });
});

describe('free shapes', () => {
  it('repeat turns the shape evenly about the centre', () => {
    const loops = freeLoops(freeFigure('f', [[0, -1], [0.2, -0.5], [-0.2, -0.5]], { repeat: 4 }));
    expect(loops.length).toBe(4);
    expect(loops[1][0].x).toBeCloseTo(1, 12); // the first point, a quarter turn on
    expect(loops[1][0].y).toBeCloseTo(0, 12);
    expect(freeLoops(freeFigure('f', [[0, 0]])).length).toBe(0); // one point is not a line yet
  });

  it('a closed free shape becomes a place for text; an open line does not', () => {
    const closed = buildScene(createDesign({ centre: [freeFigure('f', [[0, -0.6], [0.5, 0.4], [-0.5, 0.4]])], bands: [] }));
    expect(closed.anchors.filter((a) => a.group === 'regions').length).toBe(1);
    expect(closed.anchors.filter((a) => a.group === 'points').length).toBe(3);
    const open = buildScene(createDesign({ centre: [freeFigure('f', [[0, -0.6], [0.5, 0.4], [-0.5, 0.4]], { closed: false })], bands: [] }));
    expect(open.anchors.filter((a) => a.group === 'regions').length).toBe(0);
  });
});

describe('joined cells', () => {
  it('overlapping or out-of-range blocks are refused', () => {
    expect(validMerges([{ row: 3, col: 3, rows: 3, cols: 3 }], 9, 9).length).toBe(1);
    expect(validMerges([{ row: 0, col: 0, rows: 2, cols: 2 }, { row: 1, col: 1, rows: 2, cols: 2 }], 4, 4).length).toBe(1);
    expect(validMerges([{ row: 3, col: 3, rows: 3, cols: 3 }], 4, 4).length).toBe(0);
    expect(validMerges([{ row: 0, col: 0, rows: 1, cols: 1 }], 4, 4).length).toBe(0);
  });

  it('a joined block has no lines inside it and one text at its middle', () => {
    const plain = buildScene(createDesign({ centre: [gridFigure('g', 3, 3, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])], bands: [] }));
    const joined = buildScene(createDesign({ centre: [gridFigure('g', 3, 3, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], { merges: [{ row: 0, col: 0, rows: 2, cols: 2 }] })], bands: [] }));
    const lines = (s: typeof plain) => { const g = s.prims.find((p) => p.role === 'grid'); return g && g.kind === 'path' ? g.d.length / 2 : 0; };
    expect(lines(plain)).toBe(24);
    expect(lines(joined)).toBe(20); // four inner pieces removed
    const texts = joined.prims.filter((p) => p.kind === 'text');
    expect(texts.length).toBe(6); // 9 − the 3 hidden cells of the block
    const a = texts.find((p) => p.kind === 'text' && p.text === 'a');
    const e = plain.prims.find((p) => p.kind === 'text' && p.text === 'a');
    expect(a && e && a.kind === 'text' && e.kind === 'text' && a.x > e.x && a.y > e.y).toBe(true); // moved to the block's middle
  });

  it("the Vastu grid holds Brahma's nine squares as one", () => {
    const s = buildScene(PRESETS.find((p) => p.id === 'vastu')!.make());
    const t = s.prims.filter((p) => p.kind === 'text');
    expect(t.length).toBe(1);
    expect(t[0].kind === 'text' && Math.hypot(t[0].x, t[0].y)).toBeLessThan(1e-9);
  });
});
