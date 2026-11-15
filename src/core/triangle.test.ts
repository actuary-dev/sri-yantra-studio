import { describe, expect, it } from 'vitest';
import { analyse, angleAt, bearing, lineDirection } from './analyse';
import { buildScene } from './scene';
import { APEX_ANGLES, shapeFromApexAngle, shapeFromBaseAngles, shapeFromSides, sriAsTriangles, triangleMetrics, trianglePoints } from './triangle';
import type { SceneLine, TriangleFigure } from './types';
import { createDesign, GEOMETRIES, PRESETS, triangleFigure } from '../presets';

const tri = (p: Partial<TriangleFigure> = {}): TriangleFigure => triangleFigure('t', p);

describe('free triangles', () => {
  it('measures a 3-4-5 triangle', () => {
    const s = shapeFromSides(5, 4, 3)!;
    const m = triangleMetrics(trianglePoints(tri({ ...s })));
    expect(m.base).toBeCloseTo(5, 12);
    expect(m.left).toBeCloseTo(4, 12);
    expect(m.right).toBeCloseTo(3, 12);
    expect(m.apexDeg).toBeCloseTo(90, 9);
    expect(m.kind).toBe('right');
    expect(m.area).toBeCloseTo(6, 12);
    expect(m.inradius).toBeCloseTo(1, 12);
    expect(m.circumradius).toBeCloseTo(2.5, 12);
  });

  it('builds isosceles triangles from an apex angle', () => {
    const eq = triangleMetrics(trianglePoints(tri(shapeFromApexAngle(1, 60))));
    expect(eq.kind).toBe('equilateral');
    const golden = triangleMetrics(trianglePoints(tri(shapeFromApexAngle(1, 36))));
    expect(golden.kind).toBe('isosceles');
    expect(golden.leftDeg).toBeCloseTo(72, 9);
    expect(golden.left / golden.base).toBeCloseTo((1 + Math.sqrt(5)) / 2, 9); // the golden ratio
    const pyramid = APEX_ANGLES.find((a) => a.key === 'pyramid')!;
    expect(triangleMetrics(trianglePoints(tri(shapeFromApexAngle(1, pyramid.deg)))).leftDeg).toBeCloseTo(51.8273, 3);
  });

  it('builds a triangle from the two angles on its base', () => {
    const s = shapeFromBaseAngles(2, 30, 90)!;
    const m = triangleMetrics(trianglePoints(tri(s)));
    expect(m.leftDeg).toBeCloseTo(30, 9);
    expect(m.rightDeg).toBeCloseTo(90, 9);
    expect(m.apexDeg).toBeCloseTo(60, 9);
    expect(s.skew).toBeCloseTo(1, 9); // apex stands over the right corner
    expect(shapeFromBaseAngles(1, 100, 90)).toBeNull();
    expect(shapeFromSides(1, 1, 3)).toBeNull();
  });

  it('pins the chosen point to the stated position and turns about it', () => {
    for (const pivot of ['centroid', 'incentre', 'circumcentre', 'base', 'apex'] as const) {
      const f = tri({ base: 0.8, height: 0.5, skew: 0.4, pivot, x: 0.3, y: -0.2, rotationDeg: 37 });
      const pts = trianglePoints(f);
      const m = triangleMetrics(pts);
      const at = pivot === 'base' ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pivot === 'apex' ? pts[2] : m[pivot];
      expect(at.x).toBeCloseTo(0.3, 10);
      expect(at.y).toBeCloseTo(-0.2, 10);
      expect(m.base).toBeCloseTo(0.8, 10); // turning changes no length
    }
    // apex up at 0°, down at 180°
    expect(trianglePoints(tri({ pivot: 'base' }))[2].y).toBeLessThan(0);
    expect(trianglePoints(tri({ pivot: 'base', rotationDeg: 180 }))[2].y).toBeGreaterThan(0);
  });

  it('draws, fills the anchor groups and can be repeated round the centre', () => {
    const d = createDesign({ centre: [tri({ base: 0.5, height: 0.6, skew: 0.5, pivot: 'base', y: -0.2, orbit: { count: 6, radius: 0.3, phaseDeg: 0 } })], bands: [] });
    const s = buildScene(d);
    expect(s.prims.filter((p) => p.layer === 'fig:t').length).toBe(6);
    expect(s.lines.length).toBe(18);
    expect(s.anchors.some((a) => a.group === 'regions')).toBe(true);
  });
});

describe('the Sri Yantra as nine free triangles', () => {
  it('reproduces the solved figure exactly', () => {
    for (const g of Object.values(GEOMETRIES)) {
      const design = createDesign({ geometry: { ...g } });
      const whole = buildScene(design);
      const parts = sriAsTriangles(design)!;
      expect(parts.triangles).toHaveLength(9);
      const split = buildScene({ ...design, centre: parts.triangles, bindu: { ...design.bindu, ...parts.bindu } });
      const key = (l: SceneLine) => [l.a, l.b].map((p) => `${p.x.toFixed(9)},${p.y.toFixed(9)}`).sort().join('|').replace(/-0\.000000000/g, '0.000000000');
      expect(split.lines.map(key).sort()).toEqual(whole.lines.map(key).sort());
      // still perfectly concurrent: the general checker finds nothing to complain about
      expect(analyse(split.lines, split.rounds).nearMisses).toEqual([]);
      // every one of them is isosceles and upright
      for (const t of parts.triangles) expect(triangleMetrics(trianglePoints(t)).kind === 'isosceles' || triangleMetrics(trianglePoints(t)).kind === 'equilateral').toBe(true);
    }
  });

  it('notices when one triangle is nudged out of true', () => {
    const design = createDesign();
    const parts = sriAsTriangles(design)!;
    const moved = parts.triangles.map((t, i) => (i === 4 ? { ...t, y: t.y + 0.002 } : t));
    const s = buildScene({ ...design, centre: moved, guides: { ...design.guides, checks: true } });
    const report = analyse(s.lines, s.rounds);
    expect(report.nearMisses.length).toBeGreaterThan(0);
    expect(report.nearMisses[0].error).toBeGreaterThan(1e-4);
    expect(report.nearMisses[0].error).toBeLessThan(0.005);
    expect(s.prims.some((p) => p.layer === 'guides' && p.role?.startsWith('check:'))).toBe(true);
  });
});

describe('accuracy checks on any yantra', () => {
  const seg = (x1: number, y1: number, x2: number, y2: number): SceneLine => ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, owner: 'x' });

  it('finds three lines that nearly meet', () => {
    const exact = analyse([seg(-1, 0, 1, 0), seg(0, -1, 0, 1), seg(-1, -1, 1, 1)], []);
    expect(exact.nearMisses).toEqual([]);
    const off = analyse([seg(-1, 0, 1, 0), seg(0, -1, 0, 1), seg(-1, -1.002, 1, 0.998)], []);
    expect(off.nearMisses).toHaveLength(1);
    expect(off.nearMisses[0].kind).toBe('crossing');
    expect(off.nearMisses[0].error).toBeCloseTo(0.002 * Math.SQRT2, 6);
  });

  it('finds a corner that stops short of a line or a circle', () => {
    const r = analyse([seg(-1, 0, 1, 0), seg(0, -0.002, 0, -1)], []);
    expect(r.nearMisses.map((m) => m.kind)).toEqual(['corner']);
    expect(r.nearMisses[0].error).toBeCloseTo(0.002, 9);
    const c = analyse([seg(0, 0, 0.998, 0)], [{ x: 0, y: 0, r: 1 }]);
    expect(c.nearMisses.map((m) => m.kind)).toEqual(['circle']);
    expect(analyse([seg(0, 0, 1, 0)], [{ x: 0, y: 0, r: 1 }]).nearMisses).toEqual([]);
  });

  it('reads directions, the angle grid and symmetry', () => {
    const hexagram = buildScene(PRESETS.find((p) => p.id === 'shatkona')!.make());
    const r = analyse(hexagram.lines, hexagram.rounds);
    expect(r.directions.map((d) => Math.round(d))).toEqual([0, 60, 120]);
    expect(r.angleGrid).toBe(60);
    expect(r.symmetry).toMatchObject({ mirrorX: true, mirrorY: true, turns: 6 });
    const skew = analyse([seg(-1, 0, 1, 0), seg(-1, 0, 0.3, -1), seg(1, 0, 0.3, -1)], []);
    expect(skew.symmetry.mirrorX).toBe(false);
    expect(skew.symmetry.turns).toBe(1);
    const nearly = analyse([seg(-1, 0, 1, 0), seg(-1, 0, 0.002, -1), seg(1, 0, 0.002, -1)], []);
    expect(nearly.symmetry.mirrorX).toBe(false);
    expect(nearly.symmetry.mirrorXError).toBeCloseTo(0.004, 6);
  });

  it('measures angles and bearings', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(90, 12);
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0, 12); // straight up
    expect(bearing({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 12);
    expect(lineDirection({ x: 0, y: 0 }, { x: 1, y: -1 })).toBeCloseTo(45, 12);
  });

  it('finds no fault in any starting design', () => {
    for (const p of PRESETS) {
      if (p.id === 'sahasrara') continue;
      const s = buildScene(p.make());
      expect(analyse(s.lines, s.rounds).nearMisses, p.id).toEqual([]);
    }
  });
});
