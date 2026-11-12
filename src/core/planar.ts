/**
 * General planar arrangement of straight segments: every corner and crossing
 * ("points") and every enclosed area ("regions"). This is what lets text be
 * placed at any intersection or in any cell of ANY yantra, not only the Sri Yantra.
 *
 * Works for several disconnected figures at once (e.g. a triangle inside a
 * hexagram that does not touch it): the area between them is a region with a hole.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface Seg {
  a: Pt;
  b: Pt;
}

export interface Region {
  /** boundary corners in order */
  pts: Pt[];
  /** a point well inside the region, for placing a label */
  centre: Pt;
  /** radius of the free circle around `centre` */
  r: number;
}

export interface Arrangement {
  points: Pt[];
  regions: Region[];
}

const EPS = 1e-7;

function cross(o: Pt, a: Pt, b: Pt) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function inPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToLoop(p: Pt, loop: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < loop.length; i++) d = Math.min(d, distToSeg(p, loop[i], loop[(i + 1) % loop.length]));
  return d;
}

const readingOrder = (a: Pt, b: Pt) => (Math.abs(a.y - b.y) > 1e-6 ? a.y - b.y : a.x - b.x);

/** Point of a region farthest from its boundary (and from any hole), by coarse-to-fine sampling. */
function innerPoint(loop: Pt[], holes: Pt[][]): { c: Pt; r: number } {
  if (loop.length === 3 && holes.length === 0) {
    const [A, B, C] = loop;
    const a = Math.hypot(B.x - C.x, B.y - C.y), b = Math.hypot(A.x - C.x, A.y - C.y), c = Math.hypot(A.x - B.x, A.y - B.y);
    const s = a + b + c;
    return { c: { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s }, r: Math.abs(cross(A, B, C)) / s };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const score = (p: Pt) => {
    if (!inPolygon(p, loop)) return -1;
    let d = distToLoop(p, loop);
    for (const h of holes) {
      if (inPolygon(p, h)) return -1;
      d = Math.min(d, distToLoop(p, h));
    }
    return d;
  };
  let best: Pt = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  let bestD = score(best);
  let cx = best.x, cy = best.y, w = maxX - minX, h = maxY - minY;
  for (let pass = 0; pass < 4; pass++) {
    const N = pass === 0 ? 12 : 6;
    for (let i = 0; i <= N; i++)
      for (let j = 0; j <= N; j++) {
        const p = { x: cx - w / 2 + (w * i) / N, y: cy - h / 2 + (h * j) / N };
        const d = score(p);
        if (d > bestD) { bestD = d; best = p; }
      }
    cx = best.x; cy = best.y;
    w /= pass === 0 ? 6 : 3;
    h /= pass === 0 ? 6 : 3;
  }
  return { c: best, r: Math.max(bestD, 0) };
}

export function arrange(segs: Seg[]): Arrangement {
  const usable = segs.filter((s) => Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) > EPS);
  if (usable.length === 0 || usable.length > 400) return { points: [], regions: [] };

  // --- vertices (merged within EPS), using a coarse hash grid to stay fast
  const verts: Pt[] = [];
  const grid = new Map<string, number[]>();
  const cell = 1e-4;
  const vid = (p: Pt): number => {
    const gx = Math.round(p.x / cell), gy = Math.round(p.y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(`${gx + dx},${gy + dy}`);
        if (list) for (const i of list) if (Math.abs(verts[i].x - p.x) < EPS && Math.abs(verts[i].y - p.y) < EPS) return i;
      }
    verts.push({ x: p.x, y: p.y });
    const k = `${gx},${gy}`;
    const list = grid.get(k);
    if (list) list.push(verts.length - 1);
    else grid.set(k, [verts.length - 1]);
    return verts.length - 1;
  };

  const onSeg: Set<number>[] = usable.map(() => new Set<number>());
  usable.forEach((s, i) => { onSeg[i].add(vid(s.a)); onSeg[i].add(vid(s.b)); });
  for (let i = 0; i < usable.length; i++) {
    const p1 = usable[i].a, p2 = usable[i].b;
    for (let j = i + 1; j < usable.length; j++) {
      const p3 = usable[j].a, p4 = usable[j].b;
      const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
      if (Math.abs(d) < 1e-12) {
        // parallel: if collinear and overlapping, each one's end points lie on the other
        if (Math.abs(cross(p1, p2, p3)) < 1e-9) {
          for (const [q, k, s] of [[p3, i, usable[i]], [p4, i, usable[i]], [p1, j, usable[j]], [p2, j, usable[j]]] as [Pt, number, Seg][]) {
            if (distToSeg(q, s.a, s.b) < EPS) onSeg[k].add(vid(q));
          }
        }
        continue;
      }
      const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
      const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
      if (u < -EPS || u > 1 + EPS || v < -EPS || v > 1 + EPS) continue;
      const k = vid({ x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) });
      onSeg[i].add(k);
      onSeg[j].add(k);
    }
  }

  // --- edges
  const adj: Set<number>[] = verts.map(() => new Set<number>());
  usable.forEach((s, i) => {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const along = (v: number) => (verts[v].x - s.a.x) * dx + (verts[v].y - s.a.y) * dy;
    const vs = [...onSeg[i]].sort((p, q) => along(p) - along(q));
    for (let k = 0; k + 1 < vs.length; k++) {
      if (vs[k] === vs[k + 1]) continue;
      adj[vs[k]].add(vs[k + 1]);
      adj[vs[k + 1]].add(vs[k]);
    }
  });

  // --- connected components (figures that do not touch each other)
  const comp = new Array<number>(verts.length).fill(-1);
  let nComp = 0;
  for (let s = 0; s < verts.length; s++) {
    if (comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = nComp;
    while (stack.length) {
      const u = stack.pop() as number;
      for (const v of adj[u]) if (comp[v] < 0) { comp[v] = nComp; stack.push(v); }
    }
    nComp++;
  }

  // --- faces by walking half-edges
  const order = adj.map((set, v) =>
    [...set].sort((p, q) => Math.atan2(verts[p].y - verts[v].y, verts[p].x - verts[v].x) - Math.atan2(verts[q].y - verts[v].y, verts[q].x - verts[v].x)),
  );
  const pos = order.map((lst) => new Map(lst.map((v, i) => [v, i] as [number, number])));
  const seen = new Set<number>();
  const key = (a: number, b: number) => a * 65536 + b;
  const cycles: number[][] = [];
  for (let u = 0; u < verts.length; u++) {
    for (const v of order[u]) {
      if (seen.has(key(u, v))) continue;
      const f: number[] = [];
      let a = u, b = v;
      while (!seen.has(key(a, b))) {
        seen.add(key(a, b));
        f.push(a);
        const lst = order[b];
        const nxt = lst[((pos[b].get(a) as number) - 1 + lst.length) % lst.length];
        a = b;
        b = nxt;
      }
      cycles.push(f);
    }
  }
  const area = (f: number[]) => {
    let s = 0;
    for (let i = 0; i < f.length; i++) {
      const p = verts[f[i]], q = verts[f[(i + 1) % f.length]];
      s += p.x * q.y - q.x * p.y;
    }
    return s / 2;
  };
  const corners = (f: number[]): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < f.length; i++) {
      const p = verts[f[(i - 1 + f.length) % f.length]], q = verts[f[i]], r = verts[f[(i + 1) % f.length]];
      if (Math.abs(cross(p, q, r)) > 1e-10) out.push(q);
    }
    return out;
  };

  // Each component has exactly one outline cycle (wound opposite to its bounded faces):
  // the one of largest |area| within the component.
  const areas = cycles.map(area);
  const outlineOf = new Array<number>(nComp).fill(-1);
  cycles.forEach((f, i) => {
    const c = comp[f[0]];
    if (outlineOf[c] < 0 || Math.abs(areas[i]) > Math.abs(areas[outlineOf[c]])) outlineOf[c] = i;
  });
  const outlineLoops = outlineOf.map((ci) => (ci >= 0 ? corners(cycles[ci]) : []));

  const regions: Region[] = [];
  cycles.forEach((f, i) => {
    const c = comp[f[0]];
    if (i === outlineOf[c] || Math.abs(areas[i]) < 1e-10) return;
    const loop = corners(f);
    if (loop.length < 3) return;
    // holes: other figures lying wholly inside this face
    const holes: Pt[][] = [];
    for (let k = 0; k < nComp; k++) {
      if (k === c || outlineLoops[k].length < 3) continue;
      if (inPolygon(outlineLoops[k][0], loop)) holes.push(outlineLoops[k]);
    }
    const ip = innerPoint(loop, holes);
    if (ip.r > 1e-5) regions.push({ pts: loop, centre: ip.c, r: ip.r });
  });

  regions.sort((a, b) => readingOrder(a.centre, b.centre));
  const points = [...verts].sort(readingOrder);
  return { points, regions };
}
