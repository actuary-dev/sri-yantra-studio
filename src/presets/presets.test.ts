import { describe, expect, it } from 'vitest';
import { buildScene } from '../core/scene';
import { DEFAULT_EXPORT, sceneToDxf, sceneToPdf, sceneToSvg } from '../export';
import { loadShaper } from '../text';
import { PRESETS } from './index';

declare const process: { env: Record<string, string | undefined> };

describe('every starting design', () => {
  it('is a true Sri Yantra and exports in every vector format', async () => {
    const shaper = await loadShaper();
    const dump = process.env.DUMP_DIR;
    for (const p of PRESETS) {
      const design = p.make();
      const scene = buildScene(design, shaper);
      expect(scene.report.ok, p.id).toBe(true);
      expect(scene.report.ringCounts, p.id).toEqual([14, 10, 10, 8, 1]);
      expect(scene.report.marmaCount, p.id).toBe(18);
      expect(scene.report.concurrencyError * scene.unitMm, p.id).toBeLessThan(1e-6); // mm
      expect(Number.isFinite(scene.extent)).toBe(true);
      // every text primitive got real outlines
      for (const prim of scene.prims) if (prim.kind === 'text') expect(prim.outline && prim.outline.length > 0, `${p.id} ${prim.id}`).toBe(true);
      // text can be switched off in one move
      const off = buildScene({ ...design, text: { ...design.text, visible: false } }, shaper);
      expect(off.prims.filter((q) => q.layer === 'text').length, p.id).toBe(0);

      const svg = sceneToSvg(scene, DEFAULT_EXPORT);
      expect(svg.includes('NaN'), p.id).toBe(false);
      const dxf = sceneToDxf(scene, { ...DEFAULT_EXPORT, format: 'dxf', lineOnly: true });
      expect(dxf.includes('NaN'), p.id).toBe(false);
      const pdf = await sceneToPdf(scene, { ...DEFAULT_EXPORT, format: 'pdf' });
      expect(pdf.length).toBeGreaterThan(1000);
      if (dump) {
        const nodeFs = 'node:fs';
        const fs = (await import(/* @vite-ignore */ nodeFs)) as { writeFileSync(path: string, data: string | Uint8Array): void };
        fs.writeFileSync(`${dump}/${p.id}.svg`, svg);
        fs.writeFileSync(`${dump}/${p.id}.dxf`, dxf);
        fs.writeFileSync(`${dump}/${p.id}.pdf`, pdf);
      }
    }
  }, 60000);
});
