/**
 * buildScene — turns a Design document into a flat list of drawable primitives.
 * This is the single integration point: solver → arrangement → outer bands → labels.
 */
import { buildFigure, bottomAnticlockwiseKey, type Figure, type Pt } from './arrangement';
import { polygon } from './path';
import { solveGeometry, TRI, TRI_NAMES, TRI_SANSKRIT, TRI_UP, type Solved } from './solver';
import type { Anchor, Design, GeometryReport, Prim, Scene, TriangleInfo } from './types';
import { buildBands } from '../outer';
import { buildLabels, resolveText, type Shaper } from '../text';

const GUIDE_MARMA = '#c0392b';
const GUIDE_SANDHI = '#1f6fb2';
const GUIDE_AXIS = '#8a8a8a';

const deg = (rad: number) => (rad * 180) / Math.PI;

function insetTriangle(pts: Pt[], centre: Pt, inradius: number, distance: number): Pt[] | null {
  const k = 1 - distance / inradius;
  if (!(k > 0.12)) return null;
  return pts.map((p) => ({ x: centre.x + (p.x - centre.x) * k, y: centre.y + (p.y - centre.y) * k }));
}

function makeReport(s: Solved | null, fig: Figure | null): GeometryReport {
  if (!s || !fig) {
    return {
      ok: false,
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

/** Solve only (no drawing) — handy for the UI to test a spec before committing it. */
export function checkGeometry(design: Pick<Design, 'geometry'>): GeometryReport {
  const s = solveGeometry(design.geometry);
  return makeReport(s, s ? buildFigure(s, design.geometry.flip) : null);
}

export function buildScene(design: Design, shaper?: Shaper): Scene {
  const ink = design.style.ink;
  const paper = design.style.paper;
  const anyFill = design.cells.filled || design.bands.some((b) => b.visible && 'fill' in b && b.fill);
  const solved = solveGeometry(design.geometry);
  const fig = solved ? buildFigure(solved, design.geometry.flip) : null;

  const outer = buildBands(design.bands, 1, { ink, paper, filled: anyFill });
  const extent = Math.max(1.02, outer.extent);
  const unitMm = design.sizeMm / (2 * extent);
  const mm = (v: number) => v / unitMm; // mm → scene units

  const prims: Prim[] = [...outer.prims];
  const anchors: Anchor[] = [];

  if (fig) {
    // -- cells (the 43)
    if (design.cells.filled) {
      prims.push({ kind: 'circle', cx: 0, cy: 0, r: 1, layer: 'cells', role: 'ground', paint: { stroke: null, strokeMm: 0, fill: paper } });
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

    // -- the nine triangles
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
      });
    }

    // -- bindu
    if (design.bindu.visible) {
      const { x, y } = fig.bindu;
      const r = design.bindu.radius;
      const style = design.bindu.style;
      if (style === 'ring' || style === 'ringdot')
        prims.push({ kind: 'circle', cx: x, cy: y, r, layer: 'bindu', paint: { stroke: ink, strokeMm: design.triangles.lineMm, fill: null } });
      if (style === 'dot' || style === 'ringdot')
        prims.push({
          kind: 'circle',
          cx: x,
          cy: y,
          r: style === 'dot' ? r : r * 0.45,
          layer: 'bindu',
          paint: { stroke: null, strokeMm: 0, fill: ink },
        });
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
    const dotR = Math.max(mm(design.triangles.lineMm) * 1.6, 0.009);
    if (design.guides.sandhi)
      for (const p of fig.sandhis)
        prims.push({ kind: 'circle', cx: p.x, cy: p.y, r: dotR * 0.8, layer: 'guides', role: 'sandhi', paint: { stroke: null, strokeMm: 0, fill: GUIDE_SANDHI } });
    if (design.guides.marma)
      for (const p of fig.marmas)
        prims.push({ kind: 'circle', cx: p.x, cy: p.y, r: dotR, layer: 'guides', role: 'marma', paint: { stroke: null, strokeMm: 0, fill: GUIDE_MARMA } });

    // -- anchors
    const b = fig.bindu;
    const centre = fig.cells.find((c) => c.ring === 5);
    anchors.push({ id: 'bindu:0', group: 'bindu', index: 0, x: b.x, y: b.y, r: centre ? centre.inradius : 0.03, outDeg: -90 });
    fig.cells.forEach((c, i) => {
      const base = { x: c.incenter.x, y: c.incenter.y, r: c.inradius, outDeg: c.outDeg };
      anchors.push({ id: `ring${c.ring}:${c.index}`, group: `ring${c.ring}`, index: c.index, ...base });
      anchors.push({ id: `cells:${i}`, group: 'cells', index: i, ...base });
    });
    const pointAnchors = (group: string, pts: Pt[]) =>
      pts.forEach((p, i) => {
        // free space around a crossing: a fraction of the distance to the nearest other crossing
        let near = Infinity;
        for (const q of [...fig.marmas, ...fig.sandhis]) {
          const dist = Math.hypot(q.x - p.x, q.y - p.y);
          if (dist > 1e-9 && dist < near) near = dist;
        }
        anchors.push({ id: `${group}:${i}`, group, index: i, x: p.x, y: p.y, r: Math.min(0.08, near * 0.4), outDeg: deg(Math.atan2(p.y - b.y, p.x - b.x)) });
      });
    pointAnchors('marma', fig.marmas);
    pointAnchors('sandhi', fig.sandhis);
  }
  anchors.push(...outer.anchors);

  const report = makeReport(solved, fig);
  let scene: Scene = { prims, extent, unitMm, anchors, report, ink, paper };

  if (design.text.visible) {
    scene.prims.push(...buildLabels(design, anchors, unitMm, shaper));
  }
  if (shaper) scene = resolveText(scene, shaper);
  return scene;
}

export { bottomAnticlockwiseKey };
