/** Geometry of the simple centre figures: polygons, stars, number squares. Scene coordinates (y down). */
import type { GridFigure, PolygonFigure } from './types';
import type { Pt } from './planar';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

export interface PolygonLoops {
  /** one array of loops per nested copy; each loop is a closed run of corners (2 corners = a single line) */
  copies: { radius: number; loops: Pt[][] }[];
  /** distance from the centre to the middle of a side, as a fraction of the corner radius */
  apothemRatio: number;
}

/**
 * Corners of a regular polygon or star {sides/step}. When sides and step share a
 * factor the star splits into separate interlaced polygons — sides 6, step 2 is the
 * hexagram made of two triangles.
 */
export function polygonLoops(f: PolygonFigure): PolygonLoops {
  const n = Math.round(clamp(f.sides, 3, 36));
  const k = Math.round(clamp(f.step, 1, Math.max(1, Math.floor(n / 2))));
  const d = gcd(n, k);
  const per = n / d;
  const nest = Math.round(clamp(f.nest, 1, 12));
  const ratio = clamp(f.nestRatio, 0.2, 0.98);
  const base = clamp(f.radius, 0.005, 5);
  const copies: PolygonLoops['copies'] = [];
  for (let c = 0; c < nest; c++) {
    const r = base * Math.pow(ratio, c);
    const loops: Pt[][] = [];
    for (let s = 0; s < d; s++) {
      const loop: Pt[] = [];
      for (let i = 0; i < per; i++) {
        const idx = (s + i * k) % n;
        const a = ((-90 + (Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0) + (idx * 360) / n) * Math.PI) / 180;
        loop.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      loops.push(loop);
    }
    copies.push({ radius: r, loops });
  }
  return { copies, apothemRatio: Math.cos((Math.PI * k) / n) };
}

export interface GridLayout {
  rows: number;
  cols: number;
  cell: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
}

export function gridLayout(f: GridFigure): GridLayout {
  const rows = Math.round(clamp(f.rows, 1, 12));
  const cols = Math.round(clamp(f.cols, 1, 12));
  const width = clamp(f.size, 0.02, 5);
  const cell = width / cols;
  const height = cell * rows;
  return { rows, cols, cell, x0: -width / 2, y0: -height / 2, width, height };
}
