/** Label-set catalogue and layout of labels onto anchors. */
import type { Anchor, Design, LabelSet, TextPrim } from '../core/types';
import type { LabelKind, Shaper } from './types';
import { toDevanagariNumber } from './translit';

const nums = (n: number) => Array.from({ length: n }, (_, i) => toDevanagariNumber(i + 1));
const words = (s: string) => s.split(/\s+/).filter(Boolean);

interface KindDef extends LabelKind {
  texts: string[];
  sizeMm: number;
  offset: number;
}

const KIND_DEFS: KindDef[] = [
  { kind: 'cell-numbers', name: 'Cell numbers', nameHi: 'कोण संख्या', defaultGroup: 'cells', description: 'Numbers 1 to 43 on the 43 small triangles.', texts: nums(43), sizeMm: 4, offset: 0 },
  { kind: 'marma-numbers', name: 'Marma numbers', nameHi: 'मर्म संख्या', defaultGroup: 'marma', description: 'Numbers 1 to 18 on the three-line junctions.', texts: nums(18), sizeMm: 3, offset: 0.03 },
  { kind: 'sandhi-numbers', name: 'Sandhi numbers', nameHi: 'सन्धि संख्या', defaultGroup: 'sandhi', description: 'Numbers on the two-line junctions.', texts: nums(40), sizeMm: 3, offset: 0.03 },
  { kind: 'matrika-14', name: 'Matrika letters, outer 14', nameHi: 'मातृका वर्ण (१४)', defaultGroup: 'ring1', description: 'Fourteen bija letters on the outer ring of 14 triangles.', texts: words('कं खं गं घं ङं चं छं जं झं ञं टं ठं डं ढं'), sizeMm: 4, offset: 0 },
  { kind: 'matrika-10-outer', name: 'Matrika letters, outer 10', nameHi: 'मातृका वर्ण (१० बाह्य)', defaultGroup: 'ring2', description: 'Ten bija letters on the outer ring of 10 triangles.', texts: words('णं तं थं दं धं नं पं फं बं भं'), sizeMm: 4, offset: 0 },
  { kind: 'matrika-10-inner', name: 'Matrika letters, inner 10', nameHi: 'मातृका वर्ण (१० आन्तर)', defaultGroup: 'ring3', description: 'Ten bija letters on the inner ring of 10 triangles.', texts: words('मं यं रं लं वं शं षं सं हं क्षं'), sizeMm: 4, offset: 0 },
  { kind: 'matrika-8', name: 'Matrika letters, 8', nameHi: 'मातृका वर्ण (८)', defaultGroup: 'ring4', description: 'Eight bija letters on the ring of 8 triangles.', texts: words('अं कं चं टं तं पं यं शं'), sizeMm: 4, offset: 0 },
  { kind: 'vowels-16', name: 'Sixteen vowels', nameHi: 'सोलह स्वर', defaultGroup: 'band:l16', description: 'The sixteen vowels, one on each petal of a 16-petal lotus.', texts: words('अ आ इ ई उ ऊ ऋ ॠ ऌ ॡ ए ऐ ओ औ अं अः'), sizeMm: 4, offset: 0 },
  { kind: 'vargas-8', name: 'Eight varga letters', nameHi: 'अष्ट वर्ग', defaultGroup: 'band:l8', description: 'Eight letters, one on each petal of an 8-petal lotus.', texts: words('कं चं टं तं पं यं शं क्षं'), sizeMm: 4, offset: 0 },
  { kind: 'ring1-numbers', name: 'Outer ring numbers (14)', nameHi: 'बाह्य चक्र संख्या (१४)', defaultGroup: 'ring1', description: 'Numbers 1 to 14 on the outer ring of triangles.', texts: nums(14), sizeMm: 4, offset: 0 },
  { kind: 'ring2-numbers', name: 'Ring 2 numbers (10)', nameHi: 'द्वितीय चक्र संख्या (१०)', defaultGroup: 'ring2', description: 'Numbers 1 to 10 on the second ring of triangles.', texts: nums(10), sizeMm: 4, offset: 0 },
  { kind: 'ring3-numbers', name: 'Ring 3 numbers (10)', nameHi: 'तृतीय चक्र संख्या (१०)', defaultGroup: 'ring3', description: 'Numbers 1 to 10 on the third ring of triangles.', texts: nums(10), sizeMm: 4, offset: 0 },
  { kind: 'ring4-numbers', name: 'Ring 4 numbers (8)', nameHi: 'चतुर्थ चक्र संख्या (८)', defaultGroup: 'ring4', description: 'Numbers 1 to 8 on the fourth ring of triangles.', texts: nums(8), sizeMm: 4, offset: 0 },
  { kind: 'petal-numbers', name: 'Petal numbers', nameHi: 'दल संख्या', defaultGroup: 'band:l16', description: 'Numbers on the petals of a lotus band.', texts: nums(128), sizeMm: 6, offset: 0 },
  { kind: 'gate-numbers', name: 'Gate numbers', nameHi: 'द्वार संख्या', defaultGroup: 'gates', description: 'Numbers 1 to 4 on the four gates.', texts: nums(4), sizeMm: 4, offset: 0 },
  { kind: 'point-numbers', name: 'Numbers at every crossing', nameHi: 'प्रत्येक सन्धि पर संख्या', defaultGroup: 'points', description: 'A number at every corner and crossing of the centre figures.', texts: nums(400), sizeMm: 3, offset: 0.03 },
  { kind: 'region-numbers', name: 'Numbers in every space', nameHi: 'प्रत्येक कोष्ठ में संख्या', defaultGroup: 'regions', description: 'A number in every enclosed space of the centre figures. Change any of them to a letter or mantra.', texts: nums(400), sizeMm: 4, offset: 0 },
  { kind: 'region-blank', name: 'Empty labels in every space', nameHi: 'प्रत्येक कोष्ठ में रिक्त स्थान', defaultGroup: 'regions', description: 'An empty label in every enclosed space, for you to fill in.', texts: Array.from({ length: 400 }, () => ''), sizeMm: 4, offset: 0 },
  { kind: 'ring-blank', name: 'Empty labels around a ring', nameHi: 'वलय पर रिक्त स्थान', defaultGroup: 'band:l16', description: 'An empty label on each petal, bead or sector of a ring, for you to fill in.', texts: Array.from({ length: 128 }, () => ''), sizeMm: 6, offset: 0 },
  { kind: 'blank', name: 'Blank (fill in by hand)', nameHi: 'रिक्त', defaultGroup: 'cells', description: 'Empty labels on all 43 cells for you to fill in.', texts: Array.from({ length: 43 }, () => ''), sizeMm: 4, offset: 0 },
];

export const LABEL_KINDS: LabelKind[] = KIND_DEFS.map(({ kind, name, nameHi, defaultGroup, description }) => ({ kind, name, nameHi, defaultGroup, description }));

export function createLabelSet(kind: string, group?: string): LabelSet {
  const def = KIND_DEFS.find((k) => k.kind === kind);
  if (!def) throw new Error(`Unknown label kind "${kind}". Known kinds: ${KIND_DEFS.map((k) => k.kind).join(', ')}`);
  const rand = Math.random().toString(36).slice(2, 10);
  return {
    id: `ls-${rand}`,
    name: def.name,
    visible: true,
    group: group ?? def.defaultGroup,
    texts: [...def.texts],
    sizeMm: def.sizeMm,
    fit: true,
    orient: 'upright',
    angleDeg: 0,
    offset: def.offset,
    start: 0,
    clockwise: false,
    overrides: {},
  };
}

/* ------------------------------------------------------------- measuring */

function graphemeCount(text: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  if (Seg) {
    let n = 0;
    for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) { void _; n++; }
    return n;
  }
  let n = 0;
  for (const ch of text) if (!/[̀-ͯऀ-ःऺ-ॏ॑-ॗॢॣ]/.test(ch)) n++;
  return n;
}

/** Width and ink height of `text` (scene units when `size` is in scene units; mm when in mm). */
export function measureText(shaper: Shaper | undefined, text: string, font: import('../core/types').FontId, size: number): { width: number; height: number } {
  if (shaper) {
    const s = shaper.shape(text, font);
    return { width: s.width * size, height: Math.max(s.bottom - s.top, 0) * size };
  }
  return { width: 0.62 * graphemeCount(text) * size, height: size };
}

/* ----------------------------------------------------------------- layout */

const mod = (a: number, n: number) => ((a % n) + n) % n;

function orientAngle(orient: LabelSet['orient'], outDeg: number): number {
  switch (orient) {
    case 'radial':
      return outDeg + 90;
    case 'tangent': {
      const a = outDeg + 90;
      const norm = mod(a, 360);
      return norm > 90 && norm < 270 ? a + 180 : a;
    }
    default:
      return 0;
  }
}

export function buildLabels(design: Design, anchors: Anchor[], unitMm: number, shaper?: Shaper): TextPrim[] {
  const out: TextPrim[] = [];
  const font = design.text.font;
  const fill = design.text.color ?? design.style.ink;

  for (const set of design.text.sets) {
    if (!set.visible) continue;
    const group = anchors.filter((a) => a.group === set.group).sort((a, b) => a.index - b.index);
    const n = group.length;
    if (n === 0) continue;
    const count = Math.min(set.texts.length, n);
    for (let i = 0; i < count; i++) {
      const ov = set.overrides[i];
      if (ov?.hidden) continue;
      const text = ov?.text ?? set.texts[i];
      if (!text) continue;
      const anchor = group[mod(set.start + (set.clockwise ? -i : i), n)];
      let size = (ov?.sizeMm ?? set.sizeMm) / unitMm;
      if (set.fit) {
        const m = measureText(shaper, text, font, 1);
        const half = Math.hypot(m.width / 2, m.height / 2);
        const limit = anchor.r * 0.9;
        if (half > 0 && half * size > limit) size = Math.max(limit / half, size * 0.25);
      }
      const rad = (anchor.outDeg * Math.PI) / 180;
      out.push({
        kind: 'text',
        layer: 'text',
        role: `label:${set.group}`,
        id: `set:${set.id}:${i}`,
        text,
        x: anchor.x + Math.cos(rad) * set.offset + (ov?.dx ?? 0),
        y: anchor.y + Math.sin(rad) * set.offset + (ov?.dy ?? 0),
        size,
        angle: orientAngle(set.orient, anchor.outDeg) + set.angleDeg + (ov?.angleDeg ?? 0),
        font,
        fill,
      });
    }
  }

  for (const c of design.text.custom) {
    if (!c.text) continue;
    out.push({
      kind: 'text',
      layer: 'text',
      role: 'label:custom',
      id: `custom:${c.id}`,
      text: c.text,
      x: c.x,
      y: c.y,
      size: c.sizeMm / unitMm,
      angle: c.angleDeg,
      font,
      fill,
    });
  }
  return out;
}
