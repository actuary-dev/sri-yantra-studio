/** Small path utilities shared by every module. Scene coordinates (y down). */
import type { PathCmd } from './types';

const n = (v: number, digits: number) => {
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') || '0' : s;
};

/** Serialise to an SVG path `d` string. */
export function pathToD(cmds: PathCmd[], digits = 5): string {
  let out = '';
  for (const c of cmds) {
    if (c[0] === 'Z') out += 'Z';
    else out += c[0] + (c.slice(1) as number[]).map((v) => n(v, digits)).join(' ');
  }
  return out;
}

/** Closed polygon through the given points. */
export function polygon(pts: { x: number; y: number }[]): PathCmd[] {
  const d: PathCmd[] = pts.map((p, i) => (i === 0 ? ['M', p.x, p.y] : ['L', p.x, p.y]) as PathCmd);
  d.push(['Z']);
  return d;
}

/** Full circle as four cubic Béziers (for consumers that need a path rather than a circle primitive). */
export function circlePath(cx: number, cy: number, r: number): PathCmd[] {
  const k = 0.5522847498307936 * r;
  return [
    ['M', cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['Z'],
  ];
}

/** Apply an affine map (x, y) → (a·x + c·y + e, b·x + d·y + f). */
export function transformPath(cmds: PathCmd[], m: [number, number, number, number, number, number]): PathCmd[] {
  const [a, b, c, d, e, f] = m;
  const X = (x: number, y: number) => a * x + c * y + e;
  const Y = (x: number, y: number) => b * x + d * y + f;
  return cmds.map((k) => {
    switch (k[0]) {
      case 'M':
      case 'L':
        return [k[0], X(k[1], k[2]), Y(k[1], k[2])] as PathCmd;
      case 'Q':
        return ['Q', X(k[1], k[2]), Y(k[1], k[2]), X(k[3], k[4]), Y(k[3], k[4])] as PathCmd;
      case 'C':
        return ['C', X(k[1], k[2]), Y(k[1], k[2]), X(k[3], k[4]), Y(k[3], k[4]), X(k[5], k[6]), Y(k[5], k[6])] as PathCmd;
      default:
        return ['Z'] as PathCmd;
    }
  });
}

/** Rotation (degrees clockwise on screen) about (cx, cy), as a matrix for transformPath. */
export function rotationMatrix(deg: number, cx = 0, cy = 0): [number, number, number, number, number, number] {
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t), sin = Math.sin(t);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

/**
 * Flatten curves to polylines. Returns one array of points per sub-path, with
 * `closed` telling whether it ended in Z. `tol` is the maximum chord error in
 * the path's own units.
 */
export function flattenPath(cmds: PathCmd[], tol: number): { pts: { x: number; y: number }[]; closed: boolean }[] {
  const out: { pts: { x: number; y: number }[]; closed: boolean }[] = [];
  let cur: { pts: { x: number; y: number }[]; closed: boolean } | null = null;
  let x = 0, y = 0;
  const segsFor = (len: number) => Math.max(2, Math.min(200, Math.ceil(Math.sqrt(len / (8 * Math.max(tol, 1e-9))) * 2)));
  for (const k of cmds) {
    if (k[0] === 'M') {
      cur = { pts: [{ x: k[1], y: k[2] }], closed: false };
      out.push(cur);
      x = k[1]; y = k[2];
    } else if (!cur) continue;
    else if (k[0] === 'L') {
      cur.pts.push({ x: k[1], y: k[2] });
      x = k[1]; y = k[2];
    } else if (k[0] === 'Q') {
      const [, x1, y1, x2, y2] = k;
      const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1);
      const N = segsFor(len);
      for (let i = 1; i <= N; i++) {
        const t = i / N, u = 1 - t;
        cur.pts.push({ x: u * u * x + 2 * u * t * x1 + t * t * x2, y: u * u * y + 2 * u * t * y1 + t * t * y2 });
      }
      x = x2; y = y2;
    } else if (k[0] === 'C') {
      const [, x1, y1, x2, y2, x3, y3] = k;
      const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
      const N = segsFor(len);
      for (let i = 1; i <= N; i++) {
        const t = i / N, u = 1 - t;
        cur.pts.push({
          x: u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          y: u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        });
      }
      x = x3; y = y3;
    } else if (k[0] === 'Z') {
      cur.closed = true;
      x = cur.pts[0].x; y = cur.pts[0].y;
    }
  }
  return out;
}

/** Bounding box of a path's control polygon. */
export function pathBounds(cmds: PathCmd[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of cmds) {
    for (let i = 1; i + 1 < k.length; i += 2) {
      const px = k[i] as number, py = k[i + 1] as number;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  return { minX, minY, maxX, maxY };
}
