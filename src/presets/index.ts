/**
 * Starting designs. Geometry values are documented in docs/MATH.md.
 */
import type {
  ArcFigure, Band, BhupuraBand, CircleBand, CircleFigure, CrescentFigure, CustomLabel, Design, FreeFigure, SymbolFigure, SymbolName, BeadBand, GridFigure, LabelSet, LatticeFigure, LotusBand, LotusFigure,
  PolygonFigure, RaysFigure, SriFigure, TextRingBand,
} from '../core/types';
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

export const lotusFigure = (id: string, petals: number, radius: number, p: Partial<LotusFigure> = {}): LotusFigure => ({
  id, type: 'lotus', visible: true, radius, petals, height: 0.2, shape: 'classic', fullness: 0.6, tip: 0.6, tipAtTop: true, lineMm: 0.5, fill: null, ...p,
});
export const raysFigure = (id: string, count: number, p: Partial<RaysFigure> = {}): RaysFigure => ({
  id, type: 'rays', visible: true, count, inner: 0, outer: 1, rotationDeg: 0, lineMm: 0.5, ...p,
});
export const latticeFigure = (id: string, rows: number, p: Partial<LatticeFigure> = {}): LatticeFigure => ({
  id, type: 'lattice', visible: true, rows, hollow: 0, radius: 1, rotationDeg: 0, lineMm: 0.5, ...p,
});

export const arcFigure = (id: string, radius: number, p: Partial<ArcFigure> = {}): ArcFigure => ({
  id, type: 'arc', visible: true, radius, startDeg: -90, sweepDeg: 180, lineMm: 0.5, ...p,
});
export const crescentFigure = (id: string, radius: number, p: Partial<CrescentFigure> = {}): CrescentFigure => ({
  id, type: 'crescent', visible: true, radius, thickness: 0.35, inner: 1, rotationDeg: 0, lineMm: 0.5, fill: null, ...p,
});
export const symbolFigure = (id: string, symbol: SymbolName, p: Partial<SymbolFigure> = {}): SymbolFigure => ({
  id, type: 'symbol', visible: true, symbol, size: 0.15, rotationDeg: 0, lineMm: 0.5, ...p,
});
export const freeFigure = (id: string, points: [number, number][], p: Partial<FreeFigure> = {}): FreeFigure => ({
  id, type: 'free', visible: true, points: points.map(([x, y]) => ({ x, y })), closed: true, repeat: 1, lineMm: 0.5, fill: null, ...p,
});

/** A ready-filled label set on any group of places. */
export function labelsOn(group: string, name: string, texts: string[], p: Partial<LabelSet> = {}): LabelSet {
  return { ...createLabelSet('blank', group), name, texts, ...p };
}
/** A single piece of text at a point (scene units; the centre is 0, 0). */
export const textAt = (text: string, sizeMm: number, x = 0, y = 0, angleDeg = 0): CustomLabel => ({ id: newId('t'), text, x, y, sizeMm, angleDeg });
const words = (line: string) => line.split(/\s+/).filter(Boolean);
const noBindu = { visible: false, radius: 0.014, style: 'dot' as const };

/** One of the body's lotuses: a ring of lettered petals around a circle that holds its figure and seed syllable. */
function chakraDesign(name: string, petals: number, letters: string, bija: string, centre: Design['centre'], o: { tipAtTop?: boolean; height?: number; bijaAt?: [number, number]; bijaMm?: number; letterMm?: number } = {}): Design {
  return createDesign({
    name,
    sizeMm: 300,
    centre,
    bindu: noBindu,
    bands: [circleBand('c0', { count: 2, spacing: 0.03 }), lotusBand('l', petals, { height: o.height ?? 0.42, fullness: 0.85, tip: 0.5, tipAtTop: o.tipAtTop ?? true })],
    text: {
      visible: true,
      font: 'tiro',
      color: null,
      sets: [labelsOn('band:l', 'Petal letters', words(letters), { sizeMm: o.letterMm ?? 9 })],
      custom: [textAt(bija, o.bijaMm ?? 26, o.bijaAt?.[0] ?? 0, o.bijaAt?.[1] ?? 0)],
    },
  });
}

/** Every planet's square is the Sun's square with the same number added to each cell. */
const SURYA = [6, 1, 8, 7, 5, 3, 2, 9, 4];
const graha = (add: number) => SURYA.map((v) => v + add);

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

export type PresetCategory = 'forms' | 'mahavidya' | 'chakras' | 'numbers' | 'sri';

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
    category: 'mahavidya',
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
    category: 'mahavidya',
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
    category: 'mahavidya',
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
    id: 'murugan',
    category: 'forms',
    name: 'Star with Six Letters',
    nameHi: 'षडक्षर षट्कोण',
    blurb: 'Six-pointed star with Om at the heart and a syllable in each point, as drawn for Murugan (Shanmukha).',
    blurbHi: 'षट्कोण, मध्य में ॐ और प्रत्येक कोण में एक अक्षर — षण्मुख (मुरुगन) यन्त्र का रूप।',
    make: () =>
      createDesign({
        name: 'Shanmukha Yantra',
        centre: [polygonFigure('p1', 6, { step: 2, radius: 0.96 })],
        bindu: noBindu,
        bands: [circleBand('c0'), lotusBand('l6', 6, { height: 0.3, fullness: 0.8 }), circleBand('c1'), bhupuraBand('bhu')],
        text: {
          visible: true, font: 'tiro', color: null, sets: [],
          custom: [
            textAt('ॐ', 24),
            ...words('श र व ण भ व').map((ch, i) => {
              const a = ((-90 + i * 60) * Math.PI) / 180;
              return textAt(ch, 11, 0.7 * Math.cos(a), 0.7 * Math.sin(a));
            }),
          ],
        },
      }),
  },
  {
    id: 'surya12',
    category: 'forms',
    name: 'Sun of Twelve Rays',
    nameHi: 'द्वादश किरण सूर्य',
    blurb: 'A disc ringed by twelve triangles. Shows a figure repeated around the centre.',
    blurbHi: 'बारह त्रिकोणों से घिरा मण्डल। एक आकृति को केन्द्र के चारों ओर दोहराने का उदाहरण।',
    make: () =>
      createDesign({
        name: 'Twelve-Ray Sun',
        centre: [circleFigure('c', 0.5, { count: 2, spacing: 0.03 }), polygonFigure('rays', 3, { radius: 0.2, orbit: { count: 12, radius: 0.76, phaseDeg: 0 } })],
        bands: [circleBand('c0'), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'dvadasha',
    category: 'forms',
    name: 'Twelve-Pointed Star',
    nameHi: 'द्वादश कोण',
    blurb: 'Four interlocked triangles with a twelve-petalled lotus.',
    blurbHi: 'चार परस्पर गुँथे त्रिकोण, द्वादश दल कमल सहित।',
    make: () =>
      createDesign({
        name: 'Twelve-Pointed Star Yantra',
        centre: [polygonFigure('p1', 12, { step: 4 }), circleFigure('ci', 0.24)],
        bands: [circleBand('c0'), lotusBand('l12', 12, { height: 0.24 }), circleBand('c1', { count: 2, spacing: 0.035 }), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'shodasha',
    category: 'forms',
    name: 'Sixteen-Pointed Star',
    nameHi: 'षोडश कोण',
    blurb: 'Two eight-pointed stars woven together, a small lotus at the heart, beads and sixteen petals outside.',
    blurbHi: 'दो अष्टकोण तारे गुँथे हुए, मध्य में छोटा कमल, बाहर मणि-वलय और षोडश दल।',
    make: () =>
      createDesign({
        name: 'Sixteen-Pointed Star Yantra',
        sizeMm: 420,
        centre: [polygonFigure('p1', 16, { step: 6, lines: 2, lineGapMm: 1.6 }), circleFigure('ci', 0.2), lotusFigure('li', 8, 0.06, { height: 0.13, fullness: 0.8 })],
        bands: [circleBand('c0', { count: 2, spacing: 0.03 }), beadBand('b1', 64), circleBand('c1', { gap: 0.012 }), lotusBand('l16', 16, { height: 0.22, insets: 1 }), circleBand('c2', { count: 3, spacing: 0.035 }), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'swastika',
    category: 'forms',
    name: 'Svastika with Four Dots',
    nameHi: 'स्वस्तिक',
    blurb: 'The right-turning svastika with a dot in each arm, in a square.',
    blurbHi: 'चार बिन्दुओं सहित दक्षिणावर्त स्वस्तिक, चतुरस्र में।',
    make: () =>
      createDesign({
        name: 'Svastika Yantra',
        sizeMm: 200,
        centre: [
          symbolFigure('sv', 'swastika', { size: 0.6, lineMm: 1.2 }),
          circleFigure('dots', 0.05, { orbit: { count: 4, radius: 0.42, phaseDeg: 45 } }),
          polygonFigure('sq', 4, { rotationDeg: 45, radius: 1.2, lines: 2, lineGapMm: 2 }),
        ],
        bindu: noBindu,
        bands: [],
        style: { ...PAPERS.vermilion },
      }),
  },
  {
    id: 'trishula',
    category: 'forms',
    name: 'Triangle Guarded by Tridents',
    nameHi: 'त्रिशूल रक्षित त्रिकोण',
    blurb: 'A downward triangle in a lotus, with a trident in each corner of the enclosure.',
    blurbHi: 'कमल में अधोमुख त्रिकोण, भूपुर के चारों कोनों में त्रिशूल।',
    make: () =>
      createDesign({
        name: 'Trishula Yantra',
        centre: [polygonFigure('p1', 3, { rotationDeg: 180 }), symbolFigure('tri', 'trident', { size: 0.13, orbit: { count: 4, radius: 1.52, phaseDeg: 45 } })],
        bands: simpleBands(),
      }),
  },
  {
    id: 'chandrabindu',
    category: 'forms',
    name: 'Crescent and Dot',
    nameHi: 'चन्द्र-बिन्दु',
    blurb: 'A crescent moon holding a dot, ringed by an arc of light, in a lotus.',
    blurbHi: 'बिन्दु धारण किए अर्धचन्द्र, ऊपर प्रभा-चाप, कमल में।',
    make: () =>
      createDesign({
        name: 'Chandra Bindu',
        centre: [crescentFigure('moon', 0.62, { thickness: 0.42, fill: null }), circleFigure('dot', 0.09, { orbit: { count: 1, radius: 0.2, phaseDeg: 0 } }), arcFigure('halo', 0.86, { startDeg: -70, sweepDeg: 140 })],
        bindu: noBindu,
        bands: simpleBands(),
        style: { ...PAPERS.night },
      }),
  },
  {
    id: 'kites',
    category: 'forms',
    name: 'Eight Blades',
    nameHi: 'अष्ट पत्र',
    blurb: 'One hand-drawn blade repeated eight times round the centre. Shows a free shape of your own, turned into a pattern.',
    blurbHi: 'हाथ से बनाया एक पत्र, केन्द्र के चारों ओर आठ बार। अपनी बनाई आकृति से रचना का उदाहरण।',
    make: () =>
      createDesign({
        name: 'Eight Blades',
        centre: [freeFigure('blade', [[0, -0.97], [0.2, -0.5], [0, -0.22], [-0.2, -0.5]], { repeat: 8 }), circleFigure('ci', 0.2)],
        bands: simpleBands(),
      }),
  },
  {
    id: 'bhairavi',
    category: 'mahavidya',
    name: 'Downward Triangle in Star',
    nameHi: 'षट्कोण में अधोमुख त्रिकोण',
    blurb: 'A downward triangle inside a six-pointed star. One common form for Bhairavi.',
    blurbHi: 'षट्कोण के भीतर अधोमुख त्रिकोण — भैरवी यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Bhairavi Yantra',
        centre: [polygonFigure('p1', 6, { step: 2 }), polygonFigure('p2', 3, { radius: 0.36, rotationDeg: 180 })],
        bands: simpleBands(),
        style: { ...PAPERS.vermilion },
      }),
  },
  {
    id: 'chinnamasta',
    category: 'mahavidya',
    name: 'Triangle within Triangle',
    nameHi: 'त्रिकोण में त्रिकोण',
    blurb: 'Two downward triangles, three circles and eight petals. One common form for Chinnamasta.',
    blurbHi: 'दो अधोमुख त्रिकोण, तीन वृत्त और अष्टदल — छिन्नमस्ता यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Chinnamasta Yantra',
        centre: [polygonFigure('p1', 3, { rotationDeg: 180, nest: 2, nestRatio: 0.5 })],
        bands: [circleBand('c0', { count: 3, spacing: 0.035 }), lotusBand('l8', 8, { height: 0.26 }), circleBand('c1'), bhupuraBand('bhu')],
      }),
  },
  {
    id: 'dhumavati',
    category: 'mahavidya',
    name: 'Star in Lotus, Smoke',
    nameHi: 'धूम्र षट्कोण',
    blurb: 'Six-pointed star in eight petals on a smoke-grey ground. One common form for Dhumavati.',
    blurbHi: 'धूम्र वर्ण पर अष्टदल में षट्कोण — धूमावती यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Dhumavati Yantra',
        centre: [polygonFigure('p1', 6, { step: 2 }), circleFigure('ci', 0.2)],
        bands: simpleBands(),
        style: { ink: '#1f1f22', paper: '#c9c9cc' },
      }),
  },
  {
    id: 'bagalamukhi',
    category: 'mahavidya',
    name: 'Triangle in Star, Two Lotuses',
    nameHi: 'त्रिकोण, षट्कोण, दो कमल',
    blurb: 'Triangle in a six-pointed star with eight and sixteen petals, on yellow. One common form for Bagalamukhi.',
    blurbHi: 'पीत वर्ण पर त्रिकोण, षट्कोण, अष्टदल और षोडशदल — बगलामुखी यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Bagalamukhi Yantra',
        centre: [polygonFigure('p1', 6, { step: 2 }), polygonFigure('p2', 3, { radius: 0.36, rotationDeg: 180 })],
        bands: standardBands(),
        style: { ink: '#3a2a00', paper: '#f2cf3f' },
      }),
  },
  {
    id: 'matangi',
    category: 'mahavidya',
    name: 'Triangle with Two Lotuses',
    nameHi: 'त्रिकोण, दो कमल',
    blurb: 'A downward triangle with eight and sixteen petals. One common form for Matangi.',
    blurbHi: 'अधोमुख त्रिकोण, अष्टदल और षोडशदल — मातङ्गी यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Matangi Yantra',
        centre: [polygonFigure('p1', 3, { rotationDeg: 180 }), circleFigure('ci', 0.46)],
        bands: standardBands(),
      }),
  },
  {
    id: 'kamala',
    category: 'mahavidya',
    name: 'Star in Full Lotus, Gold',
    nameHi: 'स्वर्ण कमल में षट्कोण',
    blurb: 'Six-pointed star in a full eight-petalled lotus with three circles, on gold. One common form for Kamala.',
    blurbHi: 'स्वर्ण वर्ण पर पूर्ण अष्टदल कमल में षट्कोण, तीन वृत्त — कमला यन्त्र का एक प्रचलित रूप।',
    make: () =>
      createDesign({
        name: 'Kamala Yantra',
        centre: [polygonFigure('p1', 6, { step: 2 })],
        bands: [circleBand('c0'), lotusBand('l8', 8, { height: 0.3, shape: 'lotus', fullness: 0.85 }), circleBand('c1', { count: 3, spacing: 0.04 }), bhupuraBand('bhu')],
        style: { ...PAPERS.gold },
      }),
  },
  {
    id: 'muladhara',
    category: 'chakras',
    name: 'Muladhara · 4 petals',
    nameHi: 'मूलाधार · ४ दल',
    blurb: 'Square and downward triangle in a four-petalled lotus, seed syllable Lam.',
    blurbHi: 'चतुर्दल कमल में चतुरस्र और अधोमुख त्रिकोण, बीज लं।',
    make: () =>
      chakraDesign('Muladhara', 4, 'वं शं षं सं', 'लं', [polygonFigure('sq', 4, { rotationDeg: 45, radius: 0.94 }), polygonFigure('tri', 3, { rotationDeg: 180, radius: 0.56 })], { tipAtTop: false, height: 0.5, bijaMm: 22 }),
  },
  {
    id: 'svadhisthana',
    category: 'chakras',
    name: 'Svadhisthana · 6 petals',
    nameHi: 'स्वाधिष्ठान · ६ दल',
    blurb: 'A crescent moon in a six-petalled lotus, seed syllable Vam.',
    blurbHi: 'षड्दल कमल में अर्धचन्द्र, बीज वं।',
    make: () =>
      chakraDesign('Svadhisthana', 6, 'बं भं मं यं रं लं', 'वं', [crescentFigure('moon', 0.86, { thickness: 0.36 })], { bijaAt: [0, -0.18] }),
  },
  {
    id: 'manipura',
    category: 'chakras',
    name: 'Manipura · 10 petals',
    nameHi: 'मणिपूर · १० दल',
    blurb: 'A downward triangle with a T-mark on each side, in a ten-petalled lotus, seed syllable Ram.',
    blurbHi: 'दशदल कमल में अधोमुख त्रिकोण, बीज रं।',
    make: () => chakraDesign('Manipura', 10, 'डं ढं णं तं थं दं धं नं पं फं', 'रं', [polygonFigure('tri', 3, { rotationDeg: 180, radius: 0.8 }), symbolFigure('marks', 'tmark', { size: 0.13, orbit: { count: 3, radius: 0.4, phaseDeg: 0 } })], { height: 0.36 }),
  },
  {
    id: 'anahata',
    category: 'chakras',
    name: 'Anahata · 12 petals',
    nameHi: 'अनाहत · १२ दल',
    blurb: 'A six-pointed star in a twelve-petalled lotus, seed syllable Yam.',
    blurbHi: 'द्वादशदल कमल में षट्कोण, बीज यं।',
    make: () => chakraDesign('Anahata', 12, 'कं खं गं घं ङं चं छं जं झं ञं टं ठं', 'यं', [polygonFigure('star', 6, { step: 2, radius: 0.96 })], { height: 0.34, letterMm: 8 }),
  },
  {
    id: 'vishuddha',
    category: 'chakras',
    name: 'Vishuddha · 16 petals',
    nameHi: 'विशुद्ध · १६ दल',
    blurb: 'A circle within a downward triangle in a sixteen-petalled lotus that carries the sixteen vowels, seed syllable Ham.',
    blurbHi: 'षोडशदल कमल (सोलह स्वर) में अधोमुख त्रिकोण और वृत्त, बीज हं।',
    make: () =>
      chakraDesign('Vishuddha', 16, 'अं आं इं ईं उं ऊं ऋं ॠं ऌं ॡं एं ऐं ओं औं अं अः', 'हं', [polygonFigure('tri', 3, { rotationDeg: 180, radius: 0.96 }), circleFigure('ci', 0.44)], { height: 0.32, letterMm: 7, bijaMm: 22 }),
  },
  {
    id: 'ajna',
    category: 'chakras',
    name: 'Ajna · 2 petals',
    nameHi: 'आज्ञा · २ दल',
    blurb: 'A downward triangle between two petals, seed syllable Om.',
    blurbHi: 'दो दलों के बीच अधोमुख त्रिकोण, बीज ॐ।',
    make: () => chakraDesign('Ajna', 2, 'हं क्षं', 'ॐ', [polygonFigure('tri', 3, { rotationDeg: 180, radius: 0.9 })], { tipAtTop: false, height: 0.8, letterMm: 16 }),
  },
  {
    id: 'sahasrara',
    category: 'chakras',
    name: 'Sahasrara · 1000 petals',
    nameHi: 'सहस्रार · १००० दल',
    blurb: 'The thousand-petalled lotus: twenty rings of fifty petals. The heaviest design here.',
    blurbHi: 'सहस्रदल कमल: पचास-पचास दलों के बीस वलय। यहाँ की सबसे भारी रचना।',
    make: () =>
      createDesign({
        name: 'Sahasrara',
        sizeMm: 600,
        centre: [circleFigure('ci', 0.5, { lineMm: 0.3 })],
        bindu: { visible: true, radius: 0.03, style: 'ringdot' },
        triangles: { visible: true, lineMm: 0.3, lines: 1, lineGapMm: 1.2 },
        bands: [
          circleBand('c0', { lineMm: 0.3 }),
          ...Array.from({ length: 20 }, (_, i) => lotusBand(`s${i}`, 50, { lineMm: 0.3, height: 0.1, fullness: 0.7, tip: 0.5, tipAtTop: i % 2 === 0 })),
        ],
      }),
  },
  {
    id: 'navagraha',
    category: 'numbers',
    name: 'Nine Planets',
    nameHi: 'नवग्रह यन्त्र',
    blurb: 'Nine three-by-three squares, the Sun in the middle. Each planet adds one more to every cell: totals 15 to 39.',
    blurbHi: 'नौ ग्रहों के नौ यन्त्र, मध्य में सूर्य। प्रत्येक ग्रह के अंक एक-एक बढ़ते हैं: योग १५ से ३९।',
    make: () => {
      // Budha Shukra Chandra / Guru Surya Mangal / Ketu Shani Rahu
      const add = [[3, 5, 1], [4, 0, 2], [8, 6, 7]];
      const cells: number[] = [];
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push(graha(add[Math.floor(r / 3)][Math.floor(c / 3)])[(r % 3) * 3 + (c % 3)]);
      return createDesign({
        name: 'Navagraha Yantra',
        sizeMm: 300,
        centre: [gridFigure('g1', 9, 9, cells, { size: 1.9, textSizeMm: 9, blocks: 3 })],
        bindu: noBindu,
        bands: [],
        style: { ...PAPERS.copper },
      });
    },
  },
  {
    id: 'mangala21',
    category: 'numbers',
    name: 'Triangle of Twenty-One',
    nameHi: 'इक्कीस त्रिकोण',
    blurb: 'A triangle cut into twenty-one small triangles around a central one, as on old Mangala (Mars) yantras.',
    blurbHi: 'एक केन्द्रीय त्रिकोण के चारों ओर इक्कीस छोटे त्रिकोण — प्राचीन मङ्गल यन्त्रों जैसा।',
    make: () =>
      createDesign({
        name: 'Mangala Yantra',
        centre: [latticeFigure('lat', 5, { hollow: 2, radius: 1.15 })],
        bindu: noBindu,
        bands: [],
        text: { visible: true, font: 'tiro', color: null, sets: [], custom: [textAt('ॐ', 20)] },
        style: { ...PAPERS.vermilion },
      }),
  },
  {
    id: 'rashi',
    category: 'numbers',
    name: 'Wheel of Signs and Stars',
    nameHi: 'राशि-नक्षत्र चक्र',
    blurb: 'Twelve signs inside, twenty-seven lunar mansions outside, each name in its own sector.',
    blurbHi: 'भीतर बारह राशियाँ, बाहर सत्ताईस नक्षत्र — प्रत्येक नाम अपने खण्ड में।',
    make: () =>
      createDesign({
        name: 'Rashi Nakshatra Chakra',
        sizeMm: 420,
        centre: [
          circleFigure('hub', 0.3),
          raysFigure('rashi', 12, { inner: 0.3, outer: 1 }),
          circleFigure('mid', 1),
          raysFigure('nak', 27, { inner: 1, outer: 1.5 }),
          circleFigure('rim', 1.5, { count: 2, spacing: 0.04 }),
        ],
        bindu: noBindu,
        bands: [],
        text: {
          visible: true, font: 'tiro', color: null, custom: [textAt('ॐ', 22)],
          sets: [
            labelsOn('band:rashi', 'Twelve signs', words('मेष वृषभ मिथुन कर्क सिंह कन्या तुला वृश्चिक धनु मकर कुम्भ मीन'), { sizeMm: 9, orient: 'tangent' }),
            labelsOn('band:nak', 'Twenty-seven stars', words('अश्विनी भरणी कृत्तिका रोहिणी मृगशिरा आर्द्रा पुनर्वसु पुष्य आश्लेषा मघा पूर्वाफाल्गुनी उत्तराफाल्गुनी हस्त चित्रा स्वाती विशाखा अनुराधा ज्येष्ठा मूल पूर्वाषाढा उत्तराषाढा श्रवण धनिष्ठा शतभिषा पूर्वाभाद्रपदा उत्तराभाद्रपदा रेवती'), { sizeMm: 6, orient: 'radial', angleDeg: -90, fit: false }),
          ],
        },
      }),
  },
  {
    id: 'kundali',
    category: 'numbers',
    name: 'Twelve Houses',
    nameHi: 'कुण्डली (द्वादश भाव)',
    blurb: 'The northern birth-chart frame: a square, its diagonals and a diamond make twelve houses.',
    blurbHi: 'उत्तर भारतीय कुण्डली: चतुरस्र, उसके कर्ण और एक समचतुर्भुज से बारह भाव।',
    make: () => {
      const h = Math.SQRT1_2;
      const at: [number, number][] = [[0, -0.5], [-0.5, -0.8], [-0.8, -0.5], [-0.5, 0], [-0.8, 0.5], [-0.5, 0.8], [0, 0.5], [0.5, 0.8], [0.8, 0.5], [0.5, 0], [0.8, -0.5], [0.5, -0.8]];
      return createDesign({
        name: 'Kundali',
        sizeMm: 200,
        centre: [polygonFigure('sq', 4, { rotationDeg: 45, radius: 1 }), polygonFigure('dia', 4, { radius: h }), polygonFigure('x', 4, { step: 2, rotationDeg: 45, radius: 1 })],
        bindu: noBindu,
        bands: [],
        text: { visible: true, font: 'noto-sans', color: null, sets: [], custom: at.map(([x, y], i) => textAt(toDevanagariNumber(i + 1), 7, x * h, y * h)) },
        style: { ...PAPERS.white },
      });
    },
  },
  {
    id: 'vastu',
    category: 'numbers',
    name: 'Eighty-One Squares',
    nameHi: 'इक्यासी पद मण्डल',
    blurb: 'The nine-by-nine ground plan of the Vastu mandala, Brahma holding the nine middle squares as one, the rest empty for you to fill.',
    blurbHi: 'वास्तु मण्डल का नौ-गुणा-नौ पद विन्यास, भरने के लिए रिक्त, मध्य में ब्रह्मा।',
    make: () =>
      createDesign({
        name: 'Vastu Mandala',
        sizeMm: 300,
        centre: [gridFigure('g1', 9, 9, Array.from({ length: 81 }, (_, i) => (i === 30 ? 'ब्रह्मा' : '')), { size: 1.9, textSizeMm: 8, merges: [{ row: 3, col: 3, rows: 3, cols: 3 }] })],
        bindu: noBindu,
        bands: [],
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
    id: 'ratios',
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
