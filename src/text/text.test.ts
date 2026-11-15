import { beforeAll, describe, expect, it } from 'vitest';
import type { Anchor, Design, PathCmd, Scene, TextPrim } from '../core/types';
import { pathBounds } from '../core/path';
import {
  LABEL_KINDS, buildLabels, createLabelSet, loadShaperNode, resolveText, transliterate,
  toDevanagariNumber, QUICK_INSERTS, measureText, type Shaper,
} from './index';

let shaper: Shaper;
beforeAll(async () => {
  shaper = await loadShaperNode();
}, 60000);

const finite = (p: PathCmd[]) => p.every((c) => c.slice(1).every((v) => Number.isFinite(v as number)));

function design(sets: ReturnType<typeof createLabelSet>[], custom: Design['text']['custom'] = []): Design {
  return { style: { ink: '#111', paper: '#fff' }, text: { visible: true, font: 'tiro', color: null, sets, custom } } as unknown as Design;
}
function ring(group: string, n: number, r = 0.5, radius = 0.1): Anchor[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (90 + (360 / n) * i) * (Math.PI / 180); // bottom, anticlockwise on screen
    return { id: `${group}:${i}`, group, index: i, x: Math.cos(a) * r, y: Math.sin(a) * r, r: radius, outDeg: (a * 180) / Math.PI };
  });
}
function scene(prims: TextPrim[]): Scene {
  return { prims, extent: 2, unitMm: 1, anchors: [], lines: [], rounds: [], report: {} as never, ink: '#000', paper: '#fff' };
}
function tp(over: Partial<TextPrim>): TextPrim {
  return { kind: 'text', layer: 'text', id: 't', text: 'श्रीं', x: 0, y: 0, size: 0.1, angle: 0, font: 'tiro', fill: '#000', ...over };
}

describe('shaper', () => {
  for (const t of ['श्रीं', 'क्षं', 'ॐ', '४३']) {
    for (const f of ['tiro', 'noto-sans', 'noto-serif'] as const) {
      it(`shapes ${t} in ${f}`, () => {
        const s = shaper.shape(t, f);
        expect(s.path.length).toBeGreaterThan(0);
        expect(s.width).toBeGreaterThan(0);
        expect(finite(s.path)).toBe(true);
        expect(s.top).toBeLessThan(0);
        expect(s.bottom).toBeGreaterThan(s.top);
        expect(s.clusters.length).toBeGreaterThan(0);
      });
    }
  }
  it('forms conjuncts (fewer clusters than code points)', () => {
    const s = shaper.shape('क्ष', 'tiro');
    expect(s.clusters.length).toBeLessThan([...'क्ष'].length);
    expect(s.clusters.length).toBe(1);
    expect(shaper.shape('श्रीं', 'noto-sans').clusters.length).toBe(1);
  });
  it('caches', () => {
    expect(shaper.shape('ॐ', 'tiro')).toBe(shaper.shape('ॐ', 'tiro'));
  });
  it('measureText', () => {
    const m = measureText(shaper, 'ॐ', 'tiro', 2);
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThan(0);
  });
});

describe('label sets', () => {
  it('creates every kind', () => {
    const ids = new Set<string>();
    for (const k of LABEL_KINDS) {
      const s = createLabelSet(k.kind);
      ids.add(s.id);
      expect(s.group).toBe(k.defaultGroup);
      expect(s.visible).toBe(true);
      expect(s.fit).toBe(true);
      expect(s.texts.length).toBeGreaterThan(0);
      expect(k.nameHi.length).toBeGreaterThan(0);
    }
    expect(ids.size).toBe(LABEL_KINDS.length);
  });
  it('text counts', () => {
    const len = (k: string) => createLabelSet(k).texts.length;
    expect(len('cell-numbers')).toBe(43);
    expect(len('marma-numbers')).toBe(18);
    expect(len('matrika-14')).toBe(14);
    expect(len('matrika-10-outer')).toBe(10);
    expect(len('matrika-10-inner')).toBe(10);
    expect(len('matrika-8')).toBe(8);
    expect(len('vowels-16')).toBe(16);
    expect(len('vargas-8')).toBe(8);
    expect(len('ring1-numbers')).toBe(14);
    expect(len('ring4-numbers')).toBe(8);
    expect(len('petal-numbers')).toBe(128);
    expect(len('gate-numbers')).toBe(4);
    expect(createLabelSet('blank').texts.every((x) => x === '')).toBe(true);
    expect(createLabelSet('cell-numbers').texts[42]).toBe('४३');
    expect(createLabelSet('marma-numbers').offset).toBeGreaterThan(0);
    expect(createLabelSet('vowels-16', 'band:x').group).toBe('band:x');
  });
  it('throws on unknown kind', () => {
    expect(() => createLabelSet('nope')).toThrow(/Unknown label kind/);
  });
});

describe('buildLabels', () => {
  const anchors = ring('ring4', 8);
  const mk = (patch: Partial<ReturnType<typeof createLabelSet>> = {}) => ({ ...createLabelSet('matrika-8'), fit: false, ...patch });
  const at = (p: TextPrim) => anchors.findIndex((a) => Math.abs(a.x - p.x) < 1e-9 && Math.abs(a.y - p.y) < 1e-9);

  it('maps texts to anchors in order', () => {
    const labels = buildLabels(design([mk()]), anchors, 1);
    expect(labels.length).toBe(8);
    labels.forEach((l, i) => expect(at(l)).toBe(i));
    expect(labels[0].text).toBe('अं');
  });
  it('start and clockwise', () => {
    const l = buildLabels(design([mk({ start: 2 })]), anchors, 1);
    expect(at(l[0])).toBe(2);
    expect(at(l[1])).toBe(3);
    const c = buildLabels(design([mk({ start: 2, clockwise: true })]), anchors, 1);
    expect(at(c[0])).toBe(2);
    expect(at(c[1])).toBe(1);
    expect(at(c[3])).toBe(7);
  });
  it('overrides and hidden, offset', () => {
    const set = mk({ offset: 0.1, overrides: { 0: { text: 'ॐ', dx: 1 }, 1: { hidden: true } } });
    const l = buildLabels(design([set]), anchors, 1);
    expect(l.length).toBe(7);
    expect(l[0].text).toBe('ॐ');
    const a = anchors[0];
    expect(l[0].x).toBeCloseTo(a.x + Math.cos((a.outDeg * Math.PI) / 180) * 0.1 + 1);
  });
  it('invisible set and other group are skipped; custom labels added', () => {
    const l = buildLabels(design([mk({ visible: false }), mk({ group: 'zzz' })], [{ id: 'c', text: 'ॐ', x: 1, y: 2, sizeMm: 5, angleDeg: 30 }]), anchors, 2);
    expect(l.length).toBe(1);
    expect(l[0]).toMatchObject({ id: 'custom:c', x: 1, y: 2, size: 2.5, angle: 30 });
  });
  it('orient angles', () => {
    const a = (orient: 'upright' | 'radial' | 'tangent' | 'fixed', extra = 0) =>
      buildLabels(design([mk({ orient, angleDeg: extra })]), anchors, 1);
    expect(a('upright').every((l) => l.angle === 0)).toBe(true);
    expect(a('fixed', 15).every((l) => l.angle === 15)).toBe(true);
    a('radial').forEach((l, i) => expect(l.angle).toBeCloseTo(anchors[i].outDeg + 90));
    a('tangent').forEach((l, i) => {
      const n = (((l.angle % 360) + 360) % 360);
      expect(n <= 90 || n >= 270).toBe(true);
      const r = (((anchors[i].outDeg + 90) % 360) + 360) % 360;
      expect(Math.abs(((l.angle - (anchors[i].outDeg + 90)) % 360 + 360) % 360)).toBeCloseTo(r > 90 && r < 270 ? 180 : 0);
    });
  });
  it('fit shrinks but never grows, floor at 25%', () => {
    const big = { ...mk({ sizeMm: 0.3, fit: true }) };
    const l = buildLabels(design([big]), anchors, 1, shaper);
    for (const x of l) expect(x.size).toBeLessThan(0.3);
    // actual fit
    const m = measureText(shaper, l[0].text, 'tiro', 1);
    const half = Math.hypot(m.width / 2, m.height / 2) * l[0].size;
    expect(half).toBeLessThanOrEqual(0.1 * 0.9 + 1e-9);
    // tiny text unchanged
    const small = buildLabels(design([mk({ sizeMm: 0.01, fit: true })]), anchors, 1, shaper);
    expect(small[0].size).toBeCloseTo(0.01);
    // floor
    const tight = ring('ring4', 8, 0.5, 1e-6);
    const f = buildLabels(design([mk({ sizeMm: 0.2, fit: true })]), tight, 1, shaper);
    expect(f[0].size).toBeCloseTo(0.05);
    // estimate without shaper still shrinks
    const e = buildLabels(design([big]), anchors, 1);
    expect(e[0].size).toBeLessThan(0.3);
  });
  it('size is in scene units', () => {
    const l = buildLabels(design([mk({ sizeMm: 4 })]), anchors, 2);
    expect(l[0].size).toBeCloseTo(2);
  });
});

describe('resolveText', () => {
  it('centres straight text on (x, y)', () => {
    const out = resolveText(scene([tp({ x: 3, y: -2, size: 1 })]), shaper);
    const o = (out.prims[0] as TextPrim).outline!;
    const b = pathBounds(o);
    expect((b.minX + b.maxX) / 2).toBeCloseTo(3, 0);
    expect(Math.abs((b.minX + b.maxX) / 2 - 3)).toBeLessThan(0.15);
    expect(Math.abs((b.minY + b.maxY) / 2 + 2)).toBeLessThan(0.05);
  });
  it('rotates about (x, y)', () => {
    const base = pathBounds((resolveText(scene([tp({ text: '४३', x: 0, y: 0, size: 1 })]), shaper).prims[0] as TextPrim).outline!);
    const rot = pathBounds((resolveText(scene([tp({ text: '४३', x: 0, y: 0, size: 1, angle: 90 })]), shaper).prims[0] as TextPrim).outline!);
    expect(rot.maxX - rot.minX).toBeCloseTo(base.maxY - base.minY, 1);
    expect(rot.maxY - rot.minY).toBeCloseTo(base.maxX - base.minX, 1);
  });
  it('does not mutate its input', () => {
    const prim = tp({});
    const sc = scene([prim]);
    const out = resolveText(sc, shaper);
    expect(out).not.toBe(sc);
    expect(out.prims).not.toBe(sc.prims);
    expect(prim.outline).toBeUndefined();
    expect((sc.prims[0] as TextPrim).outline).toBeUndefined();
    expect((out.prims[0] as TextPrim).outline!.length).toBeGreaterThan(0);
  });
  it('leaves non-text prims untouched', () => {
    const circle = { kind: 'circle', layer: 'x', cx: 0, cy: 0, r: 1, paint: { stroke: '#000', strokeMm: 1, fill: null } } as const;
    const out = resolveText({ ...scene([]), prims: [circle] }, shaper);
    expect(out.prims[0]).toBe(circle);
  });

  const radii = (o: PathCmd[]) => {
    const rs: number[] = [];
    const angs: number[] = [];
    for (const c of o) for (let i = 1; i + 1 < c.length; i += 2) {
      const x = c[i] as number, y = c[i + 1] as number;
      rs.push(Math.hypot(x, y));
      angs.push(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
    }
    return { rs, angs };
  };
  it('arc text outward stays near the circle', () => {
    const r = 2, size = 0.2;
    const prim = tp({ text: 'ॐ नमः', size, arc: { r, centerDeg: -90, inward: false, repeat: false, separator: '' } });
    const o = (resolveText(scene([prim]), shaper).prims[0] as TextPrim).outline!;
    expect(o.length).toBeGreaterThan(0);
    const { rs, angs } = radii(o);
    for (const v of rs) { expect(v).toBeGreaterThan(r - 0.5 * size); expect(v).toBeLessThan(r + 1.3 * size); }
    // centred on the top (270 deg in 0..360 clockwise-from-+x)
    const mean = angs.reduce((a, b) => a + b, 0) / angs.length;
    expect(Math.abs(mean - 270)).toBeLessThan(10);
  });
  it('arc text inward reads across the bottom, tops toward centre', () => {
    const r = 2, size = 0.2;
    const prim = tp({ text: 'ॐ नमः', size, arc: { r, centerDeg: 90, inward: true, repeat: false, separator: '' } });
    const o = (resolveText(scene([prim]), shaper).prims[0] as TextPrim).outline!;
    const { rs } = radii(o);
    for (const v of rs) { expect(v).toBeGreaterThan(r - 1.3 * size); expect(v).toBeLessThan(r + 0.5 * size); }
    // left-to-right: first cluster is left of the last
    const first = shaper.shape('ॐ', 'tiro');
    expect(first.width).toBeGreaterThan(0);
    const b = pathBounds(o);
    expect(b.minX).toBeLessThan(0);
    expect(b.maxX).toBeGreaterThan(0);
  });
  it('repeat covers the full circle evenly', () => {
    const r = 1.5, size = 0.15;
    const prim = tp({ text: 'श्रीं', size, arc: { r, centerDeg: -90, inward: false, repeat: true, separator: ' ' } });
    const o = (resolveText(scene([prim]), shaper).prims[0] as TextPrim).outline!;
    const { rs, angs } = radii(o);
    for (const v of rs) { expect(v).toBeGreaterThan(r - 0.5 * size); expect(v).toBeLessThan(r + 1.3 * size); }
    const bins = new Array(12).fill(0);
    for (const a of angs) bins[Math.floor(a / 30) % 12]++;
    for (const n of bins) expect(n).toBeGreaterThan(0);
  });
  it('oversize arc text is scaled to fit', () => {
    const r = 0.5, size = 1;
    const prim = tp({ text: 'ॐ नमः श्रीं ह्रीं क्लीं', size, arc: { r, centerDeg: 0, inward: false, repeat: false, separator: '' } });
    const o = (resolveText(scene([prim]), shaper).prims[0] as TextPrim).outline!;
    const { rs } = radii(o);
    expect(Math.max(...rs)).toBeLessThan(r + 1.3 * size * 0.6);
  });
});

describe('transliterate', () => {
  it('itrans', () => {
    expect(transliterate('shrIM', 'itrans')).toBe('श्रीं');
    expect(transliterate('namaH', 'itrans')).toBe('नमः');
    expect(transliterate('OM')).toBe('ॐ');
  });
  it('hk and iast', () => {
    expect(transliterate('namaH', 'hk')).toBe('नमः');
    expect(transliterate('namaḥ', 'iast')).toBe('नमः');
  });
  it('keeps existing Devanagari', () => {
    expect(transliterate('ॐ namaH')).toBe('ॐ नमः');
    expect(transliterate('श्रीं')).toBe('श्रीं');
  });
  it('numbers and inserts', () => {
    expect(toDevanagariNumber(43)).toBe('४३');
    expect(QUICK_INSERTS.length).toBe(19);
  });
});
