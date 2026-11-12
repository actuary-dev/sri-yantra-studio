/**
 * Planar arrangement of the nine triangles: finds every crossing, every face,
 * and from them the 43 traditional cells, the 18 marma points and the sandhis.
 *
 * Key fact (verified by the test-suite): of the 74 bounded faces, the 43
 * triangles of tradition are exactly the faces covered by an ODD number of the
 * nine big triangles — 1 → the ring of 14, 3 → outer 10, 5 → inner 10,
 * 7 → the 8, 9 → the central triangle.
 *
 * Output is in Scene coordinates (y DOWN).
 */
import { TRI_UP, type Solved } from './solver';

export interface Pt {
  x: number;
  y: number;
}

export interface BigTriangle {
  /** [left base corner, right base corner, apex] */
  pts: [Pt, Pt, Pt];
  incenter: Pt;
  inradius: number;
}

export interface Cell {
  /** 1 = outer ring of 14 … 5 = central triangle */
  ring: number;
  /** position within the ring: 0 at the bottom of the screen, then anticlockwise as seen */
  index: number;
  pts: Pt[];
  incenter: Pt;
  inradius: number;
  /** direction from the bindu to this cell, degrees clockwise from +x */
  outDeg: number;
}

export interface Figure {
  triangles: BigTriangle[];
  cells: Cell[];
  /** the 31 in-between faces (covered by an even number of triangles) */
  gaps: Pt[][];
  marmas: Pt[];
  sandhis: Pt[];
  bindu: Pt;
  ringCounts: number[];
  concurrencyError: number;
}

const EPS = 1e-7;

function incircle(p: Pt[]): { c: Pt; r: number } {
  const [A, B, C] = p;
  const a = Math.hypot(B.x - C.x, B.y - C.y);
  const b = Math.hypot(A.x - C.x, A.y - C.y);
  const c = Math.hypot(A.x - B.x, A.y - B.y);
  const s = a + b + c;
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / 2;
  return { c: { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s }, r: (2 * area) / s };
}

function lineLine(p1: Pt, p2: Pt, p3: Pt, p4: Pt): { u: number; v: number; p: Pt } | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-12) return null;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return { u, v, p: { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) } };
}

function inTriangle(p: Pt, t: [Pt, Pt, Pt]): boolean {
  const s = (a: Pt, b: Pt) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const d1 = s(t[0], t[1]), d2 = s(t[1], t[2]), d3 = s(t[2], t[0]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Angle key: 0 at screen-bottom, growing anticlockwise as seen on screen. */
export function bottomAnticlockwiseKey(dx: number, dy: number): number {
  const theta = (Math.atan2(dy, dx) * 180) / Math.PI; // clockwise from +x (y down)
  return (((90 - theta + 1e-6) % 360) + 360) % 360;
}

export function buildFigure(s: Solved, flip: boolean): Figure {
  const sy = flip ? 1 : -1; // scene y = sy * (y up)
  const triangles: BigTriangle[] = [];
  for (let i = 0; i < 9; i++) {
    const hw = s.t[i] * Math.abs(s.b[i] - s.a[i]);
    const pts: [Pt, Pt, Pt] = [
      { x: -hw, y: sy * s.b[i] },
      { x: hw, y: sy * s.b[i] },
      { x: 0, y: sy * s.a[i] },
    ];
    const ic = incircle(pts);
    triangles.push({ pts, incenter: ic.c, inradius: ic.r });
  }
  const bindu: Pt = { x: 0, y: sy * s.binduY };

  // --- segments
  const segs: { p: Pt; q: Pt; tri: number }[] = [];
  triangles.forEach((t, i) => {
    segs.push({ p: t.pts[0], q: t.pts[1], tri: i }, { p: t.pts[0], q: t.pts[2], tri: i }, { p: t.pts[1], q: t.pts[2], tri: i });
  });

  // --- vertices (merged within EPS)
  const verts: Pt[] = [];
  const vid = (p: Pt) => {
    for (let i = 0; i < verts.length; i++) if (Math.abs(verts[i].x - p.x) < EPS && Math.abs(verts[i].y - p.y) < EPS) return i;
    verts.push({ x: p.x, y: p.y });
    return verts.length - 1;
  };
  const onSeg: Set<number>[] = segs.map(() => new Set<number>());
  segs.forEach((sg, i) => {
    onSeg[i].add(vid(sg.p));
    onSeg[i].add(vid(sg.q));
  });
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const r = lineLine(segs[i].p, segs[i].q, segs[j].p, segs[j].q);
      if (!r || r.u < -EPS || r.u > 1 + EPS || r.v < -EPS || r.v > 1 + EPS) continue;
      const v = vid(r.p);
      onSeg[i].add(v);
      onSeg[j].add(v);
    }
  }

  // --- which triangles pass through each vertex; concurrency error
  const trisAt: Set<number>[] = verts.map(() => new Set<number>());
  const segsAt: number[][] = verts.map(() => []);
  onSeg.forEach((set, si) => set.forEach((v) => { trisAt[v].add(segs[si].tri); segsAt[v].push(si); }));
  let concurrencyError = 0;
  const marmas: Pt[] = [];
  const sandhis: Pt[] = [];
  verts.forEach((v, i) => {
    const n = trisAt[i].size;
    if (n >= 3) {
      marmas.push(v);
      const list = segsAt[i];
      for (let a = 0; a < list.length; a++)
        for (let b = a + 1; b < list.length; b++) {
          const r = lineLine(segs[list[a]].p, segs[list[a]].q, segs[list[b]].p, segs[list[b]].q);
          if (r) concurrencyError = Math.max(concurrencyError, Math.hypot(r.p.x - v.x, r.p.y - v.y));
        }
    } else if (n === 2) sandhis.push(v);
  });
  const readingOrder = (a: Pt, b: Pt) => (Math.abs(a.y - b.y) > 1e-6 ? a.y - b.y : a.x - b.x);
  marmas.sort(readingOrder);
  sandhis.sort(readingOrder);

  // --- edges between consecutive vertices on each segment
  const adj: Set<number>[] = verts.map(() => new Set<number>());
  segs.forEach((sg, i) => {
    const dx = sg.q.x - sg.p.x, dy = sg.q.y - sg.p.y;
    const along = (v: number) => (verts[v].x - sg.p.x) * dx + (verts[v].y - sg.p.y) * dy;
    const vs = [...onSeg[i]].sort((a, b) => along(a) - along(b));
    for (let k = 0; k + 1 < vs.length; k++) {
      adj[vs[k]].add(vs[k + 1]);
      adj[vs[k + 1]].add(vs[k]);
    }
  });

  // --- faces by walking half-edges
  const order = adj.map((set, v) =>
    [...set].sort(
      (a, b) =>
        Math.atan2(verts[a].y - verts[v].y, verts[a].x - verts[v].x) - Math.atan2(verts[b].y - verts[v].y, verts[b].x - verts[v].x),
    ),
  );
  const seen = new Set<number>();
  const key = (a: number, b: number) => a * 4096 + b;
  const faces: number[][] = [];
  for (let u = 0; u < verts.length; u++) {
    for (const v of order[u]) {
      if (seen.has(key(u, v))) continue;
      const f: number[] = [];
      let a = u, b = v;
      while (!seen.has(key(a, b))) {
        seen.add(key(a, b));
        f.push(a);
        const lst = order[b];
        const nxt = lst[(lst.indexOf(a) - 1 + lst.length) % lst.length];
        a = b;
        b = nxt;
      }
      faces.push(f);
    }
  }
  const signedArea = (f: number[]) => {
    let sum = 0;
    for (let i = 0; i < f.length; i++) {
      const p = verts[f[i]], q = verts[f[(i + 1) % f.length]];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  };
  const cornersOf = (f: number[]): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < f.length; i++) {
      const p = verts[f[(i - 1 + f.length) % f.length]], q = verts[f[i]], r = verts[f[(i + 1) % f.length]];
      const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
      if (Math.abs(cross) > 1e-10) out.push(q);
    }
    return out;
  };

  // The unbounded face is the one with the largest |area|; bounded faces share the opposite sign.
  let outer = 0;
  faces.forEach((f, i) => { if (Math.abs(signedArea(f)) > Math.abs(signedArea(faces[outer]))) outer = i; });

  const cells: Cell[] = [];
  const gaps: Pt[][] = [];
  faces.forEach((f, i) => {
    if (i === outer || Math.abs(signedArea(f)) < 1e-12) return;
    const pts = cornersOf(f);
    const c = { x: 0, y: 0 };
    pts.forEach((p) => { c.x += p.x / pts.length; c.y += p.y / pts.length; });
    const cover = triangles.filter((t) => inTriangle(c, t.pts)).length;
    if (pts.length === 3 && cover % 2 === 1) {
      const ic = incircle(pts);
      const outDeg = (Math.atan2(ic.c.y - bindu.y, ic.c.x - bindu.x) * 180) / Math.PI;
      cells.push({ ring: (cover + 1) / 2, index: 0, pts, incenter: ic.c, inradius: ic.r, outDeg });
    } else gaps.push(pts);
  });

  const ringCounts = [0, 0, 0, 0, 0];
  for (let ring = 1; ring <= 5; ring++) {
    const inRing = cells.filter((c) => c.ring === ring);
    inRing.sort(
      (a, b) =>
        bottomAnticlockwiseKey(a.incenter.x - bindu.x, a.incenter.y - bindu.y) -
        bottomAnticlockwiseKey(b.incenter.x - bindu.x, b.incenter.y - bindu.y),
    );
    inRing.forEach((c, k) => (c.index = k));
    ringCounts[ring - 1] = inRing.length;
  }
  cells.sort((a, b) => a.ring - b.ring || a.index - b.index);
  // the central cell has no meaningful direction; point it the way the triangle points
  const centre = cells.find((c) => c.ring === 5);
  if (centre) centre.outDeg = TRI_UP[0] !== flip ? -90 : 90;

  return { triangles, cells, gaps, marmas, sandhis, bindu, ringCounts, concurrencyError };
}
