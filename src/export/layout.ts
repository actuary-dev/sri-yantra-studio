import type { PathCmd, Prim, Scene } from '../core/types';
import { circlePath } from '../core/path';
import type { ExportOptions, Placement } from './types';

export const HAIRLINE_MM = 0.05;

export function computePlacement(scene: Scene, opts: ExportOptions): Placement {
  const side = 2 * scene.extent;
  if (!opts.page) {
    const s = side * scene.unitMm + 2 * opts.marginMm;
    return { pageW: s, pageH: s, scale: scene.unitMm, cx: s / 2, cy: s / 2 };
  }
  const { widthMm: pageW, heightMm: pageH } = opts.page;
  const scale = opts.fitToPage
    ? Math.max(0, Math.min(pageW, pageH) - 2 * opts.marginMm) / side
    : scene.unitMm;
  return { pageW, pageH, scale, cx: pageW / 2, cy: pageH / 2 };
}

const sameColour = (a: string | null, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Prims that survive the include/lineOnly options, in painting order. */
export function filteredPrims(scene: Scene, opts: ExportOptions): Prim[] {
  return scene.prims.filter((p) => {
    if (p.kind === 'text') return opts.includeText;
    if (p.layer === 'text' && !opts.includeText) return false;
    if (p.layer === 'guides' && !opts.includeGuides) return false;
    if (opts.lineOnly) {
      const hasStroke = !!p.paint.stroke && p.paint.strokeMm > 0;
      if (!hasStroke && !sameColour(p.paint.fill, scene.ink)) return false;
    }
    return true;
  });
}

export interface StyleBits {
  stroke: string | null;
  strokeMm: number;
  fill: string | null;
}

export type Item =
  | ({ kind: 'path'; layer: string; d: PathCmd[]; evenodd: boolean; miter: boolean } & StyleBits)
  | ({ kind: 'circle'; layer: string; cx: number; cy: number; r: number; miter: boolean } & StyleBits)
  | { kind: 'text'; layer: string; text: string; x: number; y: number; size: number; angle: number; fill: string; mirror: boolean };

const BLACK = '#000000';

/** Convert prims to millimetre page coordinates (y down, mirror applied), with final colours and stroke widths. */
export function buildItems(scene: Scene, opts: ExportOptions, pl: Placement = computePlacement(scene, opts)): Item[] {
  const k = pl.scale;
  const X = (x: number) => (opts.mirror ? pl.pageW - (pl.cx + x * k) : pl.cx + x * k);
  const Y = (y: number) => pl.cy + y * k;
  const mapPath = (d: PathCmd[]): PathCmd[] =>
    d.map((c): PathCmd => {
      switch (c[0]) {
        case 'M': case 'L': return [c[0], X(c[1]), Y(c[2])];
        case 'Q': return ['Q', X(c[1]), Y(c[2]), X(c[3]), Y(c[4])];
        case 'C': return ['C', X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6])];
        default: return ['Z'];
      }
    });
  const widthMm = (mm: number) => (opts.hairline ? HAIRLINE_MM : (mm * k) / scene.unitMm);
  const col = (c: string | null) => (c && opts.lineOnly ? BLACK : c);
  const out: Item[] = [];
  for (const p of filteredPrims(scene, opts)) {
    if (p.kind === 'text') {
      if (p.outline && p.outline.length) {
        // Non-zero winding, as TrueType intends: adjoining Devanagari glyphs overlap (headline joins,
        // matras), and even-odd would punch holes where they overlap. Counters are wound opposite,
        // so they stay open under non-zero too.
        out.push({ kind: 'path', layer: p.layer, d: mapPath(p.outline), evenodd: false, miter: false,
          stroke: null, strokeMm: 0, fill: opts.lineOnly ? BLACK : p.fill });
      } else if (!p.arc) {
        // native-text fallback only for straight text; text on a circle cannot be drawn without outlines
        out.push({ kind: 'text', layer: p.layer, text: p.text, x: X(p.x), y: Y(p.y), size: p.size * k,
          angle: opts.mirror ? -p.angle : p.angle, fill: opts.lineOnly ? BLACK : p.fill, mirror: opts.mirror });
      }
      continue;
    }
    const hasStroke = !!p.paint.stroke && p.paint.strokeMm > 0;
    const st: StyleBits = {
      stroke: hasStroke ? col(p.paint.stroke) : null,
      strokeMm: hasStroke ? widthMm(p.paint.strokeMm) : 0,
      fill: col(p.paint.fill),
    };
    const miter = p.layer === 'triangles' || p.layer === 'cells' || p.layer.startsWith('fig:');
    if (p.kind === 'path') out.push({ kind: 'path', layer: p.layer, d: mapPath(p.d), evenodd: false, miter, ...st });
    else out.push({ kind: 'circle', layer: p.layer, cx: X(p.cx), cy: Y(p.cy), r: p.r * k, miter, ...st });
  }
  return out;
}

export function circleAsPath(cx: number, cy: number, r: number): PathCmd[] {
  return circlePath(cx, cy, r);
}

export function yantraWidthMm(scene: Scene, pl: Placement): number {
  return 2 * scene.extent * pl.scale;
}
