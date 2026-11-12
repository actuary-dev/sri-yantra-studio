/**
 * Sri Yantra Studio — shared contracts.
 *
 * COORDINATES (read this first)
 *  - "Scene units": the circle that circumscribes the nine triangles has radius 1,
 *    centred on the origin. x grows to the RIGHT, y grows DOWN (SVG convention).
 *  - Angles in the Scene are in degrees, 0 = +x (right), growing CLOCKWISE on
 *    screen (because y is down). "Up" on screen is -90.
 *  - Physical size: `scene.unitMm` millimetres per scene unit. Stroke widths are
 *    always stored in millimetres (`strokeMm`); divide by `unitMm` to get units.
 */

/* ------------------------------------------------------------------ paths */

export type PathCmd =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z'];

export interface Paint {
  /** CSS colour or null for no stroke */
  stroke: string | null;
  /** stroke width in millimetres on the finished piece */
  strokeMm: number;
  /** CSS colour or null for no fill */
  fill: string | null;
}

interface PrimBase {
  /** layer id: 'cells' | 'triangles' | 'bindu' | 'guides' | 'text' | `band:<bandId>` */
  layer: string;
  /** free-form tag for debugging/selecting, e.g. 'triangle:3', 'cell:1:7', 'petal:4' */
  role?: string;
}

export interface PathPrim extends PrimBase {
  kind: 'path';
  d: PathCmd[];
  paint: Paint;
}

export interface CirclePrim extends PrimBase {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  paint: Paint;
}

export type FontId = 'tiro' | 'noto-sans' | 'noto-serif';

export interface TextPrim extends PrimBase {
  kind: 'text';
  /** stable id, e.g. 'set:<setId>:<index>' or 'custom:<id>' or 'ring:<bandId>' */
  id: string;
  text: string;
  /** centre of the text block (straight text). Ignored when `arc` is set. */
  x: number;
  y: number;
  /** em size in scene units */
  size: number;
  /** rotation in degrees, clockwise on screen, about (x, y) */
  angle: number;
  font: FontId;
  fill: string;
  /**
   * Text set along a circle centred on the origin. Glyphs sit with their
   * baseline on radius `r`; the string is centred on `centerDeg`.
   * `inward: false` = tops of letters point away from the centre (read
   * clockwise along the top); `inward: true` = tops point to the centre.
   * `repeat: true` repeats the string (plus `separator`) to fill 360°.
   */
  arc?: { r: number; centerDeg: number; inward: boolean; repeat: boolean; separator: string };
  /**
   * Filled glyph outlines in scene units, final position (already rotated and
   * translated). Produced by the text module (`resolveText`). When absent the
   * renderer may fall back to a native <text> element on screen.
   */
  outline?: PathCmd[];
}

export type Prim = PathPrim | CirclePrim | TextPrim;

/* ---------------------------------------------------------------- anchors */

/**
 * A place where a label can be attached.
 * Groups:
 *  'bindu' (1) · 'ring1' (14 outer cells) · 'ring2' (10) · 'ring3' (10) ·
 *  'ring4' (8) · 'ring5' (1 central triangle) · 'marma' (18 three-line points) ·
 *  'sandhi' (two-line points) · `band:<id>` (petals / beads of that band) ·
 *  'gates' (4) · 'corners' (4)
 * Within a group, anchors are ordered starting at the bottom of the screen and
 * proceeding anticlockwise as seen on screen (bottom → right → top → left),
 * except 'marma' and 'sandhi' which run top-to-bottom, left-to-right.
 */
export interface Anchor {
  id: string; // `${group}:${index}`
  group: string;
  index: number;
  x: number;
  y: number;
  /** radius of the largest circle centred here that stays inside its cell/petal (free space hint, scene units) */
  r: number;
  /** direction pointing away from the yantra centre (or the direction a cell points), degrees clockwise from +x */
  outDeg: number;
}

/* ----------------------------------------------------------------- design */

export type Goal = 'free' | 'centered' | 'equilateral' | 'optimal';

/**
 * The nine-triangle figure has exactly four degrees of freedom (Huet 2002).
 * We expose them as the heights of four base lines, given as a fraction of the
 * circle's diameter measured from the BOTTOM (0) to the TOP (1), for the
 * standard orientation (central triangle pointing down).
 *   ravi  — base of the topmost downward triangle      (~0.887)
 *   kuja  — base of the great downward triangle        (~0.668)
 *   shani — base of the great upward triangle          (~0.398)
 *   ketu  — base of the lowest upward triangle         (~0.165)
 * `goal` adds optional perfection criteria; the solver then determines some of
 * the four values itself:
 *   'free'        — all four used as given
 *   'centered'    — bindu at the exact centre of the circle (shani is solved)
 *   'equilateral' — central triangle equilateral (kuja is solved)
 *   'optimal'     — both (kuja and shani are solved)
 */
export interface GeometrySpec {
  ravi: number;
  kuja: number;
  shani: number;
  ketu: number;
  goal: Goal;
  /** true = mirrored vertically: central triangle points UP */
  flip: boolean;
}

interface BandBase {
  id: string;
  visible: boolean;
  /** empty space between the previous band's outer radius and this band, scene units */
  gap: number;
  /** line weight in mm */
  lineMm: number;
}

export interface CircleBand extends BandBase {
  type: 'circle';
  /** number of concentric circles (1–6) */
  count: number;
  /** spacing between them, scene units */
  spacing: number;
}

export type PetalShape = 'classic' | 'pointed' | 'round' | 'flame' | 'lotus';

export interface LotusBand extends BandBase {
  type: 'lotus';
  petals: number; // 4–128
  /** radial height of the petals, scene units */
  height: number;
  shape: PetalShape;
  /** 0..1 how wide/plump each petal is */
  fullness: number;
  /** 0..1 how sharp the tip is */
  tip: number;
  /** true = a petal tip points straight up; false = a gap between petals is at the top */
  tipAtTop: boolean;
  /** 1 = single row; 2 = a second row of petal tips peeking out between the first */
  rows: 1 | 2;
  /** extra inset outlines inside each petal (0–3) */
  insets: number;
  /** draw a centre vein line in each petal */
  vein: boolean;
  /** fill colour used when fills are on, or null */
  fill: string | null;
}

export type BeadShape = 'circle' | 'diamond' | 'dot' | 'triangle';

export interface BeadBand extends BandBase {
  type: 'beads';
  count: number;
  /** bead radius, scene units (band height = 2 × size) */
  size: number;
  shape: BeadShape;
  fill: string | null;
}

export interface TextRingBand extends BandBase {
  type: 'textRing';
  text: string;
  /** letter height (em), scene units; band height ≈ 1.5 × size */
  size: number;
  font: FontId;
  repeat: boolean;
  separator: string;
  /** tops of letters toward the centre */
  inward: boolean;
}

export type GateStyle = 'classic' | 'plain' | 'stepped';

export interface BhupuraBand extends BandBase {
  type: 'bhupura';
  /** number of parallel lines (1–4); tradition uses 3 */
  lines: number;
  /** spacing between the lines, scene units */
  spacing: number;
  /** width of the gate opening as a fraction of the square's side (0.1–0.6) */
  gateWidth: number;
  /** how far the gate projects outward, scene units */
  gateDepth: number;
  /** width of the gate's outer "T" bar relative to the opening (1–2.2) */
  gateFlare: number;
  style: GateStyle;
  fill: string | null;
}

export type Band = CircleBand | LotusBand | BeadBand | TextRingBand | BhupuraBand;

export type Orient = 'upright' | 'radial' | 'tangent' | 'fixed';

export interface LabelOverride {
  text?: string;
  sizeMm?: number;
  /** added to the computed angle */
  angleDeg?: number;
  /** nudge in scene units */
  dx?: number;
  dy?: number;
  hidden?: boolean;
}

export interface LabelSet {
  id: string;
  name: string;
  visible: boolean;
  /** anchor group this set attaches to */
  group: string;
  /** texts[i] goes to the i-th anchor after applying `start` and `clockwise` */
  texts: string[];
  /** letter size in mm on the finished piece */
  sizeMm: number;
  /** shrink any label that would not fit inside its cell */
  fit: boolean;
  orient: Orient;
  /** extra rotation (for 'fixed' this is the whole angle), degrees clockwise */
  angleDeg: number;
  /** shift along the outward direction, scene units (+ = away from centre) */
  offset: number;
  /** rotate the starting anchor */
  start: number;
  /** traverse anchors clockwise instead of the default anticlockwise */
  clockwise: boolean;
  overrides: Record<number, LabelOverride>;
}

export interface CustomLabel {
  id: string;
  text: string;
  /** scene units */
  x: number;
  y: number;
  sizeMm: number;
  angleDeg: number;
}

export interface TextSpec {
  /** master switch — false hides every label, mantra ring text is governed by its band */
  visible: boolean;
  font: FontId;
  /** null = use the ink colour */
  color: string | null;
  sets: LabelSet[];
  custom: CustomLabel[];
}

export interface Design {
  schema: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** finished overall width (outermost edge to outermost edge), millimetres */
  sizeMm: number;
  geometry: GeometrySpec;
  triangles: {
    visible: boolean;
    lineMm: number;
    /** 1 = single line; 2–3 draws inset parallel outlines inside each of the nine triangles */
    lines: number;
    /** gap between those parallel outlines, mm */
    lineGapMm: number;
  };
  cells: {
    /** colour the 43 triangles ring by ring */
    filled: boolean;
    /** [ring1 (outer 14), ring2, ring3, ring4, ring5 (centre)] */
    palette: [string, string, string, string, string];
    /** ornamental nested outlines inside each of the 43 cells (0–3) */
    insets: number;
    insetGapMm: number;
  };
  bindu: { visible: boolean; /** scene units */ radius: number; style: 'dot' | 'ring' | 'ringdot' };
  /** ordered from the triangle circle outwards */
  bands: Band[];
  text: TextSpec;
  style: { ink: string; paper: string };
  guides: { marma: boolean; sandhi: boolean; axes: boolean };
}

/* ------------------------------------------------------------------ scene */

export interface TriangleInfo {
  name: string;
  sanskrit: string;
  up: boolean;
  /** base height as fraction of diameter from bottom (standard orientation) */
  height: number;
  /** half width of the base, scene units */
  halfWidth: number;
  apexAngleDeg: number;
  baseAngleDeg: number;
}

export interface GeometryReport {
  ok: boolean;
  /** largest distance (scene units) by which any of the 18 triple intersections fails to close */
  concurrencyError: number;
  /** number of cells per ring; a true Sri Yantra gives [14, 10, 10, 8, 1] */
  ringCounts: number[];
  marmaCount: number;
  sandhiCount: number;
  /** bindu height above the circle centre as a fraction of the radius (standard orientation; + = above) */
  binduOffset: number;
  /** apex angle of the central triangle in degrees (60 = equilateral) */
  centralAngleDeg: number;
  /** the four parameters actually used after applying `goal` */
  resolved: { ravi: number; kuja: number; shani: number; ketu: number };
  triangles: TriangleInfo[];
}

export interface Scene {
  /** drawing order: first = bottom */
  prims: Prim[];
  /** the drawing fits in the square [-extent, extent]² */
  extent: number;
  /** millimetres per scene unit */
  unitMm: number;
  anchors: Anchor[];
  report: GeometryReport;
  ink: string;
  paper: string;
}
