import { computePlacement } from './layout';
import { sceneToSvg } from './svg';
import type { ExportOptions, Scene } from './types';

export const MAX_SIDE = 16384;
export const MAX_AREA = 120_000_000;
export const MAX_AREA_TOUCH = 64_000_000;

/** Pixel size a PNG export would have; `clamped` is true when it had to be reduced to stay within browser canvas limits. */
export function pngPixelSize(scene: Scene, opts: ExportOptions): { width: number; height: number; clamped: boolean } {
  const pl = computePlacement(scene, opts);
  const dpi = opts.dpi > 0 ? opts.dpi : 300;
  const w = (pl.pageW / 25.4) * dpi, h = (pl.pageH / 25.4) * dpi;
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  const maxArea = touch ? MAX_AREA_TOUCH : MAX_AREA;
  let s = 1;
  s = Math.min(s, MAX_SIDE / Math.max(w, h, 1e-9));
  s = Math.min(s, Math.sqrt(maxArea / Math.max(w * h, 1e-9)));
  const width = Math.max(1, Math.floor(w * s));
  const height = Math.max(1, Math.floor(h * s));
  return { width, height, clamped: s < 1 };
}

/** Browser only. */
export async function sceneToPng(scene: Scene, opts: ExportOptions): Promise<Blob> {
  const { width, height } = pngPixelSize(scene, opts);
  const svg = sceneToSvg(scene, opts);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the drawing to an image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`Could not allocate a ${width}x${height} px canvas; try a lower DPI or smaller page.`);
    ctx.fillStyle = opts.background && !opts.lineOnly ? scene.paper : '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error(`PNG export failed: the browser could not create a ${width}x${height} px image. Try a lower DPI or smaller page.`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
