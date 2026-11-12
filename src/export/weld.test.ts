import { describe, expect, it } from 'vitest';
import { flattenPath, transformPath } from '../core/path';
import { loadShaper } from '../text';
import { weldContours } from './weld';

type P = { x: number; y: number };
const sq = (x: number, y: number, s: number, reverse = false): P[] => {
  const r = [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
  return reverse ? r.reverse() : r;
};
const area = (c: P[]) => Math.abs(c.reduce((s, p, i) => s + p.x * c[(i + 1) % c.length].y - c[(i + 1) % c.length].x * p.y, 0) / 2);

function crossings(rings: P[][]): number {
  const segs: [P, P, number][] = [];
  rings.forEach((r, k) => r.forEach((p, i) => segs.push([p, r[(i + 1) % r.length], k])));
  const ccw = (a: P, b: P, c: P) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let n = 0;
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b, ka] = segs[i], [c, d, kb] = segs[j];
      if (ka === kb) continue;
      if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)) continue;
      const d1 = ccw(a, b, c), d2 = ccw(a, b, d), d3 = ccw(c, d, a), d4 = ccw(c, d, b);
      if (d1 * d2 < -1e-12 && d3 * d4 < -1e-12) n++;
    }
  return n;
}

describe('weldContours', () => {
  it('merges two overlapping solids and keeps a counter', () => {
    const out = weldContours([sq(0, 0, 10), sq(8, 0, 10), sq(2, 2, 3, true)]);
    expect(out.length).toBe(2); // one outline + one hole
    const total = out.map(area).sort((a, b) => b - a);
    expect(total[0]).toBeCloseTo(180, 6); // 100 + 100 − 20 overlap
    expect(total[1]).toBeCloseTo(9, 6);
  });

  it('leaves separate shapes alone', () => {
    expect(weldContours([sq(0, 0, 1), sq(5, 5, 1)]).length).toBe(2);
    expect(weldContours([sq(0, 0, 1)]).length).toBe(1);
  });

  it('removes every crossing between joined Devanagari letters', async () => {
    const shaper = await loadShaper();
    let before = 0;
    for (const word of ['नमः', 'श्रीमहात्रिपुरसुन्दर्यै', 'कमल']) {
      const shaped = shaper.shape(word, 'tiro');
      const contours = flattenPath(transformPath(shaped.path, [10, 0, 0, 10, 0, 0]), 0.02)
        .filter((s) => s.closed)
        .map((s) => {
          const a = s.pts[0], b = s.pts[s.pts.length - 1];
          return Math.hypot(a.x - b.x, a.y - b.y) < 1e-9 ? s.pts.slice(0, -1) : s.pts;
        });
      before += crossings(contours);
      const welded = weldContours(contours);
      expect(crossings(welded), word).toBe(0);
      expect(welded.length, word).toBeLessThanOrEqual(contours.length);
      expect(welded.length).toBeGreaterThan(0);
    }
    // the raw glyph outlines really do overlap — this is the defect welding removes
    expect(before).toBeGreaterThan(0);
  }, 30000);
});
