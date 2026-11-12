/**
 * Starting designs. Geometry values are documented in docs/MATH.md.
 */
import type { Band, BhupuraBand, CircleBand, CircleFigure, Design, BeadBand, GridFigure, LotusBand, PolygonFigure, SriFigure, TextRingBand } from '../core/types';
import { createLabelSet, toDevanagariNumber } from '../text';

let counter = 0;
export function newId(prefix = 'd'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/* ------------------------------------------------------------ band makers */

export const circleBand = (id: string, p: Partial<CircleBand> = {}): CircleBand => ({
  id, type: 'circle', visible: true, gap: 0, lineMm: 0.5, count: 1, spacing: 0.035, ...p,
});
export const lotusBand = (id: string, petals: number, p: Partial<LotusBand> = {}): LotusBand => ({
  id, type: 'lotus', visible: true, gap: 0, lineMm: 0.5, petals, height: 0.22, shape: 'classic', fullness: 0.6, tip: 0.6,
  tipAtTop: true, rows: 1, insets: 0, vein: false, fill: null, ...p,
});
export const beadBand = (id: string, count: number, p: Partial<BeadBand> = {}): BeadBand => ({
  id, type: 'beads', visible: true, gap: 0.012, lineMm: 0.35, count, size: 0.018, shape: 'circle', fill: null, ...p,
});
export const textRingBand = (id: string, text: string, p: Partial<TextRingBand> = {}): TextRingBand => ({
  id, type: 'textRing', visible: true, gap: 0.02, lineMm: 0.35, text, size: 0.07, font: 'tiro', repeat: true, separator: ' ॥ ', inward: false, ...p,
});
export const bhupuraBand = (id: string, p: Partial<BhupuraBand> = {}): BhupuraBand => ({
  id, type: 'bhupura', visible: true, gap: 0.07, lineMm: 0.5, lines: 3, spacing: 0.04, gateWidth: 0.3, gateDepth: 0.13, gateFlare: 1.6,
  style: 'classic', fill: null, ...p,
});

/* ---------------------------------------------------------- centre makers */

export const sriFigure = (id = 'sri', radius = 1): SriFigure => ({ id, type: 'sri', visible: true, radius });
export const polygonFigure = (id: string, sides: number, p: Partial<PolygonFigure> = {}): PolygonFigure => ({
  id, type: 'polygon', visible: true, sides, step: 1, radius: 1, rotationDeg: 0, nest: 1, nestRatio: 0.75, lineMm: 0.5, lines: 1, lineGapMm: 1.2,
  fill: null, ...p,
});
export const circleFigure = (id: string, radius: number, p: Partial<CircleFigure> = {}): CircleFigure => ({
  id, type: 'circle', visible: true, radius, count: 1, spacing: 0.03, lineMm: 0.5, ...p,
});
export const gridFigure = (id: string, rows: number, cols: number, numbers: (number | string)[], p: Partial<GridFigure> = {}): GridFigure => ({
  id, type: 'grid', visible: true, rows, cols, size: 1.2, textSizeMm: 16, lineMm: 0.5,
  texts: numbers.map((v) => (typeof v === 'number' ? toDevanagariNumber(v) : v)), ...p,
});

/** A simple enclosure for most yantras: circle, 8 petals, circle, bhupura. */
export function simpleBands(lineMm = 0.5): Band[] {
  return [
    circleBand('c0', { lineMm }),
    lotusBand('l8', 8, { lineMm, height: 0.26 }),
    circleBand('c1', { lineMm }),
    bhupuraBand('bhu', { lineMm }),
  ];
}

/** The canonical enclosure: circle · 8 petals · circle · 16 petals · three circles · bhupura. */
export function standardBands(lineMm = 0.5): Band[] {
  return [
    circleBand('c0', { lineMm }),
    lotusBand('l8', 8, { lineMm, height: 0.24 }),
    circleBand('c1', { lineMm }),
    lotusBand('l16', 16, { lineMm, height: 0.2 }),
    circleBand('c3', { lineMm, count: 3, spacing: 0.04 }),
    bhupuraBand('bhu', { lineMm }),
  ];
}

/* ---------------------------------------------------------------- designs */

export const GEOMETRIES = {
  /** G. Huet, "Sri Yantra Geometry", Theoretical Computer Science 281 (2002) — the Classical Sri Yantra */
  classical: { ravi: 0.887, kuja: 0.668, shani: 0.398, ketu: 0.165, goal: 'free', flip: false },
  /** Lakshmīdhara's commentary on Saundaryalaharī 11: diameter in 48 parts, lines at 6·12·17·20·23·27·30·36·42 */
  lakshmidhara: { ravi: 42 / 48, kuja: 31 / 48, shani: 18 / 48, ketu: 6 / 48, goal: 'free', flip: false },
  /** Kavi Mahesh, Int. J. Sanskrit Research 9(6), 2023 — simple ratios 8/9 · 2/3 · 2/5 · 1/6 */
  navagraha: { ravi: 8 / 9, kuja: 2 / 3, shani: 2 / 5, ketu: 1 / 6, goal: 'free', flip: false },
  /** concurrency + concentric bindu + equilateral central triangle */
  optimal: { ravi: 0.887, kuja: 0.656, shani: 0.382, ketu: 0.165, goal: 'optimal', flip: false },
  centered: { ravi: 0.887, kuja: 0.668, shani: 0.372, ketu: 0.165, goal: 'centered', flip: false },
} as const;

export const PAPERS = {
  cream: { ink: '#1c1b1a', paper: '#fbf7ee' },
  white: { ink: '#000000', paper: '#ffffff' },
  silver: { ink: '#23272b', paper: '#d5d9dd' },
  copper: { ink: '#3b1c0c', paper: '#c98352' },
  gold: { ink: '#4b3205', paper: '#e3bb55' },
  marble: { ink: '#3d3b38', paper: '#f1eee8' },
  night: { ink: '#f0d78c', paper: '#12141a' },
  vermilion: { ink: '#fff6dc', paper: '#a3231c' },
} as const;

export const CELL_PALETTE: [string, string, string, string, string] = ['#2b5fa5', '#b8312f', '#d98a1f', '#2f8a5b', '#f2c94c'];

export function createDesign(p: Partial<Design> = {}): Design {
  const now = Date.now();
  return {
    schema: 1,
    id: newId(),
    name: 'Sri Yantra',
    createdAt: now,
    updatedAt: now,
    sizeMm: 300,
    geometry: { ...GEOMETRIES.classical },
    centre: [sriFigure()],
    triangles: { visible: true, lineMm: 0.5, lines: 1, lineGapMm: 1.2 },
    cells: { filled: false, palette: [...CELL_PALETTE], insets: 0, insetGapMm: 1 },
    bindu: { visible: true, radius: 0.014, style: 'dot' },
    bands: standardBands(),
    text: { visible: true, font: 'tiro', color: null, sets: [], custom: [] },
    style: { ...PAPERS.cream },
    guides: { marma: false, sandhi: false, axes: false },
    ...p,
  };
}

export type PresetCategory = 'forms' | 'numbers' | 'sri';

export interface Preset {
  id: string;
  category: PresetCategory;
  name: string;
  nameHi: string;
  blurb: string;
  blurbHi: string;
  make(): Design;
}

export const PRESETS: Preset[] = [
  {
    id: 'blank',
    category: 'forms',
    name: 'Empty Yantra',
    nameHi: 'रिक्त यन्त्र',
    blurb: 'Only the enclosure. Add your own figures, letters and numbers.',
    blurbHi: 'केवल भूपुर और कमल। अपनी आकृतियाँ, अक्षर और अंक स्वयं जोड़ें।',
    make: () => createDesign({ name: 'My Yantra', centre: [], bands: simpleBands() }),
  },
  {
    id: 'trikona',
    category: 'forms',
    name: 'Triangle in Lotus',
    nameHi: 'कमल में त्रिकोण',
    blurb: 'One downward triangle in an eight-petalled lotus. Often drawn for Tara.',
    blurbHi: 'अष्टदल कमल में एक अधोमुख त्रिकोण — प्रायः तारा यन्त्र का रूप।',
    make: () => createDesign({ name: 'Triangle Yantra', centre: [polygonFigure('p1', 3, { rotationDeg: 180 })], bands: simpleBands() }),
  },
  {
    id: 'shatkona',
    category: 'forms',
    name: 'Six-Pointed Star',
    nameHi: 'षट्कोण',
    blurb: 'Two interlocked triangles in a lotus. A base for many deity yantras.',
    blurbHi: 'दो परस्पर गुँथे त्रिकोण। अनेक देव-यन्त्रों का आधार।',
    make: () => createDesign({ name: 'Shatkona Yantra', centre: [polygonFigure('p1', 6, { step: 2 })], bands: simpleBands() }),
  },
  {
    id: 'ganesha',
    category: 'forms',
    name: 'Triangle in Star',
    nameHi: 'षट्कोण में त्रिकोण',
    blurb: 'A triangle inside a six-pointed star with eight petals. Often drawn for Ganesha.',
    blurbHi: 'षट्कोण के भीतर त्रिकोण, अष्टदल सहित — प्रायः गणेश यन्त्र का रूप।',
    make: () =>
      createDesign({
        name: 'Ganesha Yantra',
        centre: [polygonFigure('p1', 6, { step: 2 }), polygonFigure('p2', 3, { radius: 0.36 })],
        bands: simpleBands(),
      }),
  },
  {
    id: 'kali',
    category: 'forms',
    name: 'Five Triangles',
    nameHi: 'पञ्च त्रिकोण',
    blurb: 'Five downward triangles one inside another. Often drawn for Kali.',
    blurbHi: 'एक के भीतर एक पाँच अधोमुख त्रिकोण — प्रायः काली यन्त्र का रूप।',
    make: () =>
      createDesign({
        name: 'Kali Yantra',
        centre: [polygonFigure('p1', 3, { rotationDeg: 180, nest: 5, nestRatio: 0.74 })],
        bands: [circleBand('c0', { count: 2, spacing: 0.04 }), lotusBand('l8', 8, { height: 0.26 }), circleBand('c1'), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'bhuvaneshwari',
    category: 'forms',
    name: 'Star with Two Lotuses',
    nameHi: 'षट्कोण, दो कमल',
    blurb: 'Six-pointed star with eight and sixteen petals. Often drawn for Bhuvaneshvari.',
    blurbHi: 'षट्कोण, अष्टदल और षोडशदल — प्रायः भुवनेश्वरी यन्त्र का रूप।',
    make: () => createDesign({ name: 'Bhuvaneshwari Yantra', centre: [polygonFigure('p1', 6, { step: 2 })], bands: standardBands() }),
  },
  {
    id: 'panchakona',
    category: 'forms',
    name: 'Five-Pointed Star',
    nameHi: 'पञ्चकोण',
    blurb: 'A five-pointed star with a pentagon at its heart, in a lotus.',
    blurbHi: 'कमल में पञ्चकोण तारा।',
    make: () => createDesign({ name: 'Panchakona Yantra', centre: [polygonFigure('p1', 5, { step: 2 })], bands: simpleBands() }),
  },
  {
    id: 'ashtakona',
    category: 'forms',
    name: 'Eight-Pointed Star',
    nameHi: 'अष्टकोण',
    blurb: 'Two interlocked squares with sixteen petals.',
    blurbHi: 'दो परस्पर गुँथे चतुरस्र, षोडशदल सहित।',
    make: () =>
      createDesign({
        name: 'Ashtakona Yantra',
        centre: [polygonFigure('p1', 8, { step: 2 }), circleFigure('ci', 0.38)],
        bands: [circleBand('c0'), lotusBand('l16', 16, { height: 0.22 }), circleBand('c1'), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'navakona',
    category: 'forms',
    name: 'Nine-Pointed Star',
    nameHi: 'नवकोण',
    blurb: 'Three interlocked triangles forming nine points, in a lotus.',
    blurbHi: 'तीन परस्पर गुँथे त्रिकोण — नौ कोण।',
    make: () => createDesign({ name: 'Navakona Yantra', centre: [polygonFigure('p1', 9, { step: 3 })], bands: simpleBands() }),
  },
  {
    id: 'surya',
    category: 'numbers',
    name: 'Number Square of 15',
    nameHi: 'पन्द्रह का यन्त्र',
    blurb: 'Three by three, every line adds to 15: the Surya yantra. Change the numbers for other planets.',
    blurbHi: 'तीन-तीन कोष्ठ, प्रत्येक पंक्ति का योग १५ — सूर्य यन्त्र। अन्य ग्रहों के लिए अंक बदलें।',
    make: () =>
      createDesign({
        name: 'Surya Yantra',
        centre: [gridFigure('g1', 3, 3, [6, 1, 8, 7, 5, 3, 2, 9, 4])],
        bindu: { visible: false, radius: 0.014, style: 'dot' },
        bands: simpleBands(),
      }),
  },
  {
    id: 'kubera',
    category: 'numbers',
    name: 'Number Square of 72',
    nameHi: 'बहत्तर का यन्त्र',
    blurb: 'Every line adds to 72, widely used as the Kubera yantra. A plain square border.',
    blurbHi: 'प्रत्येक पंक्ति का योग ७२ — कुबेर यन्त्र के रूप में प्रसिद्ध।',
    make: () =>
      createDesign({
        name: 'Kubera Yantra',
        sizeMm: 150,
        centre: [gridFigure('g1', 3, 3, [27, 20, 25, 22, 24, 26, 23, 28, 21]), polygonFigure('p1', 4, { rotationDeg: 45, radius: 1, lines: 2, lineGapMm: 2 })],
        bindu: { visible: false, radius: 0.014, style: 'dot' },
        bands: [],
        style: { ...PAPERS.copper },
      }),
  },
  {
    id: 'chautisa',
    category: 'numbers',
    name: 'Number Square of 34',
    nameHi: 'चौंतीसा यन्त्र',
    blurb: 'Four by four, every line adds to 34 (Chautisa yantra).',
    blurbHi: 'चार-चार कोष्ठ, प्रत्येक पंक्ति का योग ३४।',
    make: () =>
      createDesign({
        name: 'Chautisa Yantra',
        centre: [gridFigure('g1', 4, 4, [7, 12, 1, 14, 2, 13, 8, 11, 16, 3, 10, 5, 9, 6, 15, 4], { textSizeMm: 12 })],
        bindu: { visible: false, radius: 0.014, style: 'dot' },
        bands: simpleBands(),
      }),
  },
  {
    id: 'classical',
    category: 'sri',
    name: 'Classical',
    nameHi: 'शास्त्रीय',
    blurb: 'The well-known form, as analysed by Gérard Huet. A safe place to begin.',
    blurbHi: 'सर्वप्रसिद्ध रूप। आरम्भ के लिए उत्तम।',
    make: () => createDesign({ name: 'Classical Sri Yantra' }),
  },
  {
    id: 'optimal',
    category: 'sri',
    name: 'Perfectly Centred',
    nameHi: 'पूर्ण केन्द्रित',
    blurb: 'Bindu at the exact centre and an equilateral central triangle.',
    blurbHi: 'बिन्दु ठीक केन्द्र में, मध्य त्रिकोण समबाहु।',
    make: () => createDesign({ name: 'Perfectly Centred Sri Yantra', geometry: { ...GEOMETRIES.optimal } }),
  },
  {
    id: 'lakshmidhara',
    category: 'sri',
    name: 'Saundaryalaharī (48 parts)',
    nameHi: 'सौन्दर्यलहरी (४८ भाग)',
    blurb: 'Lakshmīdhara’s traditional 48-part rule, with every crossing made exact.',
    blurbHi: 'लक्ष्मीधर की ४८ भाग वाली परम्परागत विधि, सभी सन्धियाँ शुद्ध।',
    make: () => createDesign({ name: 'Saundaryalahari Sri Yantra', geometry: { ...GEOMETRIES.lakshmidhara } }),
  },
  {
    id: 'navagraha',
    category: 'sri',
    name: 'Simple Ratios',
    nameHi: 'सरल अनुपात',
    blurb: 'Built from easy fractions — 8/9, 2/3, 2/5, 1/6 — that a craftsman can lay out by hand.',
    blurbHi: 'सरल भिन्नों से — ८/९, २/३, २/५, १/६ — जिन्हें शिल्पी हाथ से नाप सके।',
    make: () => createDesign({ name: 'Simple Ratio Sri Yantra', geometry: { ...GEOMETRIES.navagraha } }),
  },
  {
    id: 'temple',
    category: 'sri',
    name: 'Old Temple Style',
    nameHi: 'प्राचीन मन्दिर शैली',
    blurb: 'Centred figure with rounded petals and plain gateways, after old South Indian yantras.',
    blurbHi: 'गोल पंखुड़ियाँ और सादे द्वार, प्राचीन दक्षिण भारतीय यन्त्रों जैसी।',
    make: () =>
      createDesign({
        name: 'Temple Style Sri Yantra',
        geometry: { ...GEOMETRIES.optimal },
        bands: [
          circleBand('c0'),
          lotusBand('l8', 8, { shape: 'round', height: 0.26, fullness: 0.8, tip: 0.25 }),
          circleBand('c1'),
          lotusBand('l16', 16, { shape: 'round', height: 0.2, fullness: 0.8, tip: 0.25 }),
          circleBand('c3', { count: 3, spacing: 0.045 }),
          bhupuraBand('bhu', { style: 'plain', gateWidth: 0.26, gateDepth: 0.1 }),
        ],
        style: { ...PAPERS.copper },
      }),
  },
  {
    id: 'urdhva',
    category: 'sri',
    name: 'Upward (Ūrdhvamukha)',
    nameHi: 'ऊर्ध्वमुख',
    blurb: 'The same yantra with the central triangle pointing upward.',
    blurbHi: 'वही यन्त्र, मध्य त्रिकोण ऊपर की ओर।',
    make: () => createDesign({ name: 'Urdhvamukha Sri Yantra', geometry: { ...GEOMETRIES.classical, flip: true } }),
  },
  {
    id: 'silver',
    category: 'sri',
    name: 'Silver Plate',
    nameHi: 'रजत पत्र',
    blurb: 'Fine double lines for engraving a small silver plate. Lines only, no colour.',
    blurbHi: 'चाँदी के छोटे पत्र पर उकेरने हेतु महीन दोहरी रेखाएँ।',
    make: () =>
      createDesign({
        name: 'Silver Plate Sri Yantra',
        sizeMm: 150,
        geometry: { ...GEOMETRIES.optimal },
        triangles: { visible: true, lineMm: 0.2, lines: 2, lineGapMm: 0.7 },
        bands: [
          circleBand('c0', { lineMm: 0.2, count: 2, spacing: 0.02 }),
          lotusBand('l8', 8, { lineMm: 0.2, height: 0.24, insets: 1 }),
          circleBand('c1', { lineMm: 0.2 }),
          lotusBand('l16', 16, { lineMm: 0.2, height: 0.2, insets: 1 }),
          circleBand('c3', { lineMm: 0.2, count: 3, spacing: 0.035 }),
          bhupuraBand('bhu', { lineMm: 0.2 }),
        ],
        bindu: { visible: true, radius: 0.012, style: 'ringdot' },
        style: { ...PAPERS.silver },
      }),
  },
  {
    id: 'marble',
    category: 'sri',
    name: 'Marble Carving',
    nameHi: 'संगमरमर',
    blurb: 'Bold, clean lines sized for a large marble slab.',
    blurbHi: 'बड़े संगमरमर पट्ट के लिए स्पष्ट, मोटी रेखाएँ।',
    make: () =>
      createDesign({
        name: 'Marble Sri Yantra',
        sizeMm: 600,
        geometry: { ...GEOMETRIES.classical },
        triangles: { visible: true, lineMm: 2.4, lines: 1, lineGapMm: 4 },
        bands: standardBands(2.4),
        bindu: { visible: true, radius: 0.02, style: 'dot' },
        style: { ...PAPERS.marble },
      }),
  },
  {
    id: 'colour',
    category: 'sri',
    name: 'Coloured Chart',
    nameHi: 'रंगीन चित्र',
    blurb: 'Each enclosure in its own colour, for printing on large chart paper.',
    blurbHi: 'प्रत्येक आवरण अपने रंग में — बड़े चार्ट पेपर पर छापने के लिए।',
    make: () =>
      createDesign({
        name: 'Coloured Sri Yantra',
        sizeMm: 560,
        geometry: { ...GEOMETRIES.optimal },
        cells: { filled: true, palette: [...CELL_PALETTE], insets: 0, insetGapMm: 1 },
        bands: [
          circleBand('c0', { lineMm: 0.6 }),
          lotusBand('l8', 8, { lineMm: 0.6, height: 0.24, fill: '#c0392b' }),
          circleBand('c1', { lineMm: 0.6 }),
          lotusBand('l16', 16, { lineMm: 0.6, height: 0.2, fill: '#2b5fa5' }),
          circleBand('c3', { lineMm: 0.6, count: 3, spacing: 0.04 }),
          bhupuraBand('bhu', { lineMm: 0.6, fill: '#e8c15a' }),
        ],
        style: { ink: '#2a1a0a', paper: '#fdf6e3' },
      }),
  },
  {
    id: 'matrika',
    category: 'sri',
    name: 'With Sanskrit Letters',
    nameHi: 'मातृका अक्षर सहित',
    blurb: 'The letters of the alphabet placed in the petals and triangles, with a mantra ring.',
    blurbHi: 'पंखुड़ियों और त्रिकोणों में वर्णमाला के अक्षर, मन्त्र-वलय सहित।',
    make: () =>
      createDesign({
        name: 'Matrika Sri Yantra',
        sizeMm: 420,
        geometry: { ...GEOMETRIES.optimal },
        bands: [
          circleBand('c0'),
          lotusBand('l8', 8, { height: 0.26, fullness: 0.75 }),
          circleBand('c1'),
          lotusBand('l16', 16, { height: 0.24, fullness: 0.75 }),
          circleBand('c3', { count: 2, spacing: 0.03 }),
          textRingBand('mantra', 'ॐ श्रीमहात्रिपुरसुन्दर्यै नमः'),
          circleBand('c4', { count: 2, spacing: 0.03, gap: 0.02 }),
          bhupuraBand('bhu'),
        ],
        text: {
          visible: true,
          font: 'tiro',
          color: null,
          sets: [
            createLabelSet('vowels-16', 'band:l16'),
            createLabelSet('vargas-8', 'band:l8'),
            createLabelSet('matrika-14'),
            createLabelSet('matrika-10-outer'),
            createLabelSet('matrika-10-inner'),
            createLabelSet('matrika-8'),
          ],
          custom: [],
        },
      }),
  },
  {
    id: 'grand',
    category: 'sri',
    name: 'Grand Lotus',
    nameHi: 'महापद्म',
    blurb: 'Many rings of petals and beads — the most detailed design, for a very large sheet.',
    blurbHi: 'पंखुड़ियों और मणियों के अनेक वलय — सबसे सूक्ष्म रचना, बहुत बड़े पत्र हेतु।',
    make: () =>
      createDesign({
        name: 'Grand Lotus Sri Yantra',
        sizeMm: 840,
        geometry: { ...GEOMETRIES.optimal },
        triangles: { visible: true, lineMm: 0.5, lines: 2, lineGapMm: 2.2 },
        cells: { filled: false, palette: [...CELL_PALETTE], insets: 1, insetGapMm: 2.2 },
        bindu: { visible: true, radius: 0.014, style: 'ringdot' },
        bands: [
          circleBand('c0', { count: 2, spacing: 0.02 }),
          lotusBand('l8', 8, { height: 0.24, rows: 2, insets: 1, vein: true }),
          circleBand('c1', { count: 2, spacing: 0.02 }),
          lotusBand('l16', 16, { height: 0.2, rows: 2, insets: 1, vein: true }),
          circleBand('c2', { count: 2, spacing: 0.02 }),
          beadBand('b1', 108),
          circleBand('c2b', { gap: 0.012 }),
          lotusBand('l32', 32, { height: 0.16, shape: 'pointed', insets: 1 }),
          circleBand('c3', { count: 1 }),
          lotusBand('l64', 64, { height: 0.12, shape: 'flame', rows: 2 }),
          circleBand('c4', { count: 3, spacing: 0.03 }),
          beadBand('b2', 216, { shape: 'diamond', size: 0.014 }),
          circleBand('c5', { gap: 0.012 }),
          bhupuraBand('bhu', { lines: 4, style: 'stepped', gateDepth: 0.16 }),
        ],
      }),
  },
  {
    id: 'study',
    category: 'sri',
    name: 'Study Chart',
    nameHi: 'अध्ययन चित्र',
    blurb: 'All 43 triangles and the 18 marma points numbered in Sanskrit numerals.',
    blurbHi: 'सभी ४३ त्रिकोण और १८ मर्म-स्थान संस्कृत अंकों में अंकित।',
    make: () =>
      createDesign({
        name: 'Study Chart',
        sizeMm: 420,
        geometry: { ...GEOMETRIES.classical },
        guides: { marma: true, sandhi: false, axes: false },
        text: { visible: true, font: 'noto-sans', color: null, sets: [createLabelSet('cell-numbers'), createLabelSet('marma-numbers')], custom: [] },
        style: { ...PAPERS.white },
      }),
  },
];
