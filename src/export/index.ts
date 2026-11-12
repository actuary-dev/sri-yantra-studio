/**
 * EXPORT — SVG, PDF, PNG and DXF output of a Scene at true physical size.
 */
import type { Scene } from '../core/types';
import { computePlacement } from './layout';
import { sceneToSvg } from './svg';
import { sceneToDxf } from './dxf';
import { sceneToPdf } from './pdf';
import { sceneToPng, pngPixelSize } from './png';
import { PAGE_SIZES } from './sizes';
import type { ExportOptions } from './types';

export type { ExportFormat, ExportOptions, PageSize, Placement } from './types';
export { PAGE_SIZES, sceneToSvg, sceneToDxf, sceneToPdf, sceneToPng, pngPixelSize };
export { computePlacement, filteredPrims } from './layout';

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'pdf', page: null, marginMm: 10, fitToPage: false, lineOnly: false, hairline: false,
  includeText: true, includeGuides: false, background: true, mirror: false, dpi: 300,
};

export function sanitiseFileName(name: string): string {
  const s = name.replace(/[^\p{L}\p{N}\p{M} _-]/gu, '').replace(/\s+/g, ' ').trim();
  return s || 'sri-yantra';
}

const MIME = { svg: 'image/svg+xml', pdf: 'application/pdf', png: 'image/png', dxf: 'application/dxf' } as const;

/** Produce the file for any format. `baseName` has no extension. */
export async function exportScene(scene: Scene, opts: ExportOptions, baseName: string): Promise<{ blob: Blob; filename: string }> {
  const pl = computePlacement(scene, opts);
  const size = Math.round(2 * scene.extent * pl.scale);
  const filename = `${sanitiseFileName(baseName)} ${size}mm.${opts.format}`;
  let blob: Blob;
  switch (opts.format) {
    case 'svg': blob = new Blob([sceneToSvg(scene, opts)], { type: MIME.svg }); break;
    case 'dxf': blob = new Blob([sceneToDxf(scene, opts)], { type: MIME.dxf }); break;
    case 'pdf': blob = new Blob([(await sceneToPdf(scene, opts)) as BlobPart], { type: MIME.pdf }); break;
    case 'png': blob = await sceneToPng(scene, opts); break;
    default: throw new Error(`Unknown export format: ${String(opts.format)}`);
  }
  return { blob, filename };
}

/** Hand the file to the user: Web Share sheet on phones/tablets when available, otherwise a download. */
export async function deliver(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return 'shared';
      }
    }
  } catch { /* fall through to download */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
