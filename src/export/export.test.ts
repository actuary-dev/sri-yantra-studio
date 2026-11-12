import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Prim, Scene } from '../core/types';
import {
  DEFAULT_EXPORT, PAGE_SIZES, computePlacement, filteredPrims, pngPixelSize,
  sceneToDxf, sceneToPdf, sceneToSvg, exportScene, sanitiseFileName,
} from './index';
import type { ExportOptions } from './index';

const INK = '#112233';
const mk = (prims: Prim[], unitMm = 100): Scene => ({
  prims, extent: 1, unitMm, anchors: [], ink: INK, paper: '#f5f1e8',
  report: {} as Scene['report'],
});
const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({ ...DEFAULT_EXPORT, marginMm: 0, ...o });

const stroke = { stroke: INK, strokeMm: 0.4, fill: null };
const tri: Prim = { kind: 'path', layer: 'triangles', paint: stroke,
  d: [['M', 0, -0.5], ['L', 0.5, 0.5], ['L', -0.5, 0.5], ['Z']] };
const cell: Prim = { kind: 'path', layer: 'cells', paint: { stroke: null, strokeMm: 0, fill: '#ff0000' },
  d: [['M', 0, 0], ['L', 0.2, 0], ['L', 0.2, 0.2], ['Z']] };
const dot: Prim = { kind: 'circle', layer: 'bindu', cx: 0, cy: 0, r: 0.05, paint: { stroke: null, strokeMm: 0, fill: INK } };
const ring: Prim = { kind: 'circle', layer: 'band:L8', cx: 0, cy: 0, r: 1, paint: stroke };
const guide: Prim = { kind: 'path', layer: 'guides', paint: { stroke: '#888888', strokeMm: 0.1, fill: null }, d: [['M', -1, 0], ['L', 1, 0]] };
const glyph: Prim = { kind: 'text', layer: 'text', id: 't', text: 'ॐ', x: 0.3, y: 0, size: 0.1, angle: 0, font: 'tiro', fill: '#00aa00',
  outline: [['M', 0.3, 0], ['L', 0.4, 0], ['L', 0.4, 0.1], ['Z'], ['M', 0.32, 0.02], ['L', 0.35, 0.02], ['L', 0.35, 0.05], ['Z']] };
const loose: Prim = { kind: 'text', layer: 'text', id: 't2', text: 'abc', x: 0, y: 0.2, size: 0.1, angle: 10, font: 'tiro', fill: '#00aa00' };

describe('placement', () => {
  const sc = mk([]);
  it('page null: square with margins at unitMm', () => {
    const p = computePlacement(sc, opts({ page: null, marginMm: 10 }));
    expect(p).toEqual({ pageW: 220, pageH: 220, scale: 100, cx: 110, cy: 110 });
  });
  it('page + no fit keeps design size, centred', () => {
    const p = computePlacement(sc, opts({ page: { widthMm: 297, heightMm: 420 } }));
    expect(p.scale).toBe(100);
    expect(p.cx).toBe(148.5);
    expect(p.cy).toBe(210);
  });
  it('page + fit fills min side minus margins', () => {
    const p = computePlacement(sc, opts({ page: { widthMm: 297, heightMm: 420 }, fitToPage: true, marginMm: 10 }));
    expect(p.scale).toBeCloseTo((297 - 20) / 2, 9);
  });
});

describe('svg', () => {
  it('is well formed and in mm', () => {
    const svg = sceneToSvg(mk([tri, ring, dot]), opts());
    expect(svg).toContain('width="200mm"');
    expect(svg).toContain('viewBox="0 0 200 200"');
    expect(svg).toMatch(/<circle cx="100" cy="100" r="100"/);
    expect(svg).toContain('stroke-linejoin="miter" stroke-miterlimit="10"');
    const opens = (svg.match(/<(g|svg|title)[ >]/g) ?? []).length;
    const closes = (svg.match(/<\/(g|svg|title)>/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(svg).toContain('<title>');
  });
  it('groups by layer run', () => {
    const svg = sceneToSvg(mk([tri, ring, tri]), opts());
    expect((svg.match(/<g id=/g) ?? []).length).toBe(3);
  });
  it('scales stroke width with fitToPage', () => {
    const svg = sceneToSvg(mk([tri]), opts({ page: { widthMm: 100, heightMm: 100 }, fitToPage: true }));
    expect(svg).toContain('stroke-width="0.2"'); // 0.4 * 50/100
  });
  it('mirror flips x', () => {
    const p: Prim = { kind: 'circle', layer: 'x', cx: 0.5, cy: 0, r: 0.1, paint: stroke };
    expect(sceneToSvg(mk([p]), opts())).toContain('cx="150"');
    expect(sceneToSvg(mk([p]), opts({ mirror: true }))).toContain('cx="50"');
  });
  it('lineOnly drops non-ink fills, forces black, no background', () => {
    const svg = sceneToSvg(mk([cell, tri, dot, glyph]), opts({ lineOnly: true }));
    expect(svg).not.toContain('#ff0000');
    expect(svg).not.toContain(INK);
    expect(svg).not.toContain('id="background"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('<circle');
    // glyph outlines use the default non-zero rule (TrueType winding), so overlapping
    // Devanagari glyphs never punch holes in each other
    expect(svg).not.toContain('fill-rule="evenodd"');
    expect(svg).not.toContain('#00aa00');
  });
  it('background rect with paper colour', () => {
    expect(sceneToSvg(mk([tri]), opts())).toContain('fill="#f5f1e8"');
  });
  it('filters text and guides', () => {
    const all = mk([tri, guide, glyph, loose]);
    expect(filteredPrims(all, opts()).length).toBe(3);
    expect(filteredPrims(all, opts({ includeGuides: true })).length).toBe(4);
    expect(filteredPrims(all, opts({ includeText: false })).length).toBe(1);
    expect(sceneToSvg(all, opts())).toContain('<text');
    expect(sceneToSvg(all, opts({ includeText: false }))).not.toContain('<text');
  });
  it('hairline', () => {
    expect(sceneToSvg(mk([tri]), opts({ hairline: true }))).toContain('stroke-width="0.05"');
  });
});

describe('dxf', () => {
  const dxf = sceneToDxf(mk([tri, ring, dot, guide, glyph, loose]), opts({ includeGuides: true }));
  const lines = dxf.split('\n');
  it('has SECTION start and EOF end', () => {
    expect(dxf.startsWith('0\nSECTION')).toBe(true);
    expect(dxf.endsWith('0\nEOF')).toBe(true);
  });
  it('group codes alternate', () => {
    expect(lines.length % 2).toBe(0);
    for (let i = 0; i < lines.length; i += 2) expect(lines[i]).toMatch(/^-?\d+$/);
  });
  it('has entities and layers', () => {
    expect(dxf).toContain('\nCIRCLE\n');
    expect(dxf).toContain('\nPOLYLINE\n');
    expect(dxf).toContain('\nBAND_L8\n');
    expect(dxf).toContain('\nTEXT\n');
    expect(dxf).toContain('\nGUIDES\n');
    expect(dxf).toContain('$INSUNITS');
    expect((dxf.match(/\nCIRCLE\n/g) ?? []).length).toBe(2); // ring + filled dot
  });
  it('flips y (scene +y is lower => smaller DXF y)', () => {
    const d = sceneToDxf(mk([{ kind: 'path', layer: 'triangles', paint: stroke, d: [['M', 0, 0], ['L', 0, 0.5]] }]), opts());
    const l = d.split('\n');
    const vi = l.indexOf('VERTEX');
    const ys: number[] = [];
    for (let i = vi + 1; i < l.length; i += 2) if (l[i] === '20' && ys.length < 2) ys.push(parseFloat(l[i + 1]));
    expect(ys[0]).toBeCloseTo(100, 5);
    expect(ys[1]).toBeCloseTo(50, 5); // centre minus 0.5 unit
    expect(ys[1]).toBeLessThan(ys[0]);
  });
  it('flattens curves within tolerance', () => {
    // quarter-ish arc as a cubic approximating a circle of radius 0.5 units (50 mm)
    const k = 0.5522847498307936 * 0.5;
    const c: Prim = { kind: 'path', layer: 'x', paint: stroke, d: [['M', 0.5, 0], ['C', 0.5, k, k, 0.5, 0, 0.5]] };
    const d = sceneToDxf(mk([c]), opts()).split('\n');
    const pts: [number, number][] = [];
    for (let i = 0; i < d.length; i += 2) {
      if (d[i] === '0' && d[i + 1] === 'VERTEX') {
        const x = parseFloat(d[i + 5]), y = parseFloat(d[i + 7]);
        pts.push([x, y]);
      }
    }
    expect(pts.length).toBeGreaterThan(8);
    for (const [x, y] of pts) expect(Math.abs(Math.hypot(x - 100, y - 100) - 50)).toBeLessThan(0.05);
    // chord midpoint error below 0.01 mm
    for (let i = 0; i + 1 < pts.length; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2 - 100, my = (pts[i][1] + pts[i + 1][1]) / 2 - 100;
      expect(50 - Math.hypot(mx, my)).toBeLessThan(0.011);
    }
  });
  it('closed flag for Z', () => {
    const d = sceneToDxf(mk([tri]), opts()).split('\n');
    const i = d.indexOf('POLYLINE');
    expect(d.slice(i, i + 14)).toContain('70');
    expect(d[d.indexOf('70', i + 6) + 1]).toBe('1');
  });
});

describe('pdf', () => {
  it('produces one page of the right size', async () => {
    const bytes = await sceneToPdf(mk([cell, tri, ring, dot, glyph]), opts({ page: { widthMm: 210, heightMm: 297 } }));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((210 * 72) / 25.4, 2);
    expect(height).toBeCloseTo((297 * 72) / 25.4, 2);
    expect(doc.getCreator()).toBe('Sri Yantra Studio');
  });
});

describe('names and sizes', () => {
  it('sanitises file names', () => {
    expect(sanitiseFileName('a/b:c*?"<>|d e-f_g')).toBe('abcd e-f_g');
    expect(sanitiseFileName('श्री यन्त्र')).toBe('श्री यन्त्र');
    expect(sanitiseFileName('///')).toBe('sri-yantra');
  });
  it('exportScene names and types', async () => {
    const r = await exportScene(mk([tri], 150), opts({ format: 'svg' }), 'Classical Sri Yantra');
    expect(r.filename).toBe('Classical Sri Yantra 300mm.svg');
    expect(r.blob.type).toBe('image/svg+xml');
    const d = await exportScene(mk([tri], 150), opts({ format: 'dxf' }), 'x');
    expect(d.filename).toBe('x 300mm.dxf');
  });
  it('page sizes', () => {
    expect(PAGE_SIZES.find((p) => p.id === 'a4')).toMatchObject({ widthMm: 210, heightMm: 297 });
    expect(new Set(PAGE_SIZES.map((p) => p.id)).size).toBe(PAGE_SIZES.length);
  });
});

describe('pngPixelSize', () => {
  it('plain size', () => {
    const r = pngPixelSize(mk([]), opts({ dpi: 254 })); // 200 mm = 2000 px
    expect(r).toEqual({ width: 2000, height: 2000, clamped: false });
  });
  it('clamps side and area', () => {
    const big = pngPixelSize(mk([]), opts({ page: { widthMm: 1000, heightMm: 2000 }, dpi: 600 }));
    expect(big.clamped).toBe(true);
    expect(big.width).toBeLessThanOrEqual(16384);
    expect(big.height).toBeLessThanOrEqual(16384);
    expect(big.width * big.height).toBeLessThanOrEqual(120_000_000);
    expect(big.height / big.width).toBeCloseTo(2, 2);
  });
});
