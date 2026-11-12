import type { PageSize } from './types';

const IN = 25.4;
const sq = (inches: number): PageSize => ({
  id: `plate-${inches}in`,
  label: `Square plate ${inches} in (${(inches * IN).toFixed(1)} mm)`,
  widthMm: +(inches * IN).toFixed(1),
  heightMm: +(inches * IN).toFixed(1),
});

export const PAGE_SIZES: PageSize[] = [
  { id: 'a5', label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'a4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'a2', label: 'A2 (420 × 594 mm)', widthMm: 420, heightMm: 594 },
  { id: 'a1', label: 'A1 (594 × 841 mm)', widthMm: 594, heightMm: 841 },
  { id: 'a0', label: 'A0 (841 × 1189 mm)', widthMm: 841, heightMm: 1189 },
  { id: 'b2', label: 'B2 (500 × 707 mm)', widthMm: 500, heightMm: 707 },
  { id: 'b1', label: 'B1 (707 × 1000 mm)', widthMm: 707, heightMm: 1000 },
  { id: 'b0', label: 'B0 (1000 × 1414 mm)', widthMm: 1000, heightMm: 1414 },
  { id: 'us-letter', label: 'US Letter (8.5 × 11 in)', widthMm: 215.9, heightMm: 279.4 },
  { id: 'us-tabloid', label: 'US Tabloid (11 × 17 in)', widthMm: 279.4, heightMm: 431.8 },
  { id: 'arch-d', label: 'Arch D (24 × 36 in)', widthMm: 609.6, heightMm: 914.4 },
  { id: 'arch-e', label: 'Arch E (36 × 48 in)', widthMm: 914.4, heightMm: 1219.2 },
  { id: 'chart-paper-full', label: 'Chart paper 56×71 cm (full imperial)', widthMm: 560, heightMm: 710 },
  { id: 'chart-paper-half', label: 'Half chart 35.5×56 cm', widthMm: 355, heightMm: 560 },
  sq(3), sq(4), sq(6), sq(9), sq(12), sq(18), sq(24),
];
