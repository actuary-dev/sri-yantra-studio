/**
 * The editor canvas: pinch-zoom / pan with pointer events, wheel zoom and drag
 * on desktop, double-tap to fit. During a gesture the SVG is moved with a CSS
 * transform (GPU, smooth); when the gesture settles the view is committed into
 * the SVG viewBox so it is redrawn crisp at the new zoom.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Scene } from '../core/types';
import { YantraView } from './YantraView';
import { useT } from './i18n';
import { Icon } from './components/Icon';

interface View {
  /** CSS px per scene unit */
  s: number;
  /** screen position of the scene origin */
  tx: number;
  ty: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CanvasProps {
  scene: Scene;
  insets: Insets;
  showText?: boolean;
  /** drawn in scene coordinates; receives the current pixels per scene unit */
  overlay?: (pxPerUnit: number) => ReactNode;
  /** a tap without movement, in scene coordinates */
  onTap?(x: number, y: number, pxPerUnit: number): void;
  /** return true to start dragging an object at this point instead of panning */
  dragTest?(x: number, y: number, pxPerUnit: number): boolean;
  onDrag?(x: number, y: number): void;
  onDragEnd?(): void;
  /** changing this re-fits the drawing (e.g. a different design was opened) */
  resetKey?: string;
  /** extra floating controls placed next to the zoom button */
  extraControls?: ReactNode;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 40;
const TAP_SLOP = 8;

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** quantise to steps of √2 so strokes re-render rarely */
const quantise = (v: number) => Math.pow(2, Math.round(Math.log2(v) * 2) / 2);

interface Gesture {
  mode: 'none' | 'pan' | 'pinch' | 'drag';
  start: View;
  p0: { x: number; y: number };
  d0: number;
  m0: { x: number; y: number };
  t0: number;
  moved: boolean;
}

export function Canvas({ scene, insets, showText = true, overlay, onTap, dragTest, onDrag, onDragEnd, resetKey, extraControls }: CanvasProps) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const live = useRef<View | null>(null);
  const committed = useRef<View | null>(null);
  const userMoved = useRef(false);
  const raf = useRef(0);
  const anim = useRef(0);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const extent = scene.extent;

  // callbacks in refs so the native listeners never go stale
  const cb = useRef({ onTap, dragTest, onDrag, onDragEnd });
  cb.current = { onTap, dragTest, onDrag, onDragEnd };

  /* ----------------------------------------------------------- size */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { top, right, bottom, left } = insets;
  const fitView = useCallback((): View | null => {
    if (!size.w || !size.h) return null;
    const x0 = left, x1 = Math.max(left + 80, size.w - right);
    const y0 = top, y1 = Math.max(top + 80, size.h - bottom);
    const s = Math.min(x1 - x0, y1 - y0) / (2 * extent * 1.06);
    return { s, tx: (x0 + x1) / 2, ty: (y0 + y1) / 2 };
  }, [size.w, size.h, top, right, bottom, left, extent]);

  /* ---------------------------------------------------- view helpers */
  const apply = useCallback(() => {
    const c = committed.current, l = live.current, st = stageRef.current;
    if (!c || !l || !st) return;
    const k = l.s / c.s;
    st.style.transform = k === 1 && l.tx === c.tx && l.ty === c.ty ? '' : `translate(${l.tx - c.tx * k}px, ${l.ty - c.ty * k}px) scale(${k})`;
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      apply();
    });
  }, [apply]);

  const commit = useCallback((v: View) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    live.current = v;
    committed.current = v;
    setView(v);
  }, []);

  const commitSoon = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      if (live.current) commit(live.current);
    }, 140);
  }, [commit]);

  useLayoutEffect(() => {
    apply();
  }, [view, apply]);

  const animateTo = useCallback(
    (target: View) => {
      cancelAnimationFrame(anim.current);
      const from = live.current;
      if (!from || !committed.current || reducedMotion()) {
        commit(target);
        return;
      }
      const t0 = performance.now();
      const dur = 260;
      const step = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - u, 3);
        const ls = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e);
        live.current = { s: ls, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e };
        apply();
        if (u < 1) anim.current = requestAnimationFrame(step);
        else commit(target);
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply, commit],
  );

  const fit = useCallback(() => {
    const v = fitView();
    if (!v) return;
    userMoved.current = false;
    animateTo(v);
  }, [fitView, animateTo]);

  // first fit and re-fit on size / inset changes while the user has not zoomed
  useEffect(() => {
    const v = fitView();
    if (!v) return;
    if (!committed.current) commit(v);
    else if (!userMoved.current) animateTo(v);
  }, [fitView, commit, animateTo]);

  useEffect(() => {
    userMoved.current = false;
    const v = fitView();
    if (v && committed.current) commit(v);
  }, [resetKey]); // only when the key changes

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(anim.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );

  const clampView = useCallback(
    (v: View): View => {
      const f = fitView();
      if (!f) return v;
      const s = Math.min(f.s * MAX_ZOOM, Math.max(f.s * MIN_ZOOM, v.s));
      // never let the drawing slide completely out of view
      const half = extent * s;
      const margin = 60;
      const tx = Math.min(size.w + half - margin, Math.max(-half + margin, v.tx));
      const ty = Math.min(size.h + half - margin, Math.max(-half + margin, v.ty));
      return { s, tx, ty };
    },
    [fitView, extent, size.w, size.h],
  );

  const zoomAbout = useCallback(
    (px: number, py: number, factor: number, base?: View) => {
      const b = base ?? live.current;
      const f = fitView();
      if (!b || !f) return;
      const s = Math.min(f.s * MAX_ZOOM, Math.max(f.s * MIN_ZOOM, b.s * factor));
      const wx = (px - b.tx) / b.s, wy = (py - b.ty) / b.s;
      live.current = clampView({ s, tx: px - wx * s, ty: py - wy * s });
      userMoved.current = true;
    },
    [fitView, clampView],
  );

  /* -------------------------------------------------------- pointers */
  const localPt = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (p: { x: number; y: number }) => {
    const v = live.current!;
    return { x: (p.x - v.tx) / v.s, y: (p.y - v.ty) / v.s };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!live.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    wrapRef.current?.setPointerCapture(e.pointerId);
    const p = localPt(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) {
      const w = toWorld(p);
      const drag = cb.current.dragTest?.(w.x, w.y, live.current.s) ?? false;
      gesture.current = { mode: drag ? 'drag' : 'pan', start: { ...live.current }, p0: p, d0: 0, m0: p, t0: performance.now(), moved: false };
    } else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      if (gesture.current?.mode === 'drag') cb.current.onDragEnd?.();
      gesture.current = {
        mode: 'pinch',
        start: { ...live.current },
        p0: p,
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        t0: performance.now(),
        moved: true,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pts.current.has(e.pointerId)) return;
    const p = localPt(e);
    pts.current.set(e.pointerId, p);
    if (g.mode === 'pan' || g.mode === 'drag') {
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
      if (!g.moved) return;
      if (g.mode === 'drag') {
        const w = toWorld(p);
        cb.current.onDrag?.(w.x, w.y);
      } else {
        live.current = clampView({ s: g.start.s, tx: g.start.tx + dx, ty: g.start.ty + dy });
        userMoved.current = true;
        schedule();
      }
    } else if (g.mode === 'pinch' && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const f = fitView();
      if (!f) return;
      const s = Math.min(f.s * MAX_ZOOM, Math.max(f.s * MIN_ZOOM, (g.start.s * d) / g.d0));
      const wx = (g.m0.x - g.start.tx) / g.start.s, wy = (g.m0.y - g.start.ty) / g.start.s;
      live.current = clampView({ s, tx: m.x - wx * s, ty: m.y - wy * s });
      userMoved.current = true;
      schedule();
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!pts.current.has(e.pointerId)) return;
    const p = localPt(e);
    pts.current.delete(e.pointerId);
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pts.current.size === 1) {
        const [rest] = [...pts.current.values()];
        gesture.current = { ...g, mode: 'pan', start: { ...live.current! }, p0: rest, moved: true };
      } else if (pts.current.size === 0) {
        gesture.current = null;
        commitSoon();
      }
      return;
    }
    if (pts.current.size > 0) return;
    gesture.current = null;
    if (g.mode === 'drag' && g.moved) {
      cb.current.onDragEnd?.();
      return;
    }
    if (g.moved) {
      commitSoon();
      return;
    }
    if (cancelled || performance.now() - g.t0 > 600) return;
    // a tap
    const now = performance.now();
    const lt = lastTap.current;
    if (lt && now - lt.t < 320 && Math.hypot(lt.x - p.x, lt.y - p.y) < 30) {
      lastTap.current = null;
      fit();
      return;
    }
    lastTap.current = { t: now, x: p.x, y: p.y };
    const w = toWorld(p);
    cb.current.onTap?.(w.x, w.y, live.current!.s);
  };

  // wheel zoom needs a non-passive listener
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!live.current) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAbout(e.clientX - r.left, e.clientY - r.top, factor);
      schedule();
      commitSoon();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAbout, schedule, commitSoon]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = live.current;
    if (!v) return;
    const cx = size.w / 2, cy = size.h / 2;
    let handled = true;
    if (e.key === '+' || e.key === '=') zoomAbout(cx, cy, 1.25);
    else if (e.key === '-' || e.key === '_') zoomAbout(cx, cy, 0.8);
    else if (e.key === '0') {
      fit();
      return;
    } else if (e.key.startsWith('Arrow')) {
      const d = 40;
      const dx = e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0;
      const dy = e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0;
      live.current = clampView({ ...v, tx: v.tx + dx, ty: v.ty + dy });
      userMoved.current = true;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      if (live.current) commit(live.current);
    }
  };

  const f = fitView();
  const zoomPct = view && f ? Math.round((view.s / f.s) * 100) : 100;
  const vb = view ? `${-view.tx / view.s} ${-view.ty / view.s} ${size.w / view.s} ${size.h / view.s}` : undefined;
  const minSw = view ? quantise(0.6 / view.s) : 0;

  return (
    <div className="canvas-wrap">
      <div
        ref={wrapRef}
        className="canvas"
        tabIndex={0}
        role="application"
        aria-label={t('canvas.label')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onKeyDown={onKeyDown}
      >
        <div ref={stageRef} className="canvas-stage">
          {view && vb && (
            <YantraView scene={scene} viewBox={vb} width={size.w} height={size.h} minStrokeUnits={minSw} showText={showText}>
              {overlay?.(view.s)}
            </YantraView>
          )}
        </div>
      </div>
      <div className="canvas-controls" style={{ bottom: bottom + 12, left: left + 12 }}>
        {extraControls}
        <button type="button" className="float-btn" onClick={fit} aria-label={t('canvas.fit')}>
          <Icon name="fit" size={20} />
          <span className="float-btn-text">{zoomPct === 100 ? t('canvas.fitShort') : `${zoomPct}%`}</span>
        </button>
      </div>
    </div>
  );
}
