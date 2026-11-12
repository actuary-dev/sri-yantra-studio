import type { Scene } from '../core/types';

export type ExportFormat = 'svg' | 'pdf' | 'png' | 'dxf';

export interface ExportOptions {
  format: ExportFormat;
  /** sheet size in mm; null = a square just large enough for the yantra plus margins */
  page: { widthMm: number; heightMm: number } | null;
  marginMm: number;
  /** true = scale the yantra to fill the page inside the margins; false = keep the design's own size (scene.unitMm) */
  fitToPage: boolean;
  /** engraving mode: no fills, no background, every stroke pure black */
  lineOnly: boolean;
  /** all strokes become 0.05 mm hairlines (laser / CNC centre-line work) */
  hairline: boolean;
  includeText: boolean;
  includeGuides: boolean;
  /** paint the paper colour behind the drawing (ignored when lineOnly) */
  background: boolean;
  /** mirror left-right (for reverse engraving, stamps, glass) */
  mirror: boolean;
  /** PNG resolution */
  dpi: number;
}

export interface PageSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface Placement {
  pageW: number;
  pageH: number;
  /** mm per scene unit */
  scale: number;
  /** mm position of the scene origin */
  cx: number;
  cy: number;
}

export type { Scene };
