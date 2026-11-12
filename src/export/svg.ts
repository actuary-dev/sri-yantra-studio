import { pathToD } from '../core/path';
import { buildItems, computePlacement, yantraWidthMm } from './layout';
import type { Item } from './layout';
import type { ExportOptions, Scene } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number) => {
  const s = v.toFixed(4);
  return s.includes('.') ? s.replace(/\.?0+$/, '') || '0' : s;
};
const idOf = (layer: string) => 'layer-' + layer.replace(/[^A-Za-z0-9_-]+/g, '-');
const FONT = "'Tiro Devanagari Sanskrit','Noto Sans Devanagari',serif";

function paintAttrs(it: Extract<Item, { kind: 'path' | 'circle' }>): string {
  let a = ` fill="${it.fill ?? 'none'}"`;
  if (it.stroke) {
    a += ` stroke="${it.stroke}" stroke-width="${num(it.strokeMm)}"`;
    a += it.miter ? ' stroke-linejoin="miter" stroke-miterlimit="10"' : ' stroke-linejoin="round" stroke-linecap="round"';
  }
  return a;
}

export function sceneToSvg(scene: Scene, opts: ExportOptions): string {
  const pl = computePlacement(scene, opts);
  const items = buildItems(scene, opts, pl);
  const W = num(pl.pageW), H = num(pl.pageH);
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(`<!-- Sri Yantra Studio. Page ${W} x ${H} mm; yantra width ${num(yantraWidthMm(scene, pl))} mm; 1 user unit = 1 mm. -->`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`);
  out.push(`<title>Sri Yantra ${num(yantraWidthMm(scene, pl))} mm</title>`);
  if (opts.background && !opts.lineOnly) {
    out.push(`<rect id="background" x="0" y="0" width="${W}" height="${H}" fill="${esc(scene.paper)}"/>`);
  }
  let open: string | null = null;
  for (const it of items) {
    if (it.layer !== open) {
      if (open !== null) out.push('</g>');
      out.push(`<g id="${idOf(it.layer)}">`);
      open = it.layer;
    }
    if (it.kind === 'path') {
      out.push(`<path d="${pathToD(it.d, 4)}"${paintAttrs(it)}${it.evenodd ? ' fill-rule="evenodd"' : ''}/>`);
    } else if (it.kind === 'circle') {
      out.push(`<circle cx="${num(it.cx)}" cy="${num(it.cy)}" r="${num(it.r)}"${paintAttrs(it)}/>`);
    } else {
      const tr = `translate(${num(it.x)} ${num(it.y)}) rotate(${num(it.angle)})${it.mirror ? ' scale(-1 1)' : ''}`;
      out.push(`<text transform="${tr}" font-size="${num(it.size)}" font-family="${FONT}" text-anchor="middle" dominant-baseline="central" fill="${esc(it.fill)}">${esc(it.text)}</text>`);
    }
  }
  if (open !== null) out.push('</g>');
  out.push('</svg>');
  return out.join('\n') + '\n';
}
