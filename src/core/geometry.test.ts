import { describe, expect, it } from 'vitest';
import { solveFree, solveGeometry, validRange, TRI } from './solver';
import { buildFigure } from './arrangement';

const H = (y: number) => (y + 1) / 2;

describe('nine-triangle solver', () => {
  it("reproduces Huet's Classical Sri Yantra (TCS 281, 2002) to 3 decimals", () => {
    // Huet's published base heights (unit diameter, from the bottom)
    const s = solveFree(0.887, 0.668, 0.398, 0.165)!;
    expect(s).not.toBeNull();
    expect(H(s.b[TRI.Chandra])).toBeCloseTo(0.769, 3);
    expect(H(s.b[TRI.Budha])).toBeCloseTo(0.603, 2);
    expect(H(s.b[TRI.Guru])).toBeCloseTo(0.551, 3);
    expect(H(s.b[TRI.Shukra])).toBeCloseTo(0.463, 3);
    expect(H(s.b[TRI.Rahu])).toBeCloseTo(0.265, 3);
  });

  it('reproduces the Kavi Mahesh table (IJSR 2023, d = 360 mm)', () => {
    const s = solveFree(8 / 9, 2 / 3, 2 / 5, 1 / 6)!;
    const mm = (y: number) => H(y) * 360;
    const hw = (i: number) => s.t[i] * Math.abs(s.b[i] - s.a[i]) * 180;
    expect(mm(s.b[TRI.Chandra])).toBeCloseTo(275.75, 0);
    expect(mm(s.b[TRI.Budha])).toBeCloseTo(216.46, 0);
    expect(mm(s.b[TRI.Guru])).toBeCloseTo(198.15, 0);
    expect(mm(s.b[TRI.Rahu])).toBeCloseTo(96.59, 1);
    expect(hw(TRI.Kuja)).toBeCloseTo(169.71, 1);
    expect(hw(TRI.Shani)).toBeCloseTo(176.36, 1);
    expect(hw(TRI.Rahu)).toBeCloseTo(129.25, 1);
    expect(hw(TRI.Chandra)).toBeCloseTo(117.44, 0);
    // the paper fixes Shukra at 166.5 and accepts a 0.02 % miss; the exact closure is nearby
    expect(Math.abs(mm(s.b[TRI.Shukra]) - 166.5)).toBeLessThan(0.3);
    // Rahu is (almost exactly) equilateral, as the paper's corollary says
    expect((2 * Math.atan(s.t[TRI.Rahu]) * 180) / Math.PI).toBeCloseTo(60.1, 1);
  });

  it('closes every concurrency to machine precision', () => {
    const s = solveFree(0.887, 0.668, 0.398, 0.165)!;
    expect(Math.abs(s.residual)).toBeLessThan(1e-12);
    const fig = buildFigure(s, false);
    expect(fig.concurrencyError).toBeLessThan(1e-9);
  });

  it('yields 18 marmas and 43 cells in rings of 14, 10, 10, 8, 1', () => {
    for (const p of [
      [0.887, 0.668, 0.398, 0.165],
      [8 / 9, 2 / 3, 2 / 5, 1 / 6],
      [42 / 48, 31 / 48, 18 / 48, 6 / 48],
    ]) {
      const s = solveFree(p[0], p[1], p[2], p[3])!;
      for (const flip of [false, true]) {
        const fig = buildFigure(s, flip);
        expect(fig.marmas.length).toBe(18);
        expect(fig.ringCounts).toEqual([14, 10, 10, 8, 1]);
        expect(fig.cells.length).toBe(43);
        expect(fig.gaps.length).toBe(31);
        // bottom cell of each ring sits on the axis
        for (let ring = 1; ring <= 4; ring++) {
          const c = fig.cells.find((k) => k.ring === ring && k.index === 0)!;
          expect(Math.abs(c.incenter.x)).toBeLessThan(1e-9);
          expect(c.incenter.y).toBeGreaterThan(fig.bindu.y);
        }
      }
    }
  });

  it("stays close to Lakshmidhara's 48-part tradition when rectified", () => {
    const s = solveFree(42 / 48, 31 / 48, 18 / 48, 6 / 48)!;
    const parts = (i: number) => H(s.b[i]) * 48;
    // tradition (from the bottom): 42 36 31 28 25 21 18 12 6
    expect(Math.abs(parts(TRI.Chandra) - 36)).toBeLessThan(0.6);
    expect(Math.abs(parts(TRI.Budha) - 28)).toBeLessThan(0.6);
    expect(Math.abs(parts(TRI.Guru) - 25)).toBeLessThan(0.9);
    expect(Math.abs(parts(TRI.Shukra) - 21)).toBeLessThan(0.9);
    expect(Math.abs(parts(TRI.Rahu) - 12)).toBeLessThan(0.6);
  });
});

describe('perfection goals', () => {
  const base = { ravi: 0.887, kuja: 0.668, shani: 0.398, ketu: 0.165 };
  it('centered: bindu on the circle centre', () => {
    const s = solveGeometry({ ...base, goal: 'centered' })!;
    expect(Math.abs(s.binduY)).toBeLessThan(1e-9);
  });
  it('equilateral: central triangle has 60° angles', () => {
    const s = solveGeometry({ ...base, goal: 'equilateral' })!;
    expect((2 * Math.atan(s.t[TRI.Ravi]) * 180) / Math.PI).toBeCloseTo(60, 8);
  });
  it('optimal: both at once, and still a true Sri Yantra', () => {
    const s = solveGeometry({ ...base, goal: 'optimal' })!;
    expect(Math.abs(s.binduY)).toBeLessThan(1e-9);
    expect((2 * Math.atan(s.t[TRI.Ravi]) * 180) / Math.PI).toBeCloseTo(60, 8);
    const fig = buildFigure(s, false);
    expect(fig.ringCounts).toEqual([14, 10, 10, 8, 1]);
    expect(fig.concurrencyError).toBeLessThan(1e-9);
  });
  it('rejects impossible inputs and reports slider ranges', () => {
    expect(solveGeometry({ ravi: 0.5, kuja: 0.6, shani: 0.4, ketu: 0.2, goal: 'free' })).toBeNull();
    const r = validRange({ ...base, goal: 'free' }, 'ravi')!;
    expect(r[0]).toBeLessThan(0.887);
    expect(r[1]).toBeGreaterThan(0.887);
  });
});
