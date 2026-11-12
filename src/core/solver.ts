/**
 * Exact solver for the nine interlocking triangles of the Sri Yantra.
 *
 * Mathematics (see docs/MATH.md):
 *  Each triangle i is isosceles and symmetric about the vertical axis, so it is
 *  described by a base height b[i], an apex height a[i] and the tangent t[i] of
 *  half its apex angle. That is 18 unknowns (the apex heights are tied to other
 *  bases or to the circle). The figure demands
 *    - 2 circle constraints   (the two great triangles are inscribed),
 *    - 9 concurrency constraints (18 marma points, in mirror pairs),
 *    - 3 corner-touch constraints (Budha on Rahu, Guru on Shukra, Shukra on Chandra),
 *  leaving 18 − 14 = 4 degrees of freedom — Huet's theorem (2002).
 *
 *  Given the four free base heights plus a trial value for the Shukra base, every
 *  other quantity follows by ruler-and-compass steps in closed form. One
 *  concurrency (M11/M12: Budha × Ketu on the Shukra base) is left over; its
 *  residual is a smooth function of the trial value and is driven to zero by
 *  bisection to machine precision.
 *
 * Internal frame: unit circle, y UP, standard orientation (central triangle down).
 */
import type { GeometrySpec, Goal } from './types';

/** Triangle order, top base to bottom base. Names follow Kavi Mahesh (2023). */
export const TRI = {
  Ravi: 0,
  Chandra: 1,
  Kuja: 2,
  Budha: 3,
  Guru: 4,
  Shukra: 5,
  Shani: 6,
  Rahu: 7,
  Ketu: 8,
} as const;

export const TRI_NAMES = ['Ravi', 'Chandra', 'Kuja', 'Budha', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu'];
export const TRI_SANSKRIT = ['रवि', 'चन्द्र', 'कुज', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'राहु', 'केतु'];
/** true = apex up (Shiva), false = apex down (Shakti) */
export const TRI_UP = [false, false, false, false, false, true, true, true, true];

export interface Solved {
  /** base heights, y up, unit circle */
  b: number[];
  /** apex heights */
  a: number[];
  /** tan(half apex angle) */
  t: number[];
  /** closure residual of the last concurrency (scene units) */
  residual: number;
  /** bindu = incentre of the central triangle */
  binduY: number;
  /** the four parameters (fractions of the diameter) that produced this figure */
  params: { ravi: number; kuja: number; shani: number; ketu: number };
}

const toY = (h: number) => 2 * h - 1;

function construct(bRavi: number, bKuja: number, bShani: number, bKetu: number, bShukra: number) {
  // The two great triangles are inscribed in the circle.
  const tKuja = Math.sqrt(1 - bKuja * bKuja) / (bKuja + 1);
  const tShani = Math.sqrt(1 - bShani * bShani) / (1 - bShani);
  // M3/M6: Chandra passes through (Kuja base × Shani side); apex on Ketu base.
  const tChandra = (tShani * (1 - bKuja)) / (bKuja - bKetu);
  // M13/M16: Rahu passes through (Shani base × Kuja side); apex on Ravi base.
  const tRahu = (tKuja * (bShani + 1)) / (bRavi - bShani);
  // M14/M15: Ketu passes through (Shani base × Chandra side); apex on Kuja base.
  const tKetu = (tChandra * (bShani - bKetu)) / (bKuja - bShani);
  // M17/M18: Rahu base passes through (Kuja side × Ketu side).
  const bRahu = (tKetu * bKuja - tKuja) / (tKuja + tKetu);
  // M4/M5: Ravi passes through (Kuja base × Rahu side); apex on Shukra base.
  const tRavi = (tRahu * (bRavi - bKuja)) / (bKuja - bShukra);
  // M1/M2: Chandra base passes through (Ravi side × Shani side).
  const bChandra = (tShani + tRavi * bShukra) / (tRavi + tShani);
  // Shukra: base corners rest on Chandra's sides; apex on Chandra base.
  const tShukra = (tChandra * (bShukra - bKetu)) / (bChandra - bShukra);
  // M9/M10: Guru base passes through (Ravi side × Ketu side).
  const bGuru = (tRavi * bShukra + tKetu * bKuja) / (tRavi + tKetu);
  // Guru: base corners rest on Shukra's sides; apex on Shani base.
  const tGuru = (tShukra * (bChandra - bGuru)) / (bGuru - bShani);
  // M7/M8: Budha base passes through (Ravi side × Shukra side).
  const bBudha = (tRavi * bShukra + tShukra * bChandra) / (tRavi + tShukra);
  // Budha: base corners rest on Rahu's sides; apex on Rahu base.
  const tBudha = (tRahu * (bRavi - bBudha)) / (bBudha - bRahu);
  // Closure — M11/M12: Budha side and Ketu side must meet ON the Shukra base.
  const residual = tKetu * (bKuja - bShukra) - tBudha * (bShukra - bRahu);

  const b = [bRavi, bChandra, bKuja, bBudha, bGuru, bShukra, bShani, bRahu, bKetu];
  const a = [bShukra, bKetu, -1, bRahu, bShani, bChandra, 1, bRavi, bKuja];
  const t = [tRavi, tChandra, tKuja, tBudha, tGuru, tShukra, tShani, tRahu, tKetu];
  return { b, a, t, residual };
}

function isValid(g: { b: number[]; a: number[]; t: number[] }): boolean {
  const { b, a, t } = g;
  for (let i = 0; i < 9; i++) {
    if (!Number.isFinite(b[i]) || !Number.isFinite(t[i]) || !(t[i] > 1e-4)) return false;
    const hw = t[i] * Math.abs(b[i] - a[i]);
    if (hw * hw + b[i] * b[i] > 1 + 1e-9) return false; // corners inside the circle
  }
  // bases strictly ordered top to bottom with a little breathing room
  for (let i = 0; i < 8; i++) if (!(b[i] - b[i + 1] > 1e-3)) return false;
  if (!(b[0] < 1 - 1e-3) || !(b[8] > -1 + 1e-3)) return false;
  return true;
}

function binduOf(g: { b: number[]; t: number[] }): number {
  // Central triangle: Ravi's tip cut off by the Guru base.
  const H = g.b[TRI.Guru] - g.b[TRI.Shukra];
  const hw = g.t[TRI.Ravi] * H;
  const r = (hw * H) / (hw + Math.hypot(hw, H)); // inradius
  return g.b[TRI.Guru] - r;
}

/** Solve with all four parameters given (fractions of the diameter from the bottom). */
export function solveFree(ravi: number, kuja: number, shani: number, ketu: number): Solved | null {
  if (!(ravi > kuja && kuja > shani && shani > ketu && ravi < 1 && ketu > 0)) return null;
  const bRavi = toY(ravi), bKuja = toY(kuja), bShani = toY(shani), bKetu = toY(ketu);
  const f = (s: number) => construct(bRavi, bKuja, bShani, bKetu, s).residual;
  const lo = bShani + 1e-7;
  const hi = bKuja - 1e-7;
  const STEPS = 240;
  let px = lo;
  let pf = f(lo);
  for (let i = 1; i <= STEPS; i++) {
    const x = lo + ((hi - lo) * i) / STEPS;
    const fx = f(x);
    if (Number.isFinite(pf) && Number.isFinite(fx) && pf * fx <= 0) {
      let u = px, v = x, fu = pf;
      for (let k = 0; k < 80; k++) {
        const m = 0.5 * (u + v);
        const fm = f(m);
        if (fu * fm <= 0) v = m;
        else { u = m; fu = fm; }
      }
      const g = construct(bRavi, bKuja, bShani, bKetu, 0.5 * (u + v));
      if (Math.abs(g.residual) < 1e-10 && isValid(g)) {
        return { ...g, binduY: binduOf(g), params: { ravi, kuja, shani, ketu } };
      }
    }
    px = x;
    pf = fx;
  }
  return null;
}

type P4 = [number, number, number, number];
const TAN30 = Math.tan(Math.PI / 6);

/** Small damped Newton iteration on top of solveFree for the perfection goals. */
function solveGoal(start: P4, unknowns: number[], targets: ((s: Solved) => number)[]): Solved | null {
  const p: P4 = [...start];
  const evalAt = (q: P4) => solveFree(q[0], q[1], q[2], q[3]);
  const n = unknowns.length;
  for (let it = 0; it < 60; it++) {
    const s = evalAt(p);
    if (!s) return null;
    const e = targets.map((fn) => fn(s));
    if (Math.max(...e.map(Math.abs)) < 1e-11) return s;
    const h = 1e-6;
    const J: number[][] = [];
    for (let r = 0; r < n; r++) J.push(new Array(n).fill(0));
    for (let c = 0; c < n; c++) {
      const q: P4 = [...p];
      q[unknowns[c]] += h;
      const sq = evalAt(q);
      if (!sq) return null;
      for (let r = 0; r < n; r++) J[r][c] = (targets[r](sq) - e[r]) / h;
    }
    let d: number[];
    if (n === 1) d = [e[0] / J[0][0]];
    else {
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      if (Math.abs(det) < 1e-14) return null;
      d = [(e[0] * J[1][1] - e[1] * J[0][1]) / det, (J[0][0] * e[1] - J[1][0] * e[0]) / det];
    }
    for (let c = 0; c < n; c++) p[unknowns[c]] -= Math.max(-0.015, Math.min(0.015, d[c]));
  }
  return null;
}

const centered = (s: Solved) => s.binduY;
const equilateral = (s: Solved) => s.t[TRI.Ravi] - TAN30;

/** Which of the four parameters the solver determines itself for each goal. */
export const GOAL_SOLVES: Record<Goal, ('ravi' | 'kuja' | 'shani' | 'ketu')[]> = {
  free: [],
  centered: ['shani'],
  equilateral: ['kuja'],
  optimal: ['kuja', 'shani'],
};

/** Solve a geometry spec, honouring its goal. Returns null when no valid figure exists. */
export function solveGeometry(spec: Pick<GeometrySpec, 'ravi' | 'kuja' | 'shani' | 'ketu' | 'goal'>): Solved | null {
  const p: P4 = [spec.ravi, spec.kuja, spec.shani, spec.ketu];
  switch (spec.goal) {
    case 'free':
      return solveFree(...p);
    case 'centered':
      return solveGoal(p, [2], [centered]) ?? solveGoal([p[0], p[1], 0.38, p[3]], [2], [centered]);
    case 'equilateral':
      return solveGoal(p, [1], [equilateral]) ?? solveGoal([p[0], 0.66, p[2], p[3]], [1], [equilateral]);
    case 'optimal':
      return solveGoal(p, [1, 2], [centered, equilateral]) ?? solveGoal([p[0], 0.656, 0.382, p[3]], [1, 2], [centered, equilateral]);
  }
}

/**
 * The contiguous range of values of one parameter (others fixed) for which a
 * valid figure exists, for driving slider limits. Returns null if the current
 * spec itself has no solution.
 */
export function validRange(
  spec: Pick<GeometrySpec, 'ravi' | 'kuja' | 'shani' | 'ketu' | 'goal'>,
  key: 'ravi' | 'kuja' | 'shani' | 'ketu',
): [number, number] | null {
  if (!solveGeometry(spec)) return null;
  const step = 0.004;
  const probe = (v: number) => solveGeometry({ ...spec, [key]: v }) !== null;
  let lo = spec[key];
  let hi = spec[key];
  while (lo - step > 0.02 && probe(lo - step)) lo -= step;
  while (hi + step < 0.98 && probe(hi + step)) hi += step;
  return [lo, hi];
}
