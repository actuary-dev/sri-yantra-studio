/**
 * TEXT — Sanskrit labels: label-set catalogue, label layout, Devanagari shaping
 * to outlines (HarfBuzz), transliteration.
 */
export type { ShapedText, Shaper, LabelKind } from './types';
export { LABEL_KINDS, createLabelSet, buildLabels, measureText } from './labels';
export { loadShaper, loadShaperNode, FONT_FILES, parseSvgPath } from './shaper';
export { resolveText } from './resolve';
export { transliterate, toDevanagariNumber, QUICK_INSERTS } from './translit';
