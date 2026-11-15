import { describe, expect, it } from 'vitest';
import { buildScene, shapeCorners } from '../core';
import { circleFigure, createDesign, shapeFigure } from '../presets';
import { collectSnaps, snapPoint } from './snap';
import { checkCorners, fixCorners, polygonToShapes } from './shapeOps';
import { polygonFigure } from '../presets';

describe('snapping and fixing corners', () => {
  const circle = circleFigure('c', 1, { lineMm: 0.5 });
  const design = createDesign({ centre: [circle], bands: [] });
  const scene = buildScene(design);
  const snaps = collectSnaps(scene, new Set(), null, 0.05);

  it('finds the circle, its centre and the centre lines', () => {
    expect(snaps.circles.length).toBeGreaterThan(0);
    const top = snapPoint({ x: 0.01, y: -1.01 }, snaps, 0.05)!;
    expect(top.point).toBe(true);
    expect(top.p.x).toBeCloseTo(0, 12);
    expect(top.p.y).toBeCloseTo(-1, 12);
  });

  it('pulls a turned triangle onto the circle without changing its angle', () => {
    // a triangle turned 90°, its tip a hair inside the circle and not on the centre line
    const f = shapeFigure('t', 'isosceles', 0.5, { rotationDeg: 90, x: 0.7, y: 0.1, h: 0.58 });
    const tip = shapeCorners(f)[0];
    expect(Math.hypot(tip.x, tip.y)).toBeLessThan(1);
    const before = checkCorners([f], snaps, 0.05);
    expect(before[0].exact).toBe(false);
    const { shapes } = fixCorners([f], snaps, 0.05);
    const g = shapes[0];
    expect(g.rotationDeg).toBeCloseTo(90, 9);
    const p = shapeCorners(g)[0];
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9);
  });

  it('an equilateral triangle grows onto the circle about its centre', () => {
    const f = shapeFigure('e', 'equilateral', 1.7, { rotationDeg: 0, y: -(1.7 * Math.sqrt(3)) / 12 });
    const { shapes } = fixCorners([f], snaps, 0.1);
    for (const p of shapeCorners(shapes[0])) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9);
    expect(shapes[0].rotationDeg).toBeCloseTo(0, 9);
  });

  it('turns a six-pointed star into two movable triangles at the same place', () => {
    const star = polygonFigure('s', 6, { step: 2, radius: 0.8 });
    const shapes = polygonToShapes(star);
    expect(shapes).toHaveLength(2);
    for (const s of shapes) for (const p of shapeCorners(s)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(0.8, 9);
  });
});
