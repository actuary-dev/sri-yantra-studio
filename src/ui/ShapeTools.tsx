/**
 * Working with shapes right on the canvas: tap to pick, drag to move, drag a
 * corner to reshape (it jumps exactly onto corners, crossings, lines and circles),
 * drag the round handle to turn. Plus the toolbar for the picked shapes and the
 * "copies" sheet (turned, mirrored, in a row, nested).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  apexAngle, arrangeCopies, centreOf, distToSegment, dragCorner, isTriangle, moveShape, pointInPolygon, polygonArea, rotateShape, shapeCentre, shapeCorners,
  toWorld, type ArrangeSpec, type Pt,
} from '../core';
import type { Design, Scene, ShapeFigure } from '../core/types';
import { pathToD } from '../core';
import { studio, useStudio } from './store';
import { editorUI, setEditorUI, showToast, useEditorUI } from './runtime';
import { collectSnaps, nearestCurve, nearestPoint, primFigure, snapAlong, snapAngle, type SnapKind, type SnapSet } from './snap';
import {
  addArrangedCopies, checkCorners, convertPolygon, convertible, copySelection, deleteSelection, duplicateSelection, fixCorners, flipSelection,
  mirrorSelection, putShapes, rotateSelection, selectionPivot, shapesOf, slideDir,
} from './shapeOps';
import { useT, type TKey } from './i18n';
import { Icon } from './components/Icon';
import { Sheet } from './components/Sheet';
import { Segmented } from './components/Segmented';
import { Stepper } from './components/Stepper';
import { NumberField } from './components/NumberField';
import { Group, Row, Block, Chips } from './components/List';

const RAD = Math.PI / 180;
const HANDLE_PX = 9;
const GRAB_PX = 22;
const SNAP_PX = 14;
const ROT_PX = 34;

/* ---------------------------------------------------------- hit testing */

interface HitIndex {
  segs: { id: string; a: Pt; b: Pt }[];
  circles: { id: string; c: Pt; r: number }[];
  polys: { id: string; pts: Pt[]; area: number }[];
}

function buildHitIndex(design: Design, scene: Scene): HitIndex {
  const figs = centreOf(design);
  const sriId = figs.find((f) => f.type === 'sri')?.id ?? null;
  const segs: HitIndex['segs'] = [], circles: HitIndex['circles'] = [];
  for (const pr of scene.prims) {
    const id = primFigure(pr.layer, sriId);
    if (!id || pr.role === 'fill') continue;
    if (pr.kind === 'circle') circles.push({ id, c: { x: pr.cx, y: pr.cy }, r: pr.r });
    else if (pr.kind === 'path') {
      let cur: Pt | null = null, start: Pt | null = null;
      for (const c of pr.d) {
        if (c[0] === 'M') { cur = { x: c[1], y: c[2] }; start = cur; continue; }
        if (c[0] === 'Z') { if (cur && start) segs.push({ id, a: cur, b: start }); cur = start; continue; }
        const end = c[0] === 'L' ? { x: c[1], y: c[2] } : c[0] === 'Q' ? { x: c[3], y: c[4] } : { x: c[5], y: c[6] };
        if (cur) segs.push({ id, a: cur, b: end });
        cur = end;
      }
    }
  }
  const polys = figs.filter((f): f is ShapeFigure => f.type === 'shape' && f.visible).map((f) => {
    const pts = shapeCorners(f);
    return { id: f.id, pts, area: polygonArea(pts) };
  });
  return { segs, circles, polys };
}

function hitFigure(ix: HitIndex, p: Pt, tol: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of ix.segs) {
    const d = distToSegment(p, s.a, s.b);
    if (d <= tol && (!best || d < best.d)) best = { id: s.id, d };
  }
  for (const c of ix.circles) {
    const d = Math.abs(Math.hypot(p.x - c.c.x, p.y - c.c.y) - c.r);
    if (d <= tol && (!best || d < best.d)) best = { id: c.id, d };
  }
  if (best) return best.id;
  let inside: { id: string; area: number } | null = null;
  for (const q of ix.polys) if (pointInPolygon(p, q.pts) && (!inside || q.area < inside.area)) inside = { id: q.id, area: q.area };
  return inside?.id ?? null;
}

/* ------------------------------------------------------------- dragging */

type Drag =
  | { kind: 'corner'; id: string; i: number; orig: ShapeFigure; off: Pt; snaps: SnapSet | null; key: string }
  | { kind: 'body'; orig: ShapeFigure[]; start: Pt; snaps: SnapSet | null; key: string }
  | { kind: 'rotate'; orig: ShapeFigure[]; pivot: Pt; a0: number; key: string };

interface Hud {
  /** where a snap happened */
  at: Pt | null;
  kind: SnapKind | 'angle' | null;
  text: string;
}

function rotateHandle(shapes: ShapeFigure[], s: number): { from: Pt; at: Pt } | null {
  if (!shapes.length) return null;
  if (shapes.length === 1) {
    const f = shapes[0];
    const top = toWorld(f, { x: isTriangle(f) ? f.skew * f.w : 0, y: -f.h / 2 });
    const up = { x: Math.sin(f.rotationDeg * RAD), y: -Math.cos(f.rotationDeg * RAD) };
    return { from: top, at: { x: top.x + (up.x * ROT_PX) / s, y: top.y + (up.y * ROT_PX) / s } };
  }
  let y0 = Infinity;
  for (const f of shapes) for (const p of shapeCorners(f)) y0 = Math.min(y0, p.y);
  const c = selectionPivot(shapes);
  const from = { x: c.x, y: y0 };
  return { from, at: { x: from.x, y: from.y - ROT_PX / s } };
}

export interface ShapeToolsArgs {
  design: Design;
  scene: Scene | null;
  /** true when a tap on the canvas should pick figures (not placing text or drawing) */
  active: boolean;
}

export function useShapeTools({ design, scene, active }: ShapeToolsArgs) {
  const t = useT();
  const sel = useEditorUI((s) => s.sel);
  const snapOn = useStudio((s) => s.settings.snap);
  const preview = useEditorUI((s) => s.preview);
  const [hud, setHud] = useState<Hud | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const shift = useRef(false);
  const unitMm = scene?.unitMm ?? 1;

  useEffect(() => {
    const on = (e: KeyboardEvent) => { shift.current = e.shiftKey; };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', on);
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on); };
  }, []);

  // forget picked figures that no longer exist
  useEffect(() => {
    const ids = new Set(centreOf(design).map((f) => f.id));
    if (sel.some((id) => !ids.has(id))) setEditorUI({ sel: sel.filter((id) => ids.has(id)) });
  }, [design, sel]);

  const hitIx = useMemo(() => (scene ? buildHitIndex(design, scene) : null), [design, scene]);
  const shapes = useMemo(() => shapesOf(design, sel), [design, sel]);
  const sriId = useMemo(() => centreOf(design).find((f) => f.type === 'sri')?.id ?? null, [design]);

  const snapsFor = useCallback(
    (ids: string[], tol: number) => (scene ? collectSnaps(scene, new Set(ids), sriId, tol) : null),
    [scene, sriId],
  );

  /** Corners that are exactly on something, or nearly — checked when nothing is moving. */
  const nearTol = 2.5 / unitMm;
  const checks = useMemo(() => {
    if (dragging || !scene || !shapes.length || shapes.length > 24) return [];
    const snaps = collectSnaps(scene, new Set(shapes.map((f) => f.id)), sriId, nearTol);
    return checkCorners(shapes, snaps, nearTol);
  }, [dragging, scene, shapes, sriId, nearTol]);
  const nearMisses = checks.filter((c) => c.target).length;

  const fixNow = useCallback(() => {
    if (!scene) return;
    const snaps = collectSnaps(scene, new Set(shapes.map((f) => f.id)), sriId, nearTol);
    const r = fixCorners(shapes, snaps, nearTol);
    putShapes(r.shapes);
    showToast(t('sel.fixed', { n: r.moved }), 'success', 2200);
  }, [scene, shapes, sriId, nearTol, t]);

  /* -- taps pick figures */
  const tapSelect = useCallback(
    (x: number, y: number, s: number) => {
      if (!hitIx) return;
      const id = hitFigure(hitIx, { x, y }, GRAB_PX / s / 1.6);
      const ui = editorUI.getState();
      if (ui.multi || shift.current) {
        if (!id) return;
        setEditorUI({ sel: ui.sel.includes(id) ? ui.sel.filter((q) => q !== id) : [...ui.sel, id] });
      } else setEditorUI({ sel: id ? [id] : [] });
    },
    [hitIx],
  );

  /* -- drags start on a corner handle, the turn handle, or inside a picked shape */
  const dragTest = useCallback(
    (x: number, y: number, s: number): boolean => {
      if (!active) return false;
      const picked = shapesOf(studio.getState().design, editorUI.getState().sel);
      if (!picked.length) return false;
      const p = { x, y };
      const grab = GRAB_PX / s;
      const tol = SNAP_PX / s;
      const key = `shape-drag:${Date.now()}`;
      const rh = rotateHandle(picked, s);
      if (rh && Math.hypot(rh.at.x - x, rh.at.y - y) <= grab) {
        const pivot = selectionPivot(picked);
        drag.current = { kind: 'rotate', orig: picked, pivot, a0: Math.atan2(y - pivot.y, x - pivot.x) / RAD, key };
        setDragging(true);
        return true;
      }
      if (picked.length === 1) {
        const f = picked[0];
        const corners = shapeCorners(f);
        let bi = -1, bd = Infinity;
        corners.forEach((c, i) => {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bd) { bd = d; bi = i; }
        });
        if (bi >= 0 && bd <= grab) {
          const snaps = snapsFor([f.id], tol);
          drag.current = { kind: 'corner', id: f.id, i: bi, orig: f, off: { x: corners[bi].x - x, y: corners[bi].y - y }, snaps, key };
          setDragging(true);
          return true;
        }
      }
      const inside = picked.some((f) => {
        const c = shapeCorners(f);
        if (pointInPolygon(p, c)) return true;
        for (let i = 0; i < c.length; i++) if (distToSegment(p, c[i], c[(i + 1) % c.length]) <= grab * 0.6) return true;
        return false;
      });
      if (!inside) return false;
      drag.current = { kind: 'body', orig: picked, start: p, snaps: snapsFor(picked.map((f) => f.id), tol), key };
      setDragging(true);
      return true;
    },
    [active, snapsFor],
  );

  const dims = useCallback(
    (f: ShapeFigure) => {
      const mm = (v: number) => (v * unitMm).toFixed(1);
      const base = `${mm(f.w)} × ${mm(f.h)} mm`;
      return isTriangle(f) && Math.abs(f.skew) < 1e-9 ? `${base} · ${apexAngle(f).toFixed(1)}°` : base;
    },
    [unitMm],
  );

  const onDrag = useCallback(
    (x: number, y: number, s: number) => {
      const g = drag.current;
      if (!g) return;
      const tol = SNAP_PX / s;
      const snapping = studio.getState().settings.snap;
      if (g.kind === 'corner') {
        const want = { x: x + g.off.x, y: y + g.off.y };
        let hit = snapping && g.snaps ? nearestPoint(want, g.snaps, tol) : null;
        let target = hit ? hit.p : want;
        let angleSnap = false;
        if (!hit && snapping && g.snaps) {
          // a tip of an isosceles triangle keeps to a straight-up / 15° axis unless pulled clearly away
          let axis: { from: Pt; dir: Pt } | null = null;
          if (g.orig.lock === 'isosceles' && g.i === 0) {
            const c = shapeCorners(g.orig);
            const mid = { x: (c[1].x + c[2].x) / 2, y: (c[1].y + c[2].y) / 2 };
            const sa = snapAngle(Math.atan2(want.y - mid.y, want.x - mid.x) / RAD, 15, 3);
            if (sa.snapped) {
              const h = Math.hypot(want.x - mid.x, want.y - mid.y);
              const dir = { x: Math.cos(sa.deg * RAD), y: Math.sin(sa.deg * RAD) };
              target = { x: mid.x + h * dir.x, y: mid.y + h * dir.y };
              axis = { from: mid, dir };
              angleSnap = true;
            }
          } else {
            const dir = slideDir(g.orig, g.i);
            if (dir) {
              // equilateral / square: grow along the line from the centre so the angle is kept
              const m = shapeCentre(g.orig);
              const L = Math.hypot(dir.x, dir.y);
              const u = { x: dir.x / L, y: dir.y / L };
              const along = (want.x - m.x) * u.x + (want.y - m.y) * u.y;
              const onRay = { x: m.x + u.x * along, y: m.y + u.y * along };
              if (Math.hypot(onRay.x - want.x, onRay.y - want.y) < tol) { target = onRay; axis = { from: m, dir: u }; angleSnap = true; }
            }
          }
          const curve = axis ? snapAlong(target, axis.dir, g.snaps, tol) : null;
          hit = curve ?? (axis ? null : nearestCurve(want, g.snaps, tol * 0.8));
          if (hit) target = hit.p;
        }
        const next = dragCorner(g.orig, g.i, target);
        putShapes([next], g.key);
        setHud({ at: hit ? hit.p : null, kind: hit ? hit.kind : angleSnap ? 'angle' : null, text: dims(next) });
      } else if (g.kind === 'body') {
        let dx = x - g.start.x, dy = y - g.start.y;
        let at: Pt | null = null, kind: SnapKind | null = null;
        if (snapping && g.snaps) {
          let best: { d: number; ex: number; ey: number; p: Pt; kind: SnapKind } | null = null;
          const test = (q: Pt, curves: boolean) => {
            const m = { x: q.x + dx, y: q.y + dy };
            const h = nearestPoint(m, g.snaps!, tol) ?? (curves ? nearestCurve(m, g.snaps!, tol * 0.8) : null);
            if (h && (!best || h.d + (h.point ? 0 : tol * 0.3) < best.d)) best = { d: h.d + (h.point ? 0 : tol * 0.3), ex: h.p.x - m.x, ey: h.p.y - m.y, p: h.p, kind: h.kind };
          };
          const many = g.orig.length > 30;
          for (const f of g.orig) {
            for (const c of shapeCorners(f)) test(c, !many);
            if (!many) { test(shapeCentre(f), false); test({ x: f.x, y: f.y }, false); }
          }
          const b = best as { ex: number; ey: number; p: Pt; kind: SnapKind } | null;
          if (b) { dx += b.ex; dy += b.ey; at = b.p; kind = b.kind; }
        }
        putShapes(g.orig.map((f) => moveShape(f, dx, dy)), g.key);
        const pivot = g.orig.length === 1 ? { x: g.orig[0].x + dx, y: g.orig[0].y + dy } : null;
        setHud({ at, kind, text: pivot ? `x ${(pivot.x * unitMm).toFixed(1)} · y ${(-pivot.y * unitMm).toFixed(1)} mm` : `${g.orig.length}` });
      } else {
        let ang = Math.atan2(y - g.pivot.y, x - g.pivot.x) / RAD - g.a0;
        ang = ((ang + 540) % 360) - 180;
        const base = g.orig.length === 1 ? g.orig[0].rotationDeg : 0;
        let snapped = false;
        if (snapping) {
          const sa = snapAngle(base + ang, 15, 3);
          if (sa.snapped) { ang = sa.deg - base; snapped = true; }
          else ang = Math.round(ang * 2) / 2;
        }
        putShapes(g.orig.map((f) => rotateShape(f, g.pivot, ang)), g.key);
        const shown = base + ang;
        setHud({ at: g.pivot, kind: snapped ? 'angle' : null, text: `${(((shown + 540) % 360) - 180).toFixed(1)}°` });
      }
    },
    [dims, unitMm],
  );

  const onDragEnd = useCallback(() => {
    drag.current = null;
    setDragging(false);
    setHud(null);
  }, []);

  /* -- drawing on top of the yantra */
  const overlay = useCallback(
    (s: number) => {
      if (!scene) return null;
      const selSet = new Set(sel);
      const hl = scene.prims.filter((p) => {
        const id = primFigure(p.layer, sriId);
        return id && selSet.has(id) && p.kind !== 'text' && p.role !== 'fill';
      });
      const one = shapes.length === 1 ? shapes[0] : null;
      const rh = active ? rotateHandle(shapes, s) : null;
      const sw = 2 / s;
      return (
        <g className="shape-overlay" pointerEvents="none">
          {hl.map((p, i) =>
            p.kind === 'circle' ? (
              <circle key={`h${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke="var(--accent)" strokeWidth={2.5 / s} opacity={0.85} />
            ) : p.kind === 'path' ? (
              <path key={`h${i}`} d={pathToD(p.d)} fill="none" stroke="var(--accent)" strokeWidth={2.5 / s} opacity={0.85} strokeLinejoin="round" />
            ) : null,
          )}
          {preview?.map((f, i) => {
            const c = shapeCorners(f);
            return <polygon key={`pv${i}`} points={c.map((q) => `${q.x},${q.y}`).join(' ')} fill="var(--accent)" fillOpacity={0.06} stroke="var(--accent)" strokeWidth={1.6 / s} strokeDasharray={`${5 / s} ${4 / s}`} />;
          })}
          {rh && (
            <>
              <line x1={rh.from.x} y1={rh.from.y} x2={rh.at.x} y2={rh.at.y} stroke="var(--accent)" strokeWidth={1.5 / s} />
              <circle cx={rh.at.x} cy={rh.at.y} r={HANDLE_PX / s} fill="var(--accent)" stroke="#fff" strokeWidth={sw} />
              <path
                d={`M ${rh.at.x - 4 / s} ${rh.at.y + 1 / s} A ${4 / s} ${4 / s} 0 1 1 ${rh.at.x + 1 / s} ${rh.at.y + 4 / s}`}
                fill="none" stroke="#fff" strokeWidth={1.6 / s} strokeLinecap="round"
              />
            </>
          )}
          {active && one &&
            shapeCorners(one).map((c, i) => (
              <circle key={`c${i}`} cx={c.x} cy={c.y} r={HANDLE_PX / s} fill="#fff" stroke="var(--accent)" strokeWidth={2.5 / s} />
            ))}
          {!dragging &&
            checks.map((c) =>
              c.exact ? (
                <circle key={`k${c.id}${c.index}`} cx={c.p.x} cy={c.p.y} r={3.2 / s} fill="#1f9d55" />
              ) : c.target ? (
                <g key={`k${c.id}${c.index}`}>
                  <circle cx={c.target.x} cy={c.target.y} r={6 / s} fill="none" stroke="#d97706" strokeWidth={2 / s} />
                  <line x1={c.p.x} y1={c.p.y} x2={c.target.x} y2={c.target.y} stroke="#d97706" strokeWidth={1.5 / s} />
                  <text x={c.target.x + 9 / s} y={c.target.y - 7 / s} fontSize={11 / s} fill="#b45309" fontFamily="system-ui, sans-serif">
                    {(c.off * unitMm).toFixed(2)} mm
                  </text>
                </g>
              ) : null,
            )}
          {hud?.at && (
            <g>
              <circle cx={hud.at.x} cy={hud.at.y} r={11 / s} fill="none" stroke={hud.kind === 'angle' ? 'var(--accent)' : '#1f9d55'} strokeWidth={2.5 / s} />
              <circle cx={hud.at.x} cy={hud.at.y} r={2.5 / s} fill="#1f9d55" />
            </g>
          )}
        </g>
      );
    },
    [scene, sel, sriId, shapes, active, preview, checks, dragging, hud, unitMm],
  );

  const hudText = hud
    ? [hud.kind && hud.kind !== 'angle' ? t(`snap.${hud.kind}` as TKey) : hud.kind === 'angle' ? t('snap.angle') : null, hud.text].filter(Boolean).join(' · ')
    : null;

  return { tapSelect, dragTest, onDrag, onDragEnd, overlay, hudText, nearMisses, fixNow, snapOn };
}

/* -------------------------------------------------------------- toolbar */

const STEPS = [1, 5, 15, 30, 45, 60, 90];

export function SelectionBar({ design, nearMisses, onFix, onEdit }: { design: Design; nearMisses: number; onFix(): void; onEdit(): void }) {
  const t = useT();
  const sel = useEditorUI((s) => s.sel);
  const multi = useEditorUI((s) => s.multi);
  const [step, setStep] = useState(15);
  const figs = centreOf(design).filter((f) => sel.includes(f.id));
  const shapes = figs.filter((f): f is ShapeFigure => f.type === 'shape');
  const conv = figs.length === 1 && convertible(figs[0]) ? figs[0] : null;
  const onlySri = figs.length > 0 && figs.every((f) => f.type === 'sri');
  if (!sel.length) return null;
  const btn = (icon: Parameters<typeof Icon>[0]['name'], label: string, onClick: () => void, extra = '') => (
    <button type="button" className={`selbar-btn${extra}`} onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="selbar material" role="toolbar" aria-label={t('sel.toolbar')}>
      <span className="selbar-count">{sel.length === 1 ? t('sel.one') : t('sel.many', { n: sel.length })}</span>
      {shapes.length > 0 && (
        <>
          <button type="button" className="selbar-btn" onClick={() => rotateSelection(-step)} aria-label={t('sel.turnLeft', { n: step })} title={t('sel.turnLeft', { n: step })}>
            <Icon name="rotateL" size={20} />
          </button>
          <button
            type="button"
            className="selbar-step"
            onClick={() => setStep(STEPS[(STEPS.indexOf(step) + 1) % STEPS.length])}
            aria-label={t('sel.step', { n: step })}
            title={t('sel.step', { n: step })}
          >
            {step}°
          </button>
          <button type="button" className="selbar-btn" onClick={() => rotateSelection(step)} aria-label={t('sel.turnRight', { n: step })} title={t('sel.turnRight', { n: step })}>
            <Icon name="rotateR" size={20} />
          </button>
          {btn('flip', t('sel.flip'), flipSelection)}
          {btn('mirror', t('sel.mirror'), () => mirrorSelection('lr'))}
          {btn('copies', t('sel.copies'), () => setEditorUI({ arrangeOpen: true }))}
        </>
      )}
      {!onlySri && btn('duplicate', t('sel.duplicate'), () => { const n = duplicateSelection(); if (n) showToast(t('sel.duplicated'), 'info', 2400); })}
      {!onlySri && btn('copy', t('sel.copy'), () => { const n = copySelection(); if (n) showToast(t('sel.copiedN', { n }), 'info', 2000); })}
      {conv && btn('magnet', t('sel.makeFree'), () => { const n = convertPolygon(conv.id); if (n) showToast(t('sel.madeFree', { n }), 'success', 3000); }, ' is-accent')}
      {nearMisses > 0 && btn('magnet', t('sel.fix', { n: nearMisses }), onFix, ' is-warn')}
      {btn('pencil', t('sel.edit'), onEdit)}
      {btn('trash', t('common.delete'), () => deleteSelection(), ' is-destructive')}
      <button
        type="button"
        className={`selbar-btn${multi ? ' is-on' : ''}`}
        aria-pressed={multi}
        onClick={() => setEditorUI({ multi: !multi })}
        title={t('sel.multi')}
        aria-label={t('sel.multi')}
      >
        <Icon name="multi" size={20} />
        <span>{t('sel.multiShort')}</span>
      </button>
      <button type="button" className="selbar-btn" onClick={() => setEditorUI({ sel: [], multi: false })} aria-label={t('sel.clear')} title={t('sel.clear')}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

/* --------------------------------------------------------- copies sheet */

type PivotId = 'yantra' | 'own' | `corner:${number}`;

export function ArrangeSheet({ design, scene, bottomOffset, topReserve }: { design: Design; scene: Scene | null; bottomOffset: number; topReserve: number }) {
  const t = useT();
  const open = useEditorUI((s) => s.arrangeOpen);
  const sel = useEditorUI((s) => s.sel);
  const shapes = useMemo(() => shapesOf(design, sel), [design, sel]);
  const unitMm = scene?.unitMm ?? 1;
  const [mode, setMode] = useState<ArrangeSpec['mode']>('turn');
  const [count, setCount] = useState(3);
  const [stepDeg, setStepDeg] = useState(90);
  const [pivot, setPivot] = useState<PivotId>('own');
  const [axis, setAxis] = useState<'lr' | 'tb'>('lr');
  const [mirrorAbout, setMirrorAbout] = useState<'yantra' | 'own'>('yantra');
  const [dxMm, setDxMm] = useState(20);
  const [dyMm, setDyMm] = useState(0);
  const [ratio, setRatio] = useState(80);

  const one = shapes.length === 1 ? shapes[0] : null;
  const pivotPt = useCallback(
    (id: PivotId): Pt => {
      if (id === 'yantra') return { x: 0, y: 0 };
      if (id === 'own') return selectionPivot(shapes);
      const i = Number(id.split(':')[1]);
      return one ? shapeCorners(one)[i] ?? selectionPivot(shapes) : selectionPivot(shapes);
    },
    [shapes, one],
  );

  const spec: ArrangeSpec = useMemo(
    () => ({
      mode,
      count,
      stepDeg,
      pivot: mode === 'mirror' ? (mirrorAbout === 'yantra' ? { x: 0, y: 0 } : selectionPivot(shapes)) : pivotPt(pivot),
      axis,
      dx: dxMm / unitMm,
      dy: -dyMm / unitMm,
      ratio: ratio / 100,
    }),
    [mode, count, stepDeg, mirrorAbout, shapes, pivotPt, pivot, axis, dxMm, dyMm, unitMm, ratio],
  );

  // show the copies before they are made
  useEffect(() => {
    if (!open || !shapes.length) {
      if (editorUI.getState().preview) setEditorUI({ preview: null });
      return;
    }
    setEditorUI({ preview: arrangeCopies(shapes, spec).flat() });
  }, [open, shapes, spec]);

  const close = () => setEditorUI({ arrangeOpen: false, preview: null });
  const made = mode === 'mirror' ? shapes.length : shapes.length * count;
  const apply = () => {
    const n = addArrangedCopies(spec);
    close();
    if (n) showToast(t('arr.made', { n }), 'success', 2600);
  };

  const cornerNames: TKey[] = one && isTriangle(one) ? ['arr.apex', 'arr.baseLeft', 'arr.baseRight'] : ['arr.c1', 'arr.c2', 'arr.c3', 'arr.c4'];
  return (
    <Sheet
      open={open && shapes.length > 0}
      onClose={close}
      label={t('arr.title')}
      title={t('arr.title')}
      detents={[0.46, 0.88]}
      bottomOffset={bottomOffset}
      topReserve={topReserve}
      headerLeft={<button type="button" className="text-btn" onClick={close}>{t('common.cancel')}</button>}
      headerRight={<button type="button" className="text-btn is-strong" onClick={apply}>{t('arr.add', { n: made })}</button>}
    >
      <div className="panel">
        <Block>
          <Segmented<ArrangeSpec['mode']>
            label={t('arr.title')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'turn', label: t('arr.turn') },
              { value: 'mirror', label: t('arr.mirror') },
              { value: 'row', label: t('arr.row') },
              { value: 'nest', label: t('arr.nest') },
            ]}
          />
        </Block>
        <Group footer={t(`arr.${mode}Hint` as TKey)}>
          {mode !== 'mirror' && (
            <Row label={t('arr.count')}>
              <Stepper label={t('arr.count')} value={count} min={1} max={72} onChange={setCount} />
            </Row>
          )}
          {mode === 'turn' && (
            <>
              <Row label={t('arr.step')}>
                <NumberField label={t('arr.step')} value={stepDeg} min={-360} max={360} digits={2} suffix="°" onChange={setStepDeg} />
              </Row>
              <Block>
                <Chips<number>
                  label={t('arr.step')}
                  value={stepDeg}
                  onChange={setStepDeg}
                  options={[...new Set([90, 60, 45, 30, 15, 120, +(360 / (count + 1)).toFixed(4)])].map((v) => ({ value: v, label: `${+v.toFixed(2)}°` }))}
                />
              </Block>
              <Block>
                <div className="row-label">{t('arr.pivot')}</div>
                <Chips<PivotId>
                  label={t('arr.pivot')}
                  value={pivot}
                  onChange={setPivot}
                  options={[
                    { value: 'own', label: shapes.length === 1 ? t('arr.ownCentre') : t('arr.selCentre') },
                    { value: 'yantra', label: t('arr.yantraCentre') },
                    ...(one ? shapeCorners(one).map((_, i) => ({ value: `corner:${i}` as PivotId, label: t(cornerNames[i]) })) : []),
                  ]}
                />
              </Block>
            </>
          )}
          {mode === 'mirror' && (
            <>
              <Block>
                <Segmented<'lr' | 'tb'> label={t('arr.axis')} value={axis} onChange={setAxis} options={[{ value: 'lr', label: t('arr.lr') }, { value: 'tb', label: t('arr.tb') }]} />
              </Block>
              <Block>
                <Segmented<'yantra' | 'own'>
                  label={t('arr.pivot')}
                  value={mirrorAbout}
                  onChange={setMirrorAbout}
                  options={[{ value: 'yantra', label: t('arr.yantraAxis') }, { value: 'own', label: t('arr.ownAxis') }]}
                />
              </Block>
            </>
          )}
          {mode === 'row' && (
            <>
              <Row label={t('arr.dx')}>
                <NumberField label={t('arr.dx')} value={dxMm} min={-2000} max={2000} digits={2} suffix="mm" onChange={setDxMm} />
              </Row>
              <Row label={t('arr.dy')}>
                <NumberField label={t('arr.dy')} value={dyMm} min={-2000} max={2000} digits={2} suffix="mm" onChange={setDyMm} />
              </Row>
              {one && (
                <div className="band-actions">
                  <button type="button" className="pill-btn" onClick={() => { setDxMm(+(one.w * unitMm).toFixed(3)); setDyMm(0); }}>{t('arr.byWidth')}</button>
                  <button type="button" className="pill-btn" onClick={() => { setDxMm(+((one.w / 2) * unitMm).toFixed(3)); setDyMm(0); }}>{t('arr.byHalf')}</button>
                  <button type="button" className="pill-btn" onClick={() => { setDxMm(0); setDyMm(+(-one.h * unitMm).toFixed(3)); }}>{t('arr.byHeight')}</button>
                </div>
              )}
            </>
          )}
          {mode === 'nest' && (
            <>
              <Row label={t('arr.ratio')}>
                <NumberField label={t('arr.ratio')} value={ratio} min={5} max={300} digits={1} suffix="%" onChange={setRatio} />
              </Row>
              <Block>
                <div className="row-label">{t('arr.pivot')}</div>
                <Chips<PivotId>
                  label={t('arr.pivot')}
                  value={pivot}
                  onChange={setPivot}
                  options={[
                    { value: 'own', label: shapes.length === 1 ? t('arr.ownCentre') : t('arr.selCentre') },
                    { value: 'yantra', label: t('arr.yantraCentre') },
                    ...(one ? shapeCorners(one).map((_, i) => ({ value: `corner:${i}` as PivotId, label: t(cornerNames[i]) })) : []),
                  ]}
                />
              </Block>
            </>
          )}
        </Group>
      </div>
    </Sheet>
  );
}

