import { flattenPath } from '../core/path';
import { weldContours } from './weld';
import { buildItems, computePlacement } from './layout';
import type { Item } from './layout';
import type { ExportOptions, Scene } from './types';

export const DXF_TOLERANCE_MM = 0.01;

export function dxfLayerName(layer: string): string {
  const n = layer.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return n || 'LAYER';
}

const KNOWN: Record<string, number> = { TRIANGLES: 7, CELLS: 3, BINDU: 1, GUIDES: 8, TEXT: 5 };
const CYCLE = [2, 4, 6, 30, 140, 190, 210, 94, 40, 150];

const f = (v: number) => v.toFixed(6);

export function sceneToDxf(scene: Scene, opts: ExportOptions): string {
  // DXF is line-work only: behave as lineOnly regardless of the option.
  const o: ExportOptions = { ...opts, lineOnly: true, background: false };
  const pl = computePlacement(scene, o);
  const items = buildItems(scene, o, pl);
  const H = pl.pageH;
  const yy = (y: number) => H - y;

  const layerOf = (it: Item) => (it.kind === 'text' || it.layer === 'text' ? 'TEXT' : dxfLayerName(it.layer));
  const body: string[] = [];
  const layers = new Map<string, number>();
  let cycle = 0;
  const useLayer = (name: string) => {
    if (!layers.has(name)) layers.set(name, KNOWN[name] ?? CYCLE[cycle++ % CYCLE.length]);
    return name;
  };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const push = (code: number, v: string | number) => body.push(String(code), String(v));

  for (const it of items) {
    if (it.kind === 'text') continue; // native text fallback is not exported
    const layer = useLayer(layerOf(it));
    if (it.kind === 'circle') {
      push(0, 'CIRCLE'); push(8, layer);
      push(10, f(it.cx)); push(20, f(yy(it.cy))); push(30, f(0)); push(40, f(it.r));
      grow(it.cx - it.r, yy(it.cy) - it.r);
      grow(it.cx + it.r, yy(it.cy) + it.r);
      continue;
    }
    let subs = flattenPath(it.d, DXF_TOLERANCE_MM);
    // Filled, unstroked paths are lettering: weld overlapping glyphs into clean outlines.
    if (it.fill && !it.stroke) {
      const closedPts = subs.filter((s) => s.closed).map((s) => {
        const a = s.pts[0], b = s.pts[s.pts.length - 1];
        return s.pts.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-9 ? s.pts.slice(0, -1) : s.pts;
      });
      subs = weldContours(closedPts).map((pts) => ({ pts, closed: true }));
    }
    for (const sp of subs) {
      let pts = sp.pts;
      if (sp.closed && pts.length > 1) {
        const a = pts[0], b = pts[pts.length - 1];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) pts = pts.slice(0, -1);
      }
      if (pts.length < 2) continue;
      push(0, 'POLYLINE'); push(8, layer); push(66, 1);
      push(10, f(0)); push(20, f(0)); push(30, f(0)); push(70, sp.closed ? 1 : 0);
      for (const p of pts) {
        push(0, 'VERTEX'); push(8, layer);
        push(10, f(p.x)); push(20, f(yy(p.y))); push(30, f(0));
        grow(p.x, yy(p.y));
      }
      push(0, 'SEQEND'); push(8, layer);
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = pl.pageW; maxY = H; }
  if (layers.size === 0) layers.set('0', 7);

  const head: string[] = [];
  const h = (code: number, v: string | number) => head.push(String(code), String(v));
  h(0, 'SECTION'); h(2, 'HEADER');
  h(9, '$ACADVER'); h(1, 'AC1009');
  h(9, '$INSUNITS'); h(70, 4);
  h(9, '$EXTMIN'); h(10, f(minX)); h(20, f(minY)); h(30, f(0));
  h(9, '$EXTMAX'); h(10, f(maxX)); h(20, f(maxY)); h(30, f(0));
  h(0, 'ENDSEC');
  h(0, 'SECTION'); h(2, 'TABLES');
  h(0, 'TABLE'); h(2, 'LTYPE'); h(70, 1);
  h(0, 'LTYPE'); h(2, 'CONTINUOUS'); h(70, 0); h(3, 'Solid line'); h(72, 65); h(73, 0); h(40, f(0));
  h(0, 'ENDTAB');
  h(0, 'TABLE'); h(2, 'LAYER'); h(70, layers.size);
  for (const [name, aci] of layers) { h(0, 'LAYER'); h(2, name); h(70, 0); h(62, aci); h(6, 'CONTINUOUS'); }
  h(0, 'ENDTAB');
  h(0, 'ENDSEC');
  h(0, 'SECTION'); h(2, 'ENTITIES');
  const tail = ['0', 'ENDSEC', '0', 'EOF'];
  return [...head, ...body, ...tail].join('\n');
}
