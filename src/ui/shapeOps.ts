/** Actions on the selected figures, shared by the canvas toolbar, the keyboard and the panels. */
import {
  arrangeCopies, centreOf, dragCorner, flipShape, fromTriangle, mirrorShape, moveShape, normaliseShape, orbitPlacements, polygonLoops,
  rotateShape, shapeCentre, shapeCorners, type ArrangeSpec, type Pt,
} from '../core';
import type { CentreFigure, Design, PolygonFigure, ShapeFigure } from '../core/types';
import { newId } from '../presets';
import { studio } from './store';
import { clipboard, editorUI, setEditorUI } from './runtime';
import { nearestCurve, nearestPoint, snapAlong, type SnapHit, type SnapSet } from './snap';

const cur = () => studio.getState().design;
const sel = () => editorUI.getState().sel;

export function shapesOf(design: Design | null, ids: string[]): ShapeFigure[] {
  if (!design) return [];
  const set = new Set(ids);
  return centreOf(design).filter((f): f is ShapeFigure => f.type === 'shape' && set.has(f.id));
}

export const selectedShapes = () => shapesOf(cur(), sel());

/** Middle of the selection: a single shape's own centre, or the middle of all their corners' box. */
export function selectionPivot(shapes: ShapeFigure[]): Pt {
  if (shapes.length === 1) return shapeCentre(shapes[0]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of shapes)
    for (const p of shapeCorners(f)) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  return Number.isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : { x: 0, y: 0 };
}

/** Write changed shapes back by id. */
export function putShapes(shapes: ShapeFigure[], coalesceKey?: string) {
  if (!shapes.length) return;
  const byId = new Map(shapes.map((f) => [f.id, f]));
  studio.getState().update(
    (d) => {
      d.centre = centreOf(d).map((f) => {
        const n = byId.get(f.id);
        return n ? normaliseShape({ ...n, id: f.id, visible: f.visible }) : f;
      });
    },
    coalesceKey ? { coalesceKey } : undefined,
  );
}

export function rotateSelection(deg: number) {
  const s = selectedShapes();
  const pivot = selectionPivot(s);
  putShapes(s.map((f) => rotateShape(f, pivot, deg)));
}

export function flipSelection() {
  const s = selectedShapes();
  if (s.length === 1) putShapes([flipShape(s[0])]);
  else {
    const pivot = selectionPivot(s);
    putShapes(s.map((f) => rotateShape(f, pivot, 180)));
  }
}

export function mirrorSelection(axis: 'lr' | 'tb' = 'lr') {
  const s = selectedShapes();
  const pivot = s.length === 1 ? { x: s[0].x, y: s[0].y } : selectionPivot(s);
  putShapes(s.map((f) => mirrorShape(f, pivot, axis)));
}

export function nudgeSelection(dx: number, dy: number) {
  putShapes(selectedShapes().map((f) => moveShape(f, dx, dy)), 'nudge');
}

/** Insert copies right after their originals (or at the end) and select them. */
function insertFigures(figs: CentreFigure[], after?: string) {
  if (!figs.length) return;
  studio.getState().update((d) => {
    d.centre = centreOf(d);
    let at = after ? d.centre.findIndex((f) => f.id === after) : -1;
    at = at < 0 ? d.centre.length : at + 1;
    d.centre.splice(at, 0, ...figs);
  });
}

const withNewIds = (figs: CentreFigure[]) => figs.map((f) => ({ ...structuredClone(f), id: newId('f') }) as CentreFigure);

export function duplicateSelection(): number {
  const d = cur();
  if (!d) return 0;
  const ids = new Set(sel());
  const src = centreOf(d).filter((f) => ids.has(f.id) && f.type !== 'sri');
  const copies = withNewIds(src);
  insertFigures(copies, src[src.length - 1]?.id);
  setEditorUI({ sel: copies.map((f) => f.id) });
  return copies.length;
}

export function deleteSelection(): number {
  const ids = new Set(sel());
  if (!ids.size) return 0;
  studio.getState().update((d) => {
    d.centre = centreOf(d).filter((f) => !ids.has(f.id));
  });
  setEditorUI({ sel: [] });
  return ids.size;
}

export function copySelection(): number {
  const d = cur();
  if (!d) return 0;
  const ids = new Set(sel());
  clipboard.figures = structuredClone(centreOf(d).filter((f) => ids.has(f.id) && f.type !== 'sri'));
  return clipboard.figures.length;
}

export function pasteClipboard(): number {
  if (!clipboard.figures.length || !cur()) return 0;
  const copies = withNewIds(clipboard.figures);
  insertFigures(copies);
  setEditorUI({ sel: copies.map((f) => f.id) });
  return copies.length;
}

export function selectAllShapes() {
  const d = cur();
  if (!d) return;
  setEditorUI({ sel: centreOf(d).filter((f) => f.type === 'shape').map((f) => f.id) });
}

/** Add the copies an arrangement describes; the originals and the copies end up selected. */
export function addArrangedCopies(spec: ArrangeSpec): number {
  const s = selectedShapes();
  if (!s.length) return 0;
  const groups = arrangeCopies(s, spec);
  const made = groups.flat().map((f) => ({ ...f, id: newId('f') }));
  insertFigures(made, s[s.length - 1].id);
  setEditorUI({ sel: [...s.map((f) => f.id), ...made.map((f) => f.id)] });
  return made.length;
}

/** Can this polygon become free shapes (triangles / squares that can be moved and turned)? */
export function convertible(f: CentreFigure): f is PolygonFigure {
  if (f.type !== 'polygon') return false;
  const n = Math.round(f.sides), k = Math.round(f.step);
  const per = n / gcd(n, Math.max(1, k));
  return per === 3 || per === 4;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The polygon's triangles / squares (every nested copy and every orbit copy) as free shapes. */
export function polygonToShapes(f: PolygonFigure): ShapeFigure[] {
  const out: ShapeFigure[] = [];
  for (const pl of orbitPlacements(f.orbit))
    for (const copy of polygonLoops(f, pl).copies)
      for (const loop of copy.loops) {
        const base: ShapeFigure = {
          id: newId('f'), type: 'shape', visible: f.visible, lock: loop.length === 3 ? 'equilateral' : 'square', x: 0, y: 0, w: 1, h: 1, skew: 0,
          rotationDeg: 0, lineMm: f.lineMm, lines: f.lines, lineGapMm: f.lineGapMm, rows: 1, fill: f.fill,
        };
        if (loop.length === 3) out.push(normaliseShape(fromTriangle(base, loop[0], loop[1], loop[2])));
        else if (loop.length === 4) {
          const e = { x: loop[1].x - loop[0].x, y: loop[1].y - loop[0].y };
          const w = Math.hypot(e.x, e.y);
          const c = { x: loop.reduce((s, p) => s + p.x, 0) / 4, y: loop.reduce((s, p) => s + p.y, 0) / 4 };
          out.push(normaliseShape({ ...base, x: c.x, y: c.y, w, h: w, rotationDeg: (Math.atan2(e.y, e.x) * 180) / Math.PI }));
        }
      }
  return out;
}

export function convertPolygon(id: string): number {
  const d = cur();
  const f = d ? centreOf(d).find((x) => x.id === id) : undefined;
  if (!f || !convertible(f)) return 0;
  const shapes = polygonToShapes(f);
  studio.getState().update((dd) => {
    dd.centre = centreOf(dd);
    const i = dd.centre.findIndex((x) => x.id === id);
    if (i >= 0) dd.centre.splice(i, 1, ...shapes);
  });
  setEditorUI({ sel: shapes.map((s) => s.id) });
  return shapes.length;
}

/**
 * The way corner `i` moves when it is dragged without turning the shape, or null when any way is fine.
 * Landing on a line or circle along this way keeps the shape's angle (and so the symmetry of copies).
 */
export function slideDir(f: ShapeFigure, i: number): Pt | null {
  const c = shapeCorners(f);
  if (f.lock === 'equilateral' || f.lock === 'square') {
    const m = shapeCentre(f);
    return { x: c[i].x - m.x, y: c[i].y - m.y };
  }
  if (f.lock === 'isosceles' && i === 0) {
    const mid = { x: (c[1].x + c[2].x) / 2, y: (c[1].y + c[2].y) / 2 };
    return { x: c[0].x - mid.x, y: c[0].y - mid.y };
  }
  return null;
}

/** Best exact place for a corner: a point target, else a line/circle reached by sliding (angle kept), else the nearest place on one. */
export function cornerTarget(f: ShapeFigure, i: number, p: Pt, snaps: SnapSet, tol: number): SnapHit | null {
  const pt = nearestPoint(p, snaps, tol);
  if (pt) return pt;
  const dir = slideDir(f, i);
  if (dir) {
    const along = snapAlong(p, dir, snaps, tol);
    if (along) return along;
  }
  return nearestCurve(p, snaps, tol);
}

export interface CornerCheck {
  id: string;
  index: number;
  p: Pt;
  /** where it should be, when it is close to something but not on it */
  target: Pt | null;
  /** distance off, scene units (0 = exactly on a corner, crossing, line or circle) */
  off: number;
  exact: boolean;
}

/** For each corner: is it exactly on something, nearly on something, or free? */
export function checkCorners(shapes: ShapeFigure[], snaps: SnapSet, tol: number): CornerCheck[] {
  const out: CornerCheck[] = [];
  for (const f of shapes)
    shapeCorners(f).forEach((p, index) => {
      const h = cornerTarget(f, index, p, snaps, tol);
      const exact = !!h && h.d < 1e-8;
      out.push({ id: f.id, index, p, target: h && !exact ? h.p : null, off: h ? h.d : Infinity, exact });
    });
  return out;
}

/** Pull every nearly-touching corner exactly onto what it nearly touches. Returns the number of corners moved. */
export function fixCorners(shapes: ShapeFigure[], snaps: SnapSet, tol: number): { shapes: ShapeFigure[]; moved: number } {
  let moved = 0;
  const fixed = shapes.map((f0) => {
    let f = f0;
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      shapeCorners(f).forEach((p, i) => {
        const h = cornerTarget(f, i, p, snaps, tol);
        if (h && h.d > 1e-10) {
          f = dragCorner(f, i, h.p);
          changed = true;
          if (pass === 0) moved++;
        }
      });
      if (!changed) break;
    }
    return f;
  });
  return { shapes: fixed, moved };
}
