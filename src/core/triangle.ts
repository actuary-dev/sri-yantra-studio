/**
 * Triangles of any shape: where their corners are, and everything that can be
 * measured on them (sides, angles, centres). Scene coordinates (y down).
 */
import type { Placement } from './figures';
import type { Pt } from './planar';
import { buildFigure } from './arrangement';
import { solveGeometry, TRI_NAMES, TRI_SANSKRIT } from './solver';
import type { Design, TriangleFigure, TrianglePivot } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

export type TriangleKind = 'equilateral' | 'isosceles' | 'right' | 'rightIsosceles' | 'scalene';

export interface TriangleMetrics {
  /** side lengths: base, left side (left corner → apex), right side (right corner → apex) */
  base: number;
  left: number;
  right: number;
  /** interior angles in degrees at the left base corner, the right base corner and the apex */
  leftDeg: number;
  rightDeg: number;
  apexDeg: number;
  area: number;
  centroid: Pt;
  incentre: Pt;
  inradius: number;
  circumcentre: Pt;
  circumradius: number;
  kind: TriangleKind;
  /** true when one angle is larger than 90° */
  obtuse: boolean;
}

/** Everything measurable on the triangle [left base corner, right base corner, apex]. */
export function triangleMetrics(pts: [Pt, Pt, Pt]): TriangleMetrics {
  const [L, R, A] = pts;
  const base = dist(L, R), left = dist(L, A), right = dist(R, A);
  const ang = (opp: number, s1: number, s2: number) => deg(Math.acos(clamp((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2 || 1), -1, 1)));
  const leftDeg = ang(right, base, left);
  const rightDeg = ang(left, base, right);
  const apexDeg = 180 - leftDeg - rightDeg;
  const cross = (R.x - L.x) * (A.y - L.y) - (R.y - L.y) * (A.x - L.x);
  const area = Math.abs(cross) / 2;
  const per = base + left + right || 1;
  // incentre: corners weighted by the length of the opposite side
  const incentre = { x: (right * L.x + left * R.x + base * A.x) / per, y: (right * L.y + left * R.y + base * A.y) / per };
  const d = 2 * cross || 1e-300;
  const l2 = L.x * L.x + L.y * L.y, r2 = R.x * R.x + R.y * R.y, a2 = A.x * A.x + A.y * A.y;
  const circumcentre = {
    x: (l2 * (R.y - A.y) + r2 * (A.y - L.y) + a2 * (L.y - R.y)) / d,
    y: (l2 * (A.x - R.x) + r2 * (L.x - A.x) + a2 * (R.x - L.x)) / d,
  };
  const tol = 1e-6 * Math.max(base, left, right, 1e-9);
  const eqLR = Math.abs(left - right) < tol, eqLB = Math.abs(left - base) < tol, eqRB = Math.abs(right - base) < tol;
  const angles = [leftDeg, rightDeg, apexDeg];
  const isRight = angles.some((a) => Math.abs(a - 90) < 1e-6);
  const twoEqual = eqLR || eqLB || eqRB;
  const kind: TriangleKind = eqLR && eqLB ? 'equilateral' : isRight && twoEqual ? 'rightIsosceles' : isRight ? 'right' : twoEqual ? 'isosceles' : 'scalene';
  return {
    base, left, right, leftDeg, rightDeg, apexDeg, area,
    centroid: { x: (L.x + R.x + A.x) / 3, y: (L.y + R.y + A.y) / 3 },
    incentre,
    inradius: (2 * area) / per,
    circumcentre,
    circumradius: area > 0 ? (base * left * right) / (4 * area) : Infinity,
    kind,
    obtuse: angles.some((a) => a > 90 + 1e-6),
  };
}

/** The triangle before it is turned and moved: base on the x axis, centred, apex up (y negative). */
function localPoints(f: Pick<TriangleFigure, 'base' | 'height' | 'skew'>): [Pt, Pt, Pt] {
  const b = clamp(f.base, 1e-4, 20), h = clamp(f.height, 1e-4, 20);
  const k = clamp(f.skew, -20, 20);
  return [{ x: -b / 2, y: 0 }, { x: b / 2, y: 0 }, { x: (k * b) / 2, y: -h }];
}

function pivotOf(pts: [Pt, Pt, Pt], pivot: TrianglePivot): Pt {
  switch (pivot) {
    case 'base':
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    case 'apex':
      return pts[2];
    case 'incentre':
      return triangleMetrics(pts).incentre;
    case 'circumcentre':
      return triangleMetrics(pts).circumcentre;
    default:
      return { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };
  }
}

const CENTRED: Placement = { x: 0, y: 0, turnDeg: 0 };

/** Corners [left base corner, right base corner, apex] in scene coordinates. */
export function trianglePoints(f: TriangleFigure, place: Placement = CENTRED): [Pt, Pt, Pt] {
  const local = localPoints(f);
  const pv = pivotOf(local, f.pivot);
  const x0 = Number.isFinite(f.x) ? f.x : 0, y0 = Number.isFinite(f.y) ? f.y : 0;
  const a1 = rad(Number.isFinite(f.rotationDeg) ? f.rotationDeg : 0);
  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  const a2 = rad(place.turnDeg);
  const c2 = Math.cos(a2), s2 = Math.sin(a2);
  return local.map((p) => {
    const lx = p.x - pv.x, ly = p.y - pv.y;
    // turn about its pivot, move to its place, then (when repeated round the centre) turn and move again
    const px = x0 + lx * c1 - ly * s1, py = y0 + lx * s1 + ly * c1;
    return { x: place.x + px * c2 - py * s2, y: place.y + px * s2 + py * c2 };
  }) as [Pt, Pt, Pt];
}

/* ------------------------------------------------- ways to state a triangle */

export interface TriangleShape {
  base: number;
  height: number;
  skew: number;
}

/** Isosceles triangle with the given base and apex angle. */
export function shapeFromApexAngle(base: number, apexDeg: number): TriangleShape {
  const a = clamp(apexDeg, 0.5, 179.5);
  return { base, height: base / 2 / Math.tan(rad(a / 2)), skew: 0 };
}

/** Triangle from its base and the two angles standing on it (their sum must be below 180°). */
export function shapeFromBaseAngles(base: number, leftDeg: number, rightDeg: number): TriangleShape | null {
  if (!(leftDeg > 0 && rightDeg > 0 && leftDeg + rightDeg < 180)) return null;
  const cot = (d: number) => (Math.abs(d - 90) < 1e-12 ? 0 : 1 / Math.tan(rad(d)));
  const cl = cot(leftDeg), cr = cot(rightDeg);
  const height = base / (cl + cr);
  // foot of the apex measured from the left corner is height·cot(left)
  return { base, height, skew: (height * cl - base / 2) / (base / 2) };
}

/** Triangle from its three sides: base, left side, right side. Null when they cannot close. */
export function shapeFromSides(base: number, left: number, right: number): TriangleShape | null {
  if (!(base > 0 && left > 0 && right > 0) || left + right <= base || base + left <= right || base + right <= left) return null;
  const foot = (left * left + base * base - right * right) / (2 * base);
  const h2 = left * left - foot * foot;
  if (!(h2 > 0)) return null;
  return { base, height: Math.sqrt(h2), skew: (foot - base / 2) / (base / 2) };
}

/** Notable isosceles apex angles and where they come from. */
export const APEX_ANGLES: { deg: number; key: 'equilateral' | 'golden' | 'gnomon' | 'right' | 'pyramid' | 'hexTip' }[] = [
  { deg: 36, key: 'golden' }, // 72°–72°–36°: the point of a pentagram
  { deg: 60, key: 'equilateral' },
  { deg: 180 - 2 * deg(Math.atan(Math.sqrt((1 + Math.sqrt(5)) / 2))), key: 'pyramid' }, // base angles atan(√φ) = 51.827°
  { deg: 90, key: 'right' },
  { deg: 108, key: 'gnomon' }, // 36°–36°–108°
  { deg: 120, key: 'hexTip' },
];

/* --------------------------------------- the Sri Yantra as nine free triangles */

/**
 * The nine triangles of the design's Sri Yantra as separate figures, each exactly
 * where the solver put it. Returns null when the geometry has no solution.
 */
export function sriAsTriangles(design: Pick<Design, 'geometry' | 'triangles'>, radius = 1, idPrefix = 'sri'): { triangles: TriangleFigure[]; bindu: Pt } | null {
  const solved = solveGeometry(design.geometry);
  if (!solved) return null;
  const fig = buildFigure(solved, design.geometry.flip);
  const k = Math.max(0.05, radius);
  const triangles = fig.triangles.map((t, i): TriangleFigure => {
    const [L, R, A] = t.pts;
    const up = A.y < L.y; // scene y grows downward
    return {
      id: `${idPrefix}-${i + 1}`,
      type: 'triangle',
      visible: true,
      label: `${TRI_NAMES[i]} · ${TRI_SANSKRIT[i]}`,
      base: (R.x - L.x) * k,
      height: Math.abs(A.y - L.y) * k,
      skew: 0,
      pivot: 'base',
      x: 0,
      y: L.y * k,
      rotationDeg: up ? 0 : 180,
      lineMm: design.triangles.lineMm,
      lines: Math.max(1, Math.min(3, Math.round(design.triangles.lines))),
      lineGapMm: design.triangles.lineGapMm,
      fill: null,
    };
  });
  return { triangles, bindu: { x: fig.bindu.x * k, y: fig.bindu.y * k } };
}
