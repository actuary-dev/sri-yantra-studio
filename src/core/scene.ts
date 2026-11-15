/**
 * buildScene — turns a Design document into a flat list of drawable primitives.
 * This is the single integration point: centre figures → outer bands → labels.
 */
import { buildFigure, bottomAnticlockwiseKey, type Figure, type Pt } from './arrangement';
import { gridLayout, latticeLines, orbitPlacements, polygonLoops, raySegments } from './figures';
import { polygon } from './path';
import { analyse } from './analyse';
import { arrange } from './planar';
import { arcPath, crescentPath, freeLoops, symbolPath, validMerges } from './shapes';
import { insetCorners, isTriangle, shapeCorners, triangleRows } from './shape';
import { solveGeometry, TRI, TRI_NAMES, TRI_SANSKRIT, TRI_UP, type Solved } from './solver';
import { trianglePoints } from './triangle';
import type { Anchor, CentreFigure, Design, GeometryReport, LotusBand, PathCmd, Prim, Scene, SceneLine, TriangleInfo } from './types';
import { buildBands } from '../outer';
import { buildLabels, resolveText, type Shaper } from '../text';

const GUIDE_MARMA = '#c0392b';
const GUIDE_SANDHI = '#1f6fb2';
const GUIDE_AXIS = '#8a8a8a';
const GUIDE_CHECK = '#e67e22';

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Designs saved before centre figures existed contain just the Sri Yantra. */
export function centreOf(design: Pick<Design, 'centre'>): CentreFigure[] {
  return Array.isArray(design.centre) ? design.centre : [{ id: 'sri', type: 'sri', visible: true, radius: 1 }];
}

function insetTriangle(pts: Pt[], centre: Pt, inradius: number, distance: number): Pt[] | null {
  const k = 1 - distance / inradius;
  if (!(k > 0.12)) return null;
  return pts.map((p) => ({ x: centre.x + (p.x - centre.x) * k, y: centre.y + (p.y - centre.y) * k }));
}

function incircleOf(p: Pt[]): { c: Pt; r: number } {
  const [A, B, C] = p;
  const a = Math.hypot(B.x - C.x, B.y - C.y), b = Math.hypot(A.x - C.x, A.y - C.y), c = Math.hypot(A.x - B.x, A.y - B.y);
  const s = a + b + c || 1;
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / 2;
  return { c: { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s }, r: (2 * area) / s };
}

function scaleFigure(f: Figure, k: number): Figure {
  if (k === 1) return f;
  const s = (p: Pt): Pt => ({ x: p.x * k, y: p.y * k });
  return {
    ...f,
    triangles: f.triangles.map((t) => ({ pts: [s(t.pts[0]), s(t.pts[1]), s(t.pts[2])], incenter: s(t.incenter), inradius: t.inradius * k })),
    cells: f.cells.map((c) => ({ ...c, pts: c.pts.map(s), incenter: s(c.incenter), inradius: c.inradius * k })),
    gaps: f.gaps.map((g) => g.map(s)),
    marmas: f.marmas.map(s),
    sandhis: f.sandhis.map(s),
    bindu: s(f.bindu),
  };
}

function makeReport(hasSri: boolean, s: Solved | null, fig: Figure | null): GeometryReport {
  if (!s || !fig) {
    return {
      hasSri,
      ok: !hasSri,
      concurrencyError: NaN,
      ringCounts: [0, 0, 0, 0, 0],
      marmaCount: 0,
      sandhiCount: 0,
      binduOffset: NaN,
      centralAngleDeg: NaN,
      resolved: { ravi: NaN, kuja: NaN, shani: NaN, ketu: NaN },
      triangles: [],
    };
  }
  const triangles: TriangleInfo[] = TRI_NAMES.map((name, i) => {
    const apex = 2 * deg(Math.atan(s.t[i]));
    return {
      name,
      sanskrit: TRI_SANSKRIT[i],
      up: TRI_UP[i],
      height: (s.b[i] + 1) / 2,
      halfWidth: s.t[i] * Math.abs(s.b[i] - s.a[i]),
      apexAngleDeg: apex,
      baseAngleDeg: (180 - apex) / 2,
    };
  });
  const ringsOk = fig.ringCounts.join() === '14,10,10,8,1';
  return {
    hasSri,
    ok: ringsOk && fig.marmas.length === 18 && fig.concurrencyError < 1e-7,
    concurrencyError: fig.concurrencyError,
    ringCounts: fig.ringCounts,
    marmaCount: fig.marmas.length,
    sandhiCount: fig.sandhis.length,
    binduOffset: s.binduY,
    centralAngleDeg: 2 * deg(Math.atan(s.t[TRI.Ravi])),
    resolved: s.params,
    triangles,
  };
}

/** Solve the Sri Yantra geometry only (no drawing) — for the UI to test a spec before committing it. */
export function checkGeometry(design: Pick<Design, 'geometry'>): GeometryReport {
  const s = solveGeometry(design.geometry);
  return makeReport(true, s, s ? buildFigure(s, design.geometry.flip) : null);
}

export function buildScene(design: Design, shaper?: Shaper): Scene {
  const ink = design.style.ink;
  const paper = design.style.paper;
  const centre = centreOf(design).filter((f) => f.visible);
  const sriSpec = centre.find((f) => f.type === 'sri');
  const anyFill =
    design.cells.filled ||
    design.bands.some((b) => b.visible && 'fill' in b && b.fill) ||
    centre.some((f) => (f.type === 'polygon' || f.type === 'crescent' || f.type === 'free' || f.type === 'lotus' || f.type === 'triangle' || f.type === 'shape') && f.fill);

  const solved = sriSpec ? solveGeometry(design.geometry) : null;
  const unitFig = solved ? buildFigure(solved, design.geometry.flip) : null;
  const fig = unitFig && sriSpec ? scaleFigure(unitFig, Math.max(0.05, sriSpec.radius)) : null;

  const outer = buildBands(design.bands, 1, { ink, paper, filled: anyFill });
  let extent = Math.max(1.02, outer.extent);
  for (const f of centre) {
    const orbitR = 'orbit' in f && f.orbit && f.orbit.count >= 1 ? Math.max(0, f.orbit.radius) : 0;
    if (f.type === 'polygon' || f.type === 'sri') extent = Math.max(extent, orbitR + f.radius * 1.01);
    else if (f.type === 'circle') extent = Math.max(extent, orbitR + f.radius + Math.max(0, f.count - 1) * f.spacing);
    else if (f.type === 'lotus') extent = Math.max(extent, (f.radius + f.height) * 1.02);
    else if (f.type === 'rays') extent = Math.max(extent, f.outer);
    else if (f.type === 'lattice') extent = Math.max(extent, f.radius * 1.01);
    else if (f.type === 'arc' || f.type === 'crescent') extent = Math.max(extent, orbitR + f.radius * 1.01);
    else if (f.type === 'symbol') extent = Math.max(extent, orbitR + f.size * 1.45);
    else if (f.type === 'triangle') { for (const pl of orbitPlacements(f.orbit)) for (const q of trianglePoints(f, pl)) extent = Math.max(extent, Math.hypot(q.x, q.y) * 1.01); }
    else if (f.type === 'free') for (const q of f.points ?? []) extent = Math.max(extent, Math.hypot(q.x, q.y) * 1.01);
    else if (f.type === 'shape') for (const q of shapeCorners(f)) extent = Math.max(extent, Math.hypot(q.x, q.y) * 1.01);
    else if (f.type === 'grid') { const g = gridLayout(f); extent = Math.max(extent, Math.hypot(g.width, g.height) / 2); }
  }
  const unitMm = design.sizeMm / (2 * extent);
  const mm = (v: number) => v / unitMm; // mm → scene units

  const prims: Prim[] = [...outer.prims];
  const anchors: Anchor[] = [];
  const segs: SceneLine[] = []; // every straight line at the centre, for 'points', 'regions' and the accuracy checks
  const rounds: Scene['rounds'] = [{ x: 0, y: 0, r: 1 }];
  const gridText: Prim[] = [];
  const figureAnchors: Anchor[] = [];
  if (anyFill) prims.push({ kind: 'circle', cx: 0, cy: 0, r: 1, layer: 'cells', role: 'ground', paint: { stroke: null, strokeMm: 0, fill: paper } });

  for (const f of centre) {
    if (f.type === 'sri') {
      if (fig) drawSri(design, fig, prims, mm, ink, segs, f.id);
    } else if (f.type === 'polygon') {
      const layer = `fig:${f.id}`;
      const gap = mm(f.lineGapMm);
      const lines = Math.max(1, Math.min(3, Math.round(f.lines)));
      const all = orbitPlacements(f.orbit).map((pl) => ({ pl, ...polygonLoops(f, pl) }));
      if (anyFill && f.fill)
        for (const one of all)
          for (const loop of one.copies[0].loops)
            if (loop.length >= 3) prims.push({ kind: 'path', d: polygon(loop), layer, role: 'fill', paint: { stroke: null, strokeMm: 0, fill: f.fill } });
      all.forEach(({ pl, copies, apothemRatio }, pi) => {
        copies.forEach((c, ci) => {
          const apothem = Math.max(c.radius * apothemRatio, 1e-6);
          c.loops.forEach((loop, li) => {
            for (let k = 0; k < lines; k++) {
              const scale = 1 - (gap * k) / apothem;
              if (k > 0 && !(scale > 0.1)) break;
              const pts = k === 0 ? loop : loop.map((q) => ({ x: pl.x + (q.x - pl.x) * scale, y: pl.y + (q.y - pl.y) * scale }));
              const d: PathCmd[] = pts.length >= 3 ? polygon(pts) : [['M', pts[0].x, pts[0].y], ['L', pts[1].x, pts[1].y]];
              prims.push({ kind: 'path', d, layer, role: `polygon:${pi}:${ci}:${li}:${k}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
            }
            for (let i = 0; i < loop.length; i++) {
              if (loop.length === 2 && i === 1) break;
              segs.push({ a: loop[i], b: loop[(i + 1) % loop.length], owner: f.id });
            }
          });
        });
      });
    } else if (f.type === 'circle') {
      const n = Math.max(1, Math.min(12, Math.round(f.count)));
      for (const pl of orbitPlacements(f.orbit))
        for (let i = 0; i < n; i++) {
          const r = Math.max(1e-4, f.radius + i * f.spacing);
          prims.push({ kind: 'circle', cx: pl.x, cy: pl.y, r, layer: `fig:${f.id}`, role: `circle:${i}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
          rounds.push({ x: pl.x, y: pl.y, r });
        }
    } else if (f.type === 'triangle') {
      const layer = `fig:${f.id}`;
      const gap = mm(f.lineGapMm);
      const lines = Math.max(1, Math.min(3, Math.round(f.lines)));
      orbitPlacements(f.orbit).forEach((pl, pi) => {
        const pts = trianglePoints(f, pl);
        if (anyFill && f.fill) prims.push({ kind: 'path', d: polygon(pts), layer, role: 'fill', paint: { stroke: null, strokeMm: 0, fill: f.fill } });
        const ic = incircleOf(pts);
        for (let k = 0; k < lines; k++) {
          const p = k === 0 ? pts : insetTriangle(pts, ic.c, ic.r, gap * k);
          if (!p) break;
          prims.push({ kind: 'path', d: polygon(p), layer, role: `triangle:${pi}:${k}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
        }
        segs.push({ a: pts[0], b: pts[1], owner: f.id }, { a: pts[1], b: pts[2], owner: f.id }, { a: pts[2], b: pts[0], owner: f.id });
      });
    } else if (f.type === 'lotus') {
      const band: LotusBand = {
        id: f.id, type: 'lotus', visible: true, gap: 0, lineMm: f.lineMm, petals: f.petals, height: f.height, shape: f.shape,
        fullness: f.fullness, tip: f.tip, tipAtTop: f.tipAtTop, rows: 1, insets: 0, vein: false, fill: f.fill,
      };
      const ring = buildBands([band], Math.max(0.01, f.radius), { ink, paper, filled: anyFill });
      prims.push(...ring.prims);
      figureAnchors.push(...ring.anchors);
    } else if (f.type === 'rays') {
      const rays = raySegments(f);
      const d: PathCmd[] = [];
      for (const [p0, p1] of rays.segs) {
        d.push(['M', p0.x, p0.y], ['L', p1.x, p1.y]);
        segs.push({ a: p0, b: p1, owner: f.id });
      }
      prims.push({ kind: 'path', d, layer: `fig:${f.id}`, role: 'rays', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
      // one place for text in the middle of each sector, ordered from the bottom, anticlockwise as seen
      const mid = rays.inner > 0 ? (rays.inner + rays.outer) / 2 : rays.outer * 0.62;
      const half = Math.PI / rays.segs.length;
      const free = Math.max(0.01, Math.min((rays.outer - rays.inner) * 0.3, rays.segs.length > 1 ? mid * Math.sin(half) * 0.8 : mid * 0.5));
      const sectors = rays.sectorDeg
        .map((dg) => ({ dg, x: mid * Math.cos((dg * Math.PI) / 180), y: mid * Math.sin((dg * Math.PI) / 180) }))
        .sort((u, v) => bottomAnticlockwiseKey(u.x, u.y) - bottomAnticlockwiseKey(v.x, v.y));
      sectors.forEach((sct, i) =>
        figureAnchors.push({ id: `band:${f.id}:${i}`, group: `band:${f.id}`, index: i, x: sct.x, y: sct.y, r: free, outDeg: ((sct.dg % 360) + 360) % 360 }),
      );
    } else if (f.type === 'lattice') {
      const d: PathCmd[] = [];
      for (const [p0, p1] of latticeLines(f).lines) {
        d.push(['M', p0.x, p0.y], ['L', p1.x, p1.y]);
        segs.push({ a: p0, b: p1, owner: f.id });
      }
      prims.push({ kind: 'path', d, layer: `fig:${f.id}`, role: 'lattice', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
    } else if (f.type === 'arc') {
      for (const pl of orbitPlacements(f.orbit))
        prims.push({ kind: 'path', d: arcPath(f, pl), layer: `fig:${f.id}`, role: 'arc', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
    } else if (f.type === 'crescent') {
      for (const pl of orbitPlacements(f.orbit))
        prims.push({ kind: 'path', d: crescentPath(f, pl), layer: `fig:${f.id}`, role: 'crescent', paint: { stroke: ink, strokeMm: f.lineMm, fill: anyFill ? f.fill : null } });
    } else if (f.type === 'symbol') {
      for (const pl of orbitPlacements(f.orbit))
        prims.push({ kind: 'path', d: symbolPath(f, pl), layer: `fig:${f.id}`, role: `symbol:${f.symbol}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
    } else if (f.type === 'free') {
      freeLoops(f).forEach((loop, li) => {
        const closed = f.closed && loop.length >= 3;
        const d: PathCmd[] = closed ? polygon(loop) : loop.map((q, i) => [i === 0 ? 'M' : 'L', q.x, q.y] as PathCmd);
        if (closed && anyFill && f.fill) prims.push({ kind: 'path', d, layer: `fig:${f.id}`, role: 'fill', paint: { stroke: null, strokeMm: 0, fill: f.fill } });
        prims.push({ kind: 'path', d, layer: `fig:${f.id}`, role: `free:${li}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
        for (let i = 0; i + 1 < loop.length; i++) segs.push({ a: loop[i], b: loop[i + 1], owner: f.id });
        if (closed) segs.push({ a: loop[loop.length - 1], b: loop[0], owner: f.id });
      });
    } else if (f.type === 'shape') {
      const layer = `fig:${f.id}`;
      const c = shapeCorners(f);
      if (!c.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) continue;
      if (anyFill && f.fill) prims.push({ kind: 'path', d: polygon(c), layer, role: 'fill', paint: { stroke: null, strokeMm: 0, fill: f.fill } });
      prims.push({ kind: 'path', d: polygon(c), layer, role: 'shape:0', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
      for (let i = 0; i < c.length; i++) segs.push({ a: c[i], b: c[(i + 1) % c.length], owner: f.id });
      const lines = Math.max(1, Math.min(3, Math.round(f.lines ?? 1)));
      for (let k = 1; k < lines; k++) {
        const p = insetCorners(f, mm(f.lineGapMm) * k);
        if (!p) break;
        prims.push({ kind: 'path', d: polygon(p), layer, role: `shape:${k}`, paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
      }
      if (isTriangle(f) && (f.rows ?? 1) > 1) {
        const d: PathCmd[] = [];
        for (const [p0, p1] of triangleRows(c, f.rows)) {
          d.push(['M', p0.x, p0.y], ['L', p1.x, p1.y]);
          segs.push({ a: p0, b: p1, owner: f.id });
        }
        prims.push({ kind: 'path', d, layer, role: 'shape-rows', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
      }
    } else if (f.type === 'grid') {
      const g = gridLayout(f);
      const merges = validMerges(f.merges, g.rows, g.cols);
      const inBlock = (r: number, c: number) => merges.find((m) => r >= m.row && r < m.row + m.rows && c >= m.col && c < m.col + m.cols);
      const d: PathCmd[] = [];
      // each grid line is drawn piece by piece, leaving out the pieces inside a joined block
      for (let c = 0; c <= g.cols; c++)
        for (let r = 0; r < g.rows; r++) {
          const left = c > 0 ? inBlock(r, c - 1) : undefined;
          if (left && c < g.cols && left === inBlock(r, c)) continue;
          d.push(['M', g.x0 + c * g.cell, g.y0 + r * g.cell], ['L', g.x0 + c * g.cell, g.y0 + (r + 1) * g.cell]);
        }
      for (let r = 0; r <= g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
          const above = r > 0 ? inBlock(r - 1, c) : undefined;
          if (above && r < g.rows && above === inBlock(r, c)) continue;
          d.push(['M', g.x0 + c * g.cell, g.y0 + r * g.cell], ['L', g.x0 + (c + 1) * g.cell, g.y0 + r * g.cell]);
        }
      prims.push({ kind: 'path', d, layer: `fig:${f.id}`, role: 'grid', paint: { stroke: ink, strokeMm: f.lineMm, fill: null } });
      const blocks = Math.round(f.blocks ?? 0);
      if (blocks > 1) {
        const heavy: PathCmd[] = [];
        for (let c = 0; c <= g.cols; c += blocks) heavy.push(['M', g.x0 + c * g.cell, g.y0], ['L', g.x0 + c * g.cell, g.y0 + g.height]);
        for (let r = 0; r <= g.rows; r += blocks) heavy.push(['M', g.x0, g.y0 + r * g.cell], ['L', g.x0 + g.width, g.y0 + r * g.cell]);
        prims.push({ kind: 'path', d: heavy, layer: `fig:${f.id}`, role: 'grid-blocks', paint: { stroke: ink, strokeMm: f.lineMm * 2.6, fill: null } });
      }
      for (let r = 0; r < g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
          const block = inBlock(r, c);
          if (block && (block.row !== r || block.col !== c)) continue; // a joined block shows only its first cell's text
          const text = (f.texts[r * g.cols + c] ?? '').trim();
          if (!text) continue;
          const spanC = block ? block.cols : 1, spanR = block ? block.rows : 1;
          const glyphs = Math.max(1, [...text].length);
          const size = Math.min(mm(f.textSizeMm) * (block ? Math.min(spanC, spanR) : 1), (g.cell * spanC * 0.8) / Math.max(1.1, glyphs * 0.62), g.cell * spanR * 0.7);
          gridText.push({
            kind: 'text', layer: 'text', id: `grid:${f.id}:${r}:${c}`, text,
            x: g.x0 + (c + spanC / 2) * g.cell, y: g.y0 + (r + spanR / 2) * g.cell, size, angle: 0,
            font: design.text.font, fill: design.text.color ?? ink,
          });
        }
    }
  }

  // -- bindu: at the heart of the Sri Yantra when there is one, otherwise the exact centre
  const bindu: Pt =
    Number.isFinite(design.bindu.x) && Number.isFinite(design.bindu.y)
      ? { x: design.bindu.x as number, y: design.bindu.y as number }
      : fig ? fig.bindu : { x: 0, y: 0 };
  if (design.bindu.visible) {
    const r = design.bindu.radius;
    const style = design.bindu.style;
    if (style === 'ring' || style === 'ringdot')
      prims.push({ kind: 'circle', cx: bindu.x, cy: bindu.y, r, layer: 'bindu', paint: { stroke: ink, strokeMm: design.triangles.lineMm, fill: null } });
    if (style === 'dot' || style === 'ringdot')
      prims.push({ kind: 'circle', cx: bindu.x, cy: bindu.y, r: style === 'dot' ? r : r * 0.45, layer: 'bindu', paint: { stroke: null, strokeMm: 0, fill: ink } });
  }

  // -- guides
  if (design.guides.axes) {
    prims.push({
      kind: 'path',
      d: [['M', 0, -extent], ['L', 0, extent], ['M', -extent, 0], ['L', extent, 0]],
      layer: 'guides',
      role: 'axes',
      paint: { stroke: GUIDE_AXIS, strokeMm: design.triangles.lineMm * 0.4, fill: null },
    });
  }
  const radialDeg = design.guides.radialDeg ?? 0;
  if (radialDeg >= 1) {
    const d: PathCmd[] = [];
    const n = Math.min(360, Math.round(360 / radialDeg));
    for (let i = 0; i < n; i++) {
      const a = ((-90 + i * radialDeg) * Math.PI) / 180;
      d.push(['M', 0, 0], ['L', extent * Math.cos(a), extent * Math.sin(a)]);
    }
    prims.push({ kind: 'path', d, layer: 'guides', role: 'radial', paint: { stroke: GUIDE_AXIS, strokeMm: design.triangles.lineMm * 0.3, fill: null } });
  }
  const arr = arrange(segs);
  const dotR = Math.max(mm(design.triangles.lineMm) * 1.6, 0.009);
  const sandhiPts = fig ? fig.sandhis : [];
  const marmaPts = fig ? fig.marmas : arr.points; // without a Sri Yantra, "marma" guides mark every crossing
  if (design.guides.sandhi)
    for (const p of sandhiPts)
      prims.push({ kind: 'circle', cx: p.x, cy: p.y, r: dotR * 0.8, layer: 'guides', role: 'sandhi', paint: { stroke: null, strokeMm: 0, fill: GUIDE_SANDHI } });
  if (design.guides.marma)
    for (const p of marmaPts)
      prims.push({ kind: 'circle', cx: p.x, cy: p.y, r: dotR, layer: 'guides', role: 'marma', paint: { stroke: null, strokeMm: 0, fill: GUIDE_MARMA } });

  if (design.guides.checks) {
    const ringR = Math.max(dotR * 3.5, 0.04);
    for (const m of analyse(segs, rounds).nearMisses)
      prims.push({ kind: 'circle', cx: m.x, cy: m.y, r: ringR, layer: 'guides', role: `check:${m.kind}`, paint: { stroke: GUIDE_CHECK, strokeMm: Math.max(design.triangles.lineMm * 1.6, 0.6), fill: null } });
  }

  // -- anchors
  const outDeg = (p: Pt) => deg(Math.atan2(p.y - bindu.y, p.x - bindu.x));
  const centreCell = fig?.cells.find((c) => c.ring === 5);
  anchors.push({ id: 'bindu:0', group: 'bindu', index: 0, x: bindu.x, y: bindu.y, r: centreCell ? centreCell.inradius : 0.06, outDeg: -90 });
  const nearestGap = (p: Pt, all: Pt[]) => {
    let near = Infinity;
    for (const q of all) {
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist > 1e-9 && dist < near) near = dist;
    }
    return Math.min(0.08, near * 0.4);
  };
  if (fig) {
    fig.cells.forEach((c, i) => {
      const base = { x: c.incenter.x, y: c.incenter.y, r: c.inradius, outDeg: c.outDeg };
      anchors.push({ id: `ring${c.ring}:${c.index}`, group: `ring${c.ring}`, index: c.index, ...base });
      anchors.push({ id: `cells:${i}`, group: 'cells', index: i, ...base });
    });
    const crossings = [...fig.marmas, ...fig.sandhis];
    fig.marmas.forEach((p, i) => anchors.push({ id: `marma:${i}`, group: 'marma', index: i, x: p.x, y: p.y, r: nearestGap(p, crossings), outDeg: outDeg(p) }));
    fig.sandhis.forEach((p, i) => anchors.push({ id: `sandhi:${i}`, group: 'sandhi', index: i, x: p.x, y: p.y, r: nearestGap(p, crossings), outDeg: outDeg(p) }));
  }
  const fewPoints = arr.points.length <= 900;
  arr.points.forEach((p, i) =>
    anchors.push({ id: `points:${i}`, group: 'points', index: i, x: p.x, y: p.y, r: fewPoints ? nearestGap(p, arr.points) : 0.02, outDeg: outDeg(p) }),
  );
  arr.regions.forEach((rg, i) =>
    anchors.push({ id: `regions:${i}`, group: 'regions', index: i, x: rg.centre.x, y: rg.centre.y, r: rg.r, outDeg: outDeg(rg.centre) }),
  );
  anchors.push(...figureAnchors, ...outer.anchors);

  const report = makeReport(!!sriSpec, solved, unitFig);
  let scene: Scene = { prims, extent, unitMm, anchors, report, lines: segs, rounds, ink, paper };

  if (design.text.visible) {
    scene.prims.push(...gridText);
    scene.prims.push(...buildLabels(design, anchors, unitMm, shaper));
  }
  if (shaper) scene = resolveText(scene, shaper);
  return scene;
}

/** The nine triangles with their 43 cells. */
function drawSri(design: Design, fig: Figure, prims: Prim[], mm: (v: number) => number, ink: string, segs: SceneLine[], owner: string) {
  if (design.cells.filled) {
    for (const c of fig.cells) {
      prims.push({
        kind: 'path',
        d: polygon(c.pts),
        layer: 'cells',
        role: `cell:${c.ring}:${c.index}`,
        paint: { stroke: null, strokeMm: 0, fill: design.cells.palette[c.ring - 1] },
      });
    }
  }
  if (design.triangles.visible && design.cells.insets > 0) {
    const gap = mm(design.cells.insetGapMm);
    for (const c of fig.cells) {
      for (let k = 1; k <= design.cells.insets; k++) {
        const p = insetTriangle(c.pts, c.incenter, c.inradius, gap * k);
        if (!p) break;
        prims.push({
          kind: 'path',
          d: polygon(p),
          layer: 'cells',
          role: `cell-inset:${c.ring}:${c.index}:${k}`,
          paint: { stroke: ink, strokeMm: design.triangles.lineMm * 0.5, fill: null },
        });
      }
    }
  }
  if (design.triangles.visible) {
    const gap = mm(design.triangles.lineGapMm);
    fig.triangles.forEach((t, i) => {
      for (let k = 0; k < Math.max(1, design.triangles.lines); k++) {
        const p = k === 0 ? t.pts : insetTriangle(t.pts, t.incenter, t.inradius, gap * k);
        if (!p) break;
        prims.push({
          kind: 'path',
          d: polygon(p),
          layer: 'triangles',
          role: `triangle:${i}:${k}`,
          paint: { stroke: ink, strokeMm: design.triangles.lineMm, fill: null },
        });
      }
      segs.push({ a: t.pts[0], b: t.pts[1], owner }, { a: t.pts[0], b: t.pts[2], owner }, { a: t.pts[1], b: t.pts[2], owner });
    });
  }
}

export { bottomAnticlockwiseKey };
