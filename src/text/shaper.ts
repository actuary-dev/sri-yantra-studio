/** HarfBuzz-based Devanagari shaping to vector outlines. */
import type { FontId, PathCmd } from '../core/types';
import type { ShapedText, Shaper } from './types';

export const FONT_FILES: Record<FontId, { label: string; file: string }> = {
  tiro: { label: 'Tiro Devanagari Sanskrit', file: 'fonts/TiroDevanagariSanskrit-Regular.ttf' },
  'noto-sans': { label: 'Noto Sans Devanagari', file: 'fonts/NotoSansDevanagari-Regular.ttf' },
  'noto-serif': { label: 'Noto Serif Devanagari', file: 'fonts/NotoSerifDevanagari-Regular.ttf' },
};

const FONT_IDS = Object.keys(FONT_FILES) as FontId[];

/** Parse an SVG path string (as produced by hb glyphToPath) to PathCmd tuples. Handles M L H V Q C Z (abs + rel). */
export function parseSvgPath(d: string, sx: number, sy: number): PathCmd[] {
  const out: PathCmd[] = [];
  const re = /([MmLlHhVvQqCcZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  const toks: (string | number)[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) toks.push(m[1] ?? parseFloat(m[2]));
  let i = 0, cmd = '', cx = 0, cy = 0, sxp = 0, syp = 0;
  const num = () => toks[i++] as number;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++] as string;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    switch (cmd.toUpperCase()) {
      case 'M': { cx = ox + num(); cy = oy + num(); sxp = cx; syp = cy; out.push(['M', X(cx), Y(cy)]); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { cx = ox + num(); cy = oy + num(); out.push(['L', X(cx), Y(cy)]); break; }
      case 'H': { cx = ox + num(); out.push(['L', X(cx), Y(cy)]); break; }
      case 'V': { cy = oy + num(); out.push(['L', X(cx), Y(cy)]); break; }
      case 'Q': {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num();
        out.push(['Q', X(x1), Y(y1), X(x2), Y(y2)]); cx = x2; cy = y2; break;
      }
      case 'C': {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
        out.push(['C', X(x1), Y(y1), X(x2), Y(y2), X(x3), Y(y3)]); cx = x3; cy = y3; break;
      }
      case 'Z': { out.push(['Z']); cx = sxp; cy = syp; break; }
      default: i++; // unknown token: skip
    }
  }
  return out;
}

function translate(p: PathCmd[], dx: number, dy: number): PathCmd[] {
  return p.map((k) => {
    switch (k[0]) {
      case 'M': case 'L': return [k[0], k[1] + dx, k[2] + dy] as PathCmd;
      case 'Q': return ['Q', k[1] + dx, k[2] + dy, k[3] + dx, k[4] + dy] as PathCmd;
      case 'C': return ['C', k[1] + dx, k[2] + dy, k[3] + dx, k[4] + dy, k[5] + dx, k[6] + dy] as PathCmd;
      default: return ['Z'] as PathCmd;
    }
  });
}

/** y-extent of a path's control points (good enough for ink top/bottom of font outlines). */
function yExtent(p: PathCmd[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const k of p) for (let i = 2; i < k.length; i += 2) { const y = k[i] as number; if (y < lo) lo = y; if (y > hi) hi = y; }
  return [lo, hi];
}

interface LoadedFont {
  font: import('harfbuzzjs').Font;
  upem: number;
}

async function buildShaper(loadBytes: (file: string) => Promise<ArrayBuffer | Uint8Array>): Promise<Shaper> {
  // Importing the package initialises the wasm module (top-level await inside harfbuzzjs).
  const hb = await import('harfbuzzjs');
  const fonts = new Map<FontId, LoadedFont>();
  for (const id of FONT_IDS) {
    const bytes = await loadBytes(FONT_FILES[id].file);
    const blob = new hb.Blob(bytes);
    const face = new hb.Face(blob);
    fonts.set(id, { font: new hb.Font(face), upem: face.upem });
  }
  const cache = new Map<string, ShapedText>();
  const glyphCache = new Map<string, PathCmd[]>();

  function shape(text: string, id: FontId): ShapedText {
    const key = id + '\u0000' + text;
    const hit = cache.get(key);
    if (hit) return hit;
    const lf = fonts.get(id) ?? fonts.get('tiro')!;
    const { font, upem } = lf;
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    buf.setDirection(hb.Direction.LTR);
    hb.shape(font, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();

    const path: PathCmd[] = [];
    const groups: { cluster: number; start: number; adv: number; path: PathCmd[] }[] = [];
    const byCluster = new Map<number, (typeof groups)[number]>();
    let pen = 0;
    for (let i = 0; i < infos.length; i++) {
      const gid = infos[i].codepoint;
      const gk = id + ':' + gid;
      let g = glyphCache.get(gk);
      if (!g) {
        g = parseSvgPath(font.glyphToPath(gid), 1 / upem, -1 / upem);
        glyphCache.set(gk, g);
      }
      const p = pos[i];
      const gx = pen + p.xOffset / upem;
      const gy = -p.yOffset / upem;
      const placed = g.length ? translate(g, gx, gy) : [];
      path.push(...placed);
      let grp = byCluster.get(infos[i].cluster);
      if (!grp) {
        grp = { cluster: infos[i].cluster, start: pen, adv: 0, path: [] };
        byCluster.set(infos[i].cluster, grp);
        groups.push(grp);
      }
      grp.start = Math.min(grp.start, pen);
      grp.path.push(...placed);
      grp.adv += p.xAdvance / upem;
      pen += p.xAdvance / upem;
    }
    groups.sort((a, b) => a.cluster - b.cluster);
    const clusters = groups.map((g) => ({ path: translate(g.path, -g.start, 0), x: g.start, width: g.adv }));
    const [top, bottom] = path.length ? yExtent(path) : [0, 0];
    const res: ShapedText = { path, width: pen, top, bottom, clusters };
    cache.set(key, res);
    return res;
  }
  return { shape };
}

let browserPromise: Promise<Shaper> | null = null;
let nodePromise: Promise<Shaper> | null = null;

/** Node loader (vitest, scripts): reads the TTFs from <cwd = project root>/public/ with node:fs. */
export function loadShaperNode(): Promise<Shaper> {
  if (!nodePromise) {
    nodePromise = (async () => {
      // Module names are variables so neither tsc (no @types/node) nor Vite tries to resolve/bundle them.
      const fsName = 'node:fs/promises', urlName = 'node:url';
      const fs = (await import(/* @vite-ignore */ fsName)) as { readFile(p: string): Promise<Uint8Array> };
      const nodeUrl = (await import(/* @vite-ignore */ urlName)) as { pathToFileURL(p: string): URL; fileURLToPath(u: URL): string };
      const proc = (globalThis as unknown as { process: { cwd(): string } }).process;
      const root = nodeUrl.pathToFileURL(proc.cwd() + '/');
      return buildShaper(async (file) => {
        return fs.readFile(nodeUrl.fileURLToPath(new URL('public/' + file, root)));
      });
    })();
    nodePromise.catch(() => { nodePromise = null; });
  }
  return nodePromise;
}

/** Browser loader (delegates to the Node loader when `window` is undefined). */
export function loadShaper(): Promise<Shaper> {
  if (typeof window === 'undefined') return loadShaperNode();
  if (!browserPromise) {
    browserPromise = buildShaper(async (file) => {
      const res = await fetch(new URL(file, document.baseURI));
      if (!res.ok) throw new Error(`Cannot load font ${file}: ${res.status}`);
      return res.arrayBuffer();
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}
