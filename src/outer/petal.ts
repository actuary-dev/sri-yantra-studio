/**
 * Lotus petal geometry in a LOCAL frame: the petal axis is +x, lateral is y,
 * the origin is the yantra centre. The base points sit on the circle of radius
 * r at ±h (h = half the angular sector = π/N), the tip at (r + height, 0).
 *
 * The right half-outline (y ≥ 0) is two cubic Béziers B→M→T that join G1 at the
 * "belly" point M. The tangent angles at B, M and T are derived from the shape
 * table below; the left half is its exact mirror image. The half-outline is
 * checked numerically against the petal's own angular sector and, if needed,
 * the bow is reduced until it fits (neighbouring petals can never overlap).
 */
import type { PetalShape } from '../core/types';
import { Seg, Pt, pt, clamp, mirrorSeg, reverseSeg, cubicAt } from './geom';

const D2R = Math.PI / 180;

interface Def {
  /** belly position along the base→tip x-range (0..1) */
  um: number;
  /** belly half-width as fraction of the sector half-width at that x: rho0 + rho1·fullness */
  rho0: number;
  rho1: number;
  /** start tangent angle at the base as a fraction of the sector half-angle */
  q0: number;
  /** tangent angle at the belly as a fraction of the belly→tip chord angle (inward) */
  fS: number;
  /** arrival angle at the tip as a fraction of the belly→tip chord angle: fE0 (blunt tip=0) … fE1 (sharp tip=1) */
  fE0: number;
  fE1: number;
  /** handle x-extent fractions of the second segment */
  aF: number;
  bF: number;
}

const DEFS: Record<PetalShape, Def> = {
  classic: { um: 0.36, rho0: 0.7, rho1: 0.27, q0: 0.8, fS: 0.28, fE0: 0.6, fE1: 0.14, aF: 0.45, bF: 0.36 },
  pointed: { um: 0.42, rho0: 0.62, rho1: 0.35, q0: 0.7, fS: 0.8, fE0: 1.0, fE1: 0.6, aF: 0.4, bF: 0.35 },
  round: { um: 0.5, rho0: 0.82, rho1: 0.15, q0: 0.75, fS: 0, fE0: 1.9, fE1: 1.5, aF: 0.5, bF: 0.3 },
  flame: { um: 0.3, rho0: 0.5, rho1: 0.35, q0: 0.55, fS: 0.12, fE0: 0.2, fE1: 0.05, aF: 0.5, bF: 0.45 },
  lotus: { um: 0.3, rho0: 0.9, rho1: 0.08, q0: 0.92, fS: 0.45, fE0: 0.5, fE1: 0.18, aF: 0.45, bF: 0.36 },
};

export interface PetalProfile {
  /** half sector angle, radians */
  h: number;
  r: number;
  H: number;
  /** base point (bx, ±by) */
  bx: number;
  by: number;
  /** tip x */
  tx: number;
  /** open outline B- → M- → T → M+ → B+ (4 cubics, left half first, y<0 first) */
  outline: Seg[];
  /** right half (y ≥ 0), B+ → M → T */
  half: Seg[];
}

export function petalProfile(shape: PetalShape, n: number, rIn: number, height: number, fullness: number, tip: number): PetalProfile {
  const def = DEFS[shape] ?? DEFS.classic;
  const r = Math.max(1e-6, rIn);
  const H = Math.max(1e-4, height);
  const h = Math.PI / n;
  const th = Math.tan(h);
  const bx = r * Math.cos(h), by = r * Math.sin(h), tx = r + H;
  const f = clamp(fullness, 0, 1), k = clamp(tip, 0, 1);
  const bow = 0.25 + 0.75 * f;
  const fE = def.fE0 + (def.fE1 - def.fE0) * k;
  const xm = bx + def.um * (tx - bx);
  const rhoBase = Math.min(0.975, def.rho0 + def.rho1 * f);
  const sec = (x: number) => x * th;

  const make = (g: number, rs: number): Seg[] => {
    const ym = rhoBase * rs * sec(xm);
    const dev = g * bow;
    const dB = Math.hypot(xm - bx, ym - by);
    const g1 = Math.atan2(ym - by, xm - bx);
    const A2 = Math.atan2(ym, tx - xm);
    const phi0 = g1 + dev * (def.q0 * h - g1);
    const thM = g1 + dev * (-def.fS * A2 - g1);
    const alpha = clamp(fE * A2, 2 * D2R, 82 * D2R);
    const c = 0.36 * dB;
    const B = pt(bx, by), M = pt(xm, ym), T = pt(tx, 0);
    const s1: Seg = {
      p0: B,
      p1: pt(bx + c * Math.cos(phi0), by + c * Math.sin(phi0)),
      p2: pt(xm - c * Math.cos(thM), ym - c * Math.sin(thM)),
      p3: M,
    };
    const dxT = tx - xm;
    let a = (def.aF * dxT) / Math.max(Math.cos(thM), 0.3);
    let q1y = ym + a * Math.sin(thM);
    if (q1y < 0) {
      a = (ym / -Math.sin(thM)) * 0.9;
      q1y = ym + a * Math.sin(thM);
    }
    const bl = Math.min((def.bF * dxT) / Math.max(Math.cos(alpha), 0.2), (0.95 * ym) / Math.sin(alpha));
    const s2: Seg = {
      p0: M,
      p1: pt(xm + a * Math.cos(thM), q1y),
      p2: pt(tx - bl * Math.cos(alpha), bl * Math.sin(alpha)),
      p3: T,
    };
    return [s1, s2];
  };

  const ok = (segs: Seg[]): boolean => {
    for (let si = 0; si < segs.length; si++) {
      for (let j = si === 0 ? 3 : 0; j <= 40; j++) {
        const p: Pt = cubicAt(segs[si], j / 40);
        if (!(p.x > 0) || p.y < -1e-9 || p.x > tx + 1e-9) return false;
        if (p.y > sec(p.x) * (1 - 1e-4)) return false;
      }
    }
    return true;
  };

  let half: Seg[] | null = null;
  for (const rs of [1, 0.93, 0.86, 0.78, 0.7, 0.6, 0.5]) {
    const full = make(1, rs);
    if (ok(full)) {
      half = full;
      break;
    }
    if (!ok(make(0, rs))) continue;
    let lo = 0, hi = 1;
    for (let it = 0; it < 26; it++) {
      const mid = (lo + hi) / 2;
      if (ok(make(mid, rs))) lo = mid;
      else hi = mid;
    }
    half = make(lo, rs);
    break;
  }
  if (!half) half = make(0, 0.5);

  const [s1, s2] = half;
  const outline: Seg[] = [mirrorSeg(s1), mirrorSeg(s2), reverseSeg(s2), reverseSeg(s1)];
  return { h, r, H, bx, by, tx, outline, half };
}
