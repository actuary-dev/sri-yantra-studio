/**
 * Pure SVG renderer of a Scene. Used for the editor canvas and the gallery
 * thumbnails. Prims are grouped into consecutive same-layer segments; each
 * segment is memoised on a cheap content hash, so a geometry change only
 * re-renders the triangles and a band change only that band.
 */
import { memo, useMemo, type ReactNode } from 'react';
import type { FontId, Paint, Prim, Scene, TextPrim } from '../core/types';
import { pathToD } from '../core/path';

export const FONT_CSS: Record<FontId, string> = {
  tiro: "'Tiro Devanagari Sanskrit', 'Noto Serif Devanagari', serif",
  'noto-sans': "'Noto Sans Devanagari', sans-serif",
  'noto-serif': "'Noto Serif Devanagari', serif",
};

export interface YantraViewProps {
  scene: Scene;
  /** custom viewBox (the canvas passes its pan/zoom); default = whole drawing with 3 % margin */
  viewBox?: string;
  width?: number | string;
  height?: number | string;
  /** strokes are never drawn thinner than this many scene units (≈ 0.6 CSS px) */
  minStrokeUnits?: number;
  showText?: boolean;
  showGuides?: boolean;
  /** overlay drawn in scene coordinates on top of the drawing */
  children?: ReactNode;
  className?: string;
  /** accessible name; when absent the svg is decorative */
  title?: string;
}

/* ---------------------------------------------------------------- hashing */

function hashSegment(prims: Prim[]): string {
  let h1 = 0x811c9dc5 | 0;
  let h2 = 7;
  const num = (v: number) => {
    const q = Math.round(v * 1e7) | 0;
    h1 = Math.imul(h1 ^ q, 16777619);
    h2 = (Math.imul(h2, 31) + q) | 0;
  };
  const str = (s: string | null | undefined) => {
    if (s == null) {
      num(-1.2345);
      return;
    }
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
      h2 = (Math.imul(h2, 31) + s.charCodeAt(i)) | 0;
    }
    num(s.length);
  };
  const paint = (p: Paint) => {
    str(p.stroke);
    num(p.strokeMm);
    str(p.fill);
  };
  for (const p of prims) {
    str(p.kind);
    if (p.kind === 'path') {
      paint(p.paint);
      for (const c of p.d) {
        str(c[0]);
        for (let i = 1; i < c.length; i++) num(c[i] as number);
      }
    } else if (p.kind === 'circle') {
      paint(p.paint);
      num(p.cx);
      num(p.cy);
      num(p.r);
    } else {
      str(p.text);
      str(p.fill);
      str(p.font);
      num(p.x);
      num(p.y);
      num(p.size);
      num(p.angle);
      if (p.arc) {
        num(p.arc.r);
        num(p.arc.centerDeg);
      }
      if (p.outline) {
        num(p.outline.length);
        for (const c of p.outline) for (let i = 1; i < c.length; i++) num(c[i] as number);
      }
    }
  }
  return `${prims.length}:${h1 >>> 0}:${h2 >>> 0}`;
}

/* -------------------------------------------------------------- elements */

const PRECISE = new Set(['triangles', 'cells', 'bindu', 'guides']);

function paintProps(paint: Paint, layer: string, unitMm: number, minSw: number) {
  const miter = layer === 'triangles' || layer === 'cells';
  return {
    fill: paint.fill ?? 'none',
    stroke: paint.stroke ?? 'none',
    strokeWidth: paint.stroke ? Math.max(paint.strokeMm / unitMm, minSw) : undefined,
    strokeLinejoin: miter ? ('miter' as const) : ('round' as const),
    strokeLinecap: miter ? ('butt' as const) : ('round' as const),
    strokeMiterlimit: miter ? 12 : undefined,
  };
}

function textEl(p: TextPrim, key: string) {
  if (p.outline) {
    return <path key={key} d={pathToD(p.outline, 5)} fill={p.fill} fillRule="nonzero" />;
  }
  if (p.arc) return null; // text on a circle needs the shaper
  // Draw at font-size 100 and scale down: tiny font sizes render badly in some browsers.
  const k = p.size / 100;
  return (
    <text
      key={key}
      transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${k})`}
      fontSize={100}
      fontFamily={FONT_CSS[p.font] ?? FONT_CSS.tiro}
      fill={p.fill}
      textAnchor="middle"
      dominantBaseline="central"
      lang="sa"
    >
      {p.text}
    </text>
  );
}

function primEl(p: Prim, key: string, unitMm: number, minSw: number) {
  switch (p.kind) {
    case 'path':
      return <path key={key} d={pathToD(p.d, PRECISE.has(p.layer) ? 6 : 5)} {...paintProps(p.paint, p.layer, unitMm, minSw)} />;
    case 'circle':
      return <circle key={key} cx={p.cx} cy={p.cy} r={p.r} {...paintProps(p.paint, p.layer, unitMm, minSw)} />;
    case 'text':
      return textEl(p, key);
  }
}

interface SegmentProps {
  prims: Prim[];
  sig: string;
  unitMm: number;
  minSw: number;
}

const Segment = memo(
  function Segment({ prims, unitMm, minSw }: SegmentProps) {
    return <>{prims.map((p, i) => primEl(p, String(i), unitMm, minSw))}</>;
  },
  (a, b) => a.sig === b.sig && a.unitMm === b.unitMm && a.minSw === b.minSw,
);

interface Seg {
  key: string;
  prims: Prim[];
  sig: string;
}

/** Split into consecutive runs of the same layer (keeps painting order). */
function segments(prims: Prim[], showText: boolean, showGuides: boolean): Seg[] {
  const out: Seg[] = [];
  const counts = new Map<string, number>();
  let cur: Prim[] = [];
  let layer = '';
  const flush = () => {
    if (!cur.length) return;
    const n = counts.get(layer) ?? 0;
    counts.set(layer, n + 1);
    out.push({ key: `${layer}#${n}`, prims: cur, sig: hashSegment(cur) });
    cur = [];
  };
  for (const p of prims) {
    if (!showText && p.kind === 'text') continue;
    if (!showGuides && p.layer === 'guides') continue;
    const l = p.kind === 'text' ? `${p.layer}/text` : p.layer;
    if (l !== layer) {
      flush();
      layer = l;
    }
    cur.push(p);
  }
  flush();
  return out;
}

function YantraViewImpl({
  scene,
  viewBox,
  width = '100%',
  height = '100%',
  minStrokeUnits = 0,
  showText = true,
  showGuides = true,
  children,
  className,
  title,
}: YantraViewProps) {
  const e = scene.extent * 1.03;
  const vb = viewBox ?? `${-e} ${-e} ${2 * e} ${2 * e}`;
  const segs = useMemo(() => segments(scene.prims, showText, showGuides), [scene, showText, showGuides]);
  return (
    <svg
      className={className}
      viewBox={vb}
      width={width}
      height={height}
      preserveAspectRatio={viewBox ? 'none' : 'xMidYMid meet'}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x={-e} y={-e} width={2 * e} height={2 * e} fill={scene.paper} />
      {segs.map((s) => (
        <Segment key={s.key} prims={s.prims} sig={s.sig} unitMm={scene.unitMm} minSw={minStrokeUnits} />
      ))}
      {children}
    </svg>
  );
}

export const YantraView = memo(YantraViewImpl);
