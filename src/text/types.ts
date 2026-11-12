import type { FontId, PathCmd } from '../core/types';

export interface ShapedText {
  /** filled glyph outlines for the whole string at em size 1, y DOWN, baseline at y = 0, starting at x = 0 */
  path: PathCmd[];
  /** total advance width in em */
  width: number;
  /** ink bounds in em (y down) */
  top: number;
  bottom: number;
  /** per grapheme-cluster outlines and x extents, for laying text on a circle */
  clusters: { path: PathCmd[]; x: number; width: number }[];
}

export interface Shaper {
  shape(text: string, font: FontId): ShapedText;
}

export interface LabelKind {
  kind: string;
  name: string;
  nameHi: string;
  /** anchor group it attaches to by default, e.g. 'ring1', 'marma' */
  defaultGroup: string;
  description: string;
}
