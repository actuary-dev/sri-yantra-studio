/** Turn TextPrims into filled glyph outlines (straight or along a circle). */
import type { PathCmd, Scene, TextPrim } from '../core/types';
import { rotationMatrix, transformPath } from '../core/path';
import type { Shaper } from './types';

function straightOutline(t: TextPrim, shaper: Shaper): PathCmd[] {
  const sh = shaper.shape(t.text, t.font);
  if (!sh.path.length) return [];
  const s = t.size;
  const mid = (sh.top + sh.bottom) / 2;
  const placed = transformPath(sh.path, [s, 0, 0, s, t.x - (s * sh.width) / 2, t.y - s * mid]);
  return t.angle ? transformPath(placed, rotationMatrix(t.angle, t.x, t.y)) : placed;
}

function arcOutline(t: TextPrim, shaper: Shaper): PathCmd[] {
  const arc = t.arc!;
  const r = arc.r;
  if (!(r > 0)) return [];
  const circ = 2 * Math.PI * r;
  const dir = arc.inward ? -1 : 1;
  let size = t.size;

  const unitText = arc.repeat ? t.text + arc.separator : t.text;
  const sh = shaper.shape(unitText, t.font);
  if (!sh.clusters.length || sh.width <= 0) return [];

  // total advance must fit on the circle
  if (sh.width * size > circ) size = circ / sh.width;
  const unitLen = sh.width * size;

  let reps = 1;
  let gap = 0;
  if (arc.repeat) {
    reps = Math.max(1, Math.floor(circ / unitLen));
    gap = (circ - reps * unitLen) / reps;
  }
  const total = arc.repeat ? circ : unitLen;

  const out: PathCmd[] = [];
  for (let k = 0; k < reps; k++) {
    // arc-length offset of this repetition's start, measured from the string origin
    const base = k * (unitLen + gap);
    for (const c of sh.clusters) {
      if (!c.path.length) continue;
      const u = base + (c.x + c.width / 2) * size - total / 2 + (arc.repeat ? total / 2 : 0);
      const theta = (arc.centerDeg * Math.PI) / 180 + (dir * u) / r;
      const cs = Math.cos(theta), sn = Math.sin(theta);
      const nx = cs, ny = sn; // outward
      // advance direction t and glyph-up direction U
      const tx = dir * -sn, ty = dir * cs;
      const ux = arc.inward ? -nx : nx, uy = arc.inward ? -ny : ny;
      const half = (c.width * size) / 2;
      const m: [number, number, number, number, number, number] = [
        size * tx, size * ty, -size * ux, -size * uy,
        r * cs - half * tx, r * sn - half * ty,
      ];
      out.push(...transformPath(c.path, m));
    }
  }
  return out;
}

/** Return a new Scene whose TextPrims carry `outline`. The input is not mutated. */
export function resolveText(scene: Scene, shaper: Shaper): Scene {
  const prims = scene.prims.map((p) => {
    if (p.kind !== 'text') return p;
    const outline = p.arc ? arcOutline(p, shaper) : straightOutline(p, shaper);
    return { ...p, outline };
  });
  return { ...scene, prims };
}
