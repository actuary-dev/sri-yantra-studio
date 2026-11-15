import { describe, expect, it } from 'vitest';
import { shapeFigure } from '../presets';
import {
  apexAngle, arrangeCopies, dragCorner, flipShape, fromTriangle, insetCorners, mirrorShape, rotateShape, shapeCentre, shapeCorners, triangleRows,
} from './shape';
import { buildScene } from './scene';
import { createDesign } from '../presets';
import type { ShapeFigure, ShapeLock } from './types';

const close = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-9) => {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('free shapes', () => {
  it('a new triangle points up with its apex above the base middle', () => {
    const c = shapeCorners(shapeFigure('a', 'isosceles', 1, { h: 0.8 }));
    close(c[0], { x: 0, y: -0.4 });
    close(c[1], { x: -0.5, y: 0.4 });
    close(c[2], { x: 0.5, y: 0.4 });
  });

  it('equilateral triangles have equal sides and 60° at the apex', () => {
    const f = shapeFigure('a', 'equilateral', 0.7, { rotationDeg: 37, x: 0.2 });
    const c = shapeCorners(f);
    expect(dist(c[0], c[1])).toBeCloseTo(0.7, 12);
    expect(dist(c[1], c[2])).toBeCloseTo(0.7, 12);
    expect(apexAngle(f)).toBeCloseTo(60, 10);
  });

  it('rebuilds any triangle from its three corners', () => {
    const f = shapeFigure('a', 'free', 1);
    const A = { x: 0.3, y: -0.2 }, B = { x: -0.4, y: 0.5 }, C = { x: 0.6, y: 0.1 };
    const g = fromTriangle(f, A, B, C);
    const c = shapeCorners(g);
    close(c[0], A); close(c[1], B); close(c[2], C);
    // the corners given the other way round give the same triangle
    const h = shapeCorners(fromTriangle(f, A, C, B));
    for (const p of [A, B, C]) expect(Math.min(...h.map((q) => dist(p, q)))).toBeLessThan(1e-9);
  });

  const locks: ShapeLock[] = ['equilateral', 'isosceles', 'right', 'free', 'square', 'rect'];
  for (const lock of locks)
    it(`${lock}: a dragged corner lands exactly on its target and the shape keeps its kind`, () => {
      const f = shapeFigure('a', lock, 0.6, { rotationDeg: 12, x: 0.1, y: -0.05 });
      const n = shapeCorners(f).length;
      for (let i = 0; i < n; i++) {
        const target = { x: shapeCorners(f)[i].x + 0.07, y: shapeCorners(f)[i].y - 0.04 };
        const g = dragCorner(f, i, target);
        const c = shapeCorners(g);
        close(c[i], target, 1e-9);
        if (lock === 'equilateral') expect(dist(c[0], c[1])).toBeCloseTo(dist(c[1], c[2]), 9);
        if (lock === 'isosceles') expect(dist(c[0], c[1])).toBeCloseTo(dist(c[0], c[2]), 9);
        if (lock === 'square') expect(dist(c[0], c[1])).toBeCloseTo(dist(c[1], c[2]), 9);
      }
    });

  it('copies turned by 90° about the yantra centre', () => {
    const f = shapeFigure('a', 'isosceles', 0.3, { y: -0.5 });
    const copies = arrangeCopies([f], { mode: 'turn', count: 3, stepDeg: 90, pivot: { x: 0, y: 0 }, axis: 'lr', dx: 0, dy: 0, ratio: 1 });
    expect(copies).toHaveLength(3);
    close(shapeCentre(copies[0][0]), shapeCentre(rotateShape(f, { x: 0, y: 0 }, 90)));
    close({ x: copies[0][0].x, y: copies[0][0].y }, { x: 0.5, y: 0 });
    close({ x: copies[1][0].x, y: copies[1][0].y }, { x: 0, y: 0.5 });
  });

  it('mirror and flip keep the outline exact', () => {
    const f = shapeFigure('a', 'free', 0.5, { skew: 0.3, x: 0.2, rotationDeg: 20 });
    const m = shapeCorners(mirrorShape(f, { x: 0, y: 0 }, 'lr'));
    const o = shapeCorners(f);
    for (const p of o) expect(Math.min(...m.map((q) => dist({ x: -p.x, y: p.y }, q)))).toBeLessThan(1e-9);
    const t = shapeCorners(mirrorShape(f, { x: 0, y: 0.1 }, 'tb'));
    for (const p of o) expect(Math.min(...t.map((q) => dist({ x: p.x, y: 0.2 - p.y }, q)))).toBeLessThan(1e-9);
    const fl = shapeCorners(flipShape(shapeFigure('b', 'isosceles', 1)));
    close(fl[0], { x: 0, y: 0.4 });
  });

  it('rows divide a triangle into rows² small triangles', () => {
    const f: ShapeFigure = shapeFigure('a', 'equilateral', 1, { rows: 4 });
    expect(triangleRows(shapeCorners(f), 4)).toHaveLength(9);
    const d = createDesign({ centre: [f] });
    const scene = buildScene(d);
    expect(scene.anchors.filter((a) => a.group === 'regions')).toHaveLength(16);
  });

  it('inset outlines stay parallel', () => {
    const f = shapeFigure('a', 'isosceles', 1);
    const p = insetCorners(f, 0.05)!;
    expect(p).not.toBeNull();
    expect(p[1].y).toBeCloseTo(0.35, 9);
  });

  it('two triangles crossing make exact crossing points for text', () => {
    const up = shapeFigure('a', 'equilateral', 1);
    const down = flipShape(shapeFigure('b', 'equilateral', 1, { y: 0.15 }));
    const scene = buildScene(createDesign({ centre: [up, down] }));
    expect(scene.anchors.filter((a) => a.group === 'points').length).toBeGreaterThanOrEqual(12);
  });
});
