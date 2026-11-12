import {
  PDFDocument, PDFOperator, PDFOperatorNames, PDFNumber,
  moveTo, lineTo, appendBezierCurve, closePath, stroke, fill, fillAndStroke,
  setLineWidth, setLineJoin, setLineCap, LineJoinStyle, LineCapStyle,
  setStrokingRgbColor, setFillingRgbColor,
  pushGraphicsState, popGraphicsState,
} from 'pdf-lib';
import type { PathCmd } from '../core/types';
import { buildItems, circleAsPath, computePlacement } from './layout';
import type { ExportOptions, Scene } from './types';

const PT = 72 / 25.4;

/** CSS hex (#rgb / #rrggbb) to 0..1 rgb; anything else is black. */
export function parseColour(c: string | null | undefined): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((c ?? '').trim());
  if (!m) return [0, 0, 0];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

export async function sceneToPdf(scene: Scene, opts: ExportOptions): Promise<Uint8Array> {
  const pl = computePlacement(scene, opts);
  const items = buildItems(scene, opts, pl);
  const doc = await PDFDocument.create();
  doc.setTitle('Sri Yantra');
  doc.setCreator('Sri Yantra Studio');
  doc.setProducer('Sri Yantra Studio');
  const page = doc.addPage([pl.pageW * PT, pl.pageH * PT]);
  const X = (x: number) => r4(x * PT);
  const Y = (y: number) => r4((pl.pageH - y) * PT);
  const ops: PDFOperator[] = [];

  if (opts.background && !opts.lineOnly) {
    const [r, g, b] = parseColour(scene.paper);
    const w = r4(pl.pageW * PT), h = r4(pl.pageH * PT);
    ops.push(pushGraphicsState(), setFillingRgbColor(r, g, b),
      moveTo(0, 0), lineTo(w, 0), lineTo(w, h), lineTo(0, h), closePath(), fill(), popGraphicsState());
  }

  const pathOps = (d: PathCmd[]) => {
    let x = 0, y = 0;
    for (const c of d) {
      if (c[0] === 'M') { ops.push(moveTo(X(c[1]), Y(c[2]))); x = c[1]; y = c[2]; }
      else if (c[0] === 'L') { ops.push(lineTo(X(c[1]), Y(c[2]))); x = c[1]; y = c[2]; }
      else if (c[0] === 'Q') {
        const c1x = x + (2 / 3) * (c[1] - x), c1y = y + (2 / 3) * (c[2] - y);
        const c2x = c[3] + (2 / 3) * (c[1] - c[3]), c2y = c[4] + (2 / 3) * (c[2] - c[4]);
        ops.push(appendBezierCurve(X(c1x), Y(c1y), X(c2x), Y(c2y), X(c[3]), Y(c[4])));
        x = c[3]; y = c[4];
      } else if (c[0] === 'C') {
        ops.push(appendBezierCurve(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6])));
        x = c[5]; y = c[6];
      } else ops.push(closePath());
    }
  };

  for (const it of items) {
    if (it.kind === 'text') continue; // no native-text fallback in PDF
    const hasFill = !!it.fill, hasStroke = !!it.stroke && it.strokeMm > 0;
    if (!hasFill && !hasStroke) continue;
    ops.push(pushGraphicsState());
    if (hasFill) { const [r, g, b] = parseColour(it.fill); ops.push(setFillingRgbColor(r, g, b)); }
    if (hasStroke) {
      const [r, g, b] = parseColour(it.stroke);
      ops.push(setStrokingRgbColor(r, g, b), setLineWidth(r4(it.strokeMm * PT)),
        setLineJoin(it.miter ? LineJoinStyle.Miter : LineJoinStyle.Round),
        setLineCap(it.miter ? LineCapStyle.Butt : LineCapStyle.Round));
      if (it.miter) ops.push(PDFOperator.of(PDFOperatorNames.SetLineMiterLimit, [PDFNumber.of(10)]));
    }
    pathOps(it.kind === 'circle' ? circleAsPath(it.cx, it.cy, it.r) : it.d);
    const evenodd = it.kind === 'path' && it.evenodd;
    if (hasFill && hasStroke) ops.push(evenodd ? PDFOperator.of(PDFOperatorNames.FillEvenOddAndStroke) : fillAndStroke());
    else if (hasFill) ops.push(evenodd ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : fill());
    else ops.push(stroke());
    ops.push(popGraphicsState());
  }
  page.pushOperators(...ops);
  return await doc.save();
}
