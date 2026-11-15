/** A triangle of any shape: stated exactly by lengths, by angles or by its three sides, and placed anywhere. */
import { useState } from 'react';
import { APEX_ANGLES, shapeFromApexAngle, shapeFromBaseAngles, shapeFromSides, triangleMetrics, trianglePoints, type TriangleShape } from '../../core';
import type { TriangleFigure, TrianglePivot } from '../../core/types';
import { useT, type TFn, type TKey } from '../i18n';
import { Row, Block, Chips } from '../components/List';
import { NumberField } from '../components/NumberField';
import { Segmented } from '../components/Segmented';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { FillRow, LineWeight, OrbitControls, updFig } from './CentrePanel';

const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const PIVOTS: TrianglePivot[] = ['centroid', 'incentre', 'circumcentre', 'base', 'apex'];

export function triangleName(f: TriangleFigure, t: TFn): string {
  if (f.label) return f.label;
  const m = triangleMetrics(trianglePoints(f));
  return t(`fig.tri.${m.kind}` as TKey);
}

type Make = 'equilateral' | 'isosceles' | 'right' | 'other';

export function TriangleControls({ f, unitMm, extent }: { f: TriangleFigure; unitMm: number; extent: number }) {
  const t = useT();
  const [refused, setRefused] = useState<'angles' | 'sides' | null>(null);
  const pts = trianglePoints(f);
  const m = triangleMetrics(pts);
  const mm = (v: number) => v * unitMm;
  const upd = (fn: (x: TriangleFigure) => void, key?: string) => updFig<TriangleFigure>(f.id, fn, key);
  const setShape = (s: TriangleShape | null, kind: 'angles' | 'sides') => {
    if (!s || !(s.height > 1e-5) || !Number.isFinite(s.skew)) {
      setRefused(kind);
      return;
    }
    setRefused(null);
    upd((x) => { x.base = s.base; x.height = s.height; x.skew = s.skew; });
  };

  const make: Make = m.kind === 'equilateral' ? 'equilateral' : m.kind === 'isosceles' && Math.abs(f.skew) < 1e-9 ? 'isosceles' : m.kind === 'right' || m.kind === 'rightIsosceles' ? 'right' : 'other';
  const up = Math.abs(norm(f.rotationDeg)) < 1e-9;
  const down = Math.abs(Math.abs(norm(f.rotationDeg)) - 180) < 1e-9;
  const span = Math.max(2.5, extent);

  // moving the pinned point must not move the triangle: restate (x, y) as the place of the new point
  const setPivot = (pivot: TrianglePivot) => {
    const at =
      pivot === 'base' ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pivot === 'apex' ? pts[2] : pivot === 'incentre' ? m.incentre : pivot === 'circumcentre' ? m.circumcentre : m.centroid;
    upd((x) => { x.pivot = pivot; x.x = at.x; x.y = at.y; });
  };

  return (
    <>
      <Block>
        <div className="row-label">{t('tri.measures')}</div>
        <table className="tri-table">
          <tbody>
            <tr>
              <th scope="row">{t('tri.angle.apex')}</th>
              <td>{m.apexDeg.toFixed(3)}°</td>
              <th scope="row">{t('tri.side.base')}</th>
              <td>{mm(m.base).toFixed(2)} mm</td>
            </tr>
            <tr>
              <th scope="row">{t('tri.angle.left')}</th>
              <td>{m.leftDeg.toFixed(3)}°</td>
              <th scope="row">{t('tri.side.left')}</th>
              <td>{mm(m.left).toFixed(2)} mm</td>
            </tr>
            <tr>
              <th scope="row">{t('tri.angle.right')}</th>
              <td>{m.rightDeg.toFixed(3)}°</td>
              <th scope="row">{t('tri.side.right')}</th>
              <td>{mm(m.right).toFixed(2)} mm</td>
            </tr>
          </tbody>
        </table>
        <p className="row-hint">
          {t(`fig.tri.${m.kind}` as TKey)}
          {m.obtuse ? ` · ${t('tri.obtuse')}` : ''} · {t('tri.inradius')} {mm(m.inradius).toFixed(2)} mm · {t('tri.circumradius')} {mm(m.circumradius).toFixed(2)} mm
        </p>
      </Block>

      <Block>
        <Chips<Make>
          label={t('tri.make')}
          value={make}
          onChange={(k) => {
            if (k === 'equilateral') upd((x) => { x.height = (x.base * Math.sqrt(3)) / 2; x.skew = 0; });
            else if (k === 'isosceles') upd((x) => { x.skew = 0; if (Math.abs(x.height - (x.base * Math.sqrt(3)) / 2) < 1e-9) x.height = x.base * 1.2; });
            else if (k === 'right') upd((x) => { x.skew = -1; });
          }}
          options={[
            { value: 'equilateral', label: t('tri.make.equilateral') },
            { value: 'isosceles', label: t('tri.make.isosceles') },
            { value: 'right', label: t('tri.make.right') },
          ]}
        />
      </Block>

      <Block>
        <SliderRow label={t('tri.base')} value={f.base} min={0.02} max={span * 2} step={0.005} numeric={{ digits: 3, suffix: 'mm', scale: unitMm }} onChange={(v) => upd((x) => { x.base = v; }, 'base')} />
      </Block>
      <Block>
        <SliderRow label={t('tri.height')} value={f.height} min={0.02} max={span * 2} step={0.005} numeric={{ digits: 3, suffix: 'mm', scale: unitMm }} onChange={(v) => upd((x) => { x.height = v; }, 'height')} />
      </Block>
      <Block>
        <SliderRow
          label={t('tri.skew')}
          value={f.skew}
          min={-2}
          max={2}
          step={0.01}
          numeric={{ digits: 2, suffix: '%', scale: 100 }}
          hint={t('tri.skewHint')}
          onChange={(v) => upd((x) => { x.skew = v; }, 'skew')}
        />
      </Block>

      <Block>
        <div className="row-label">{t('tri.byAngles')}</div>
        <div className="num-grid">
          <label>
            <span>{t('tri.angle.apex')}</span>
            <NumberField
              label={t('tri.angle.apex')}
              value={m.apexDeg}
              min={0.5}
              max={179}
              digits={4}
              suffix="°"
              onChange={(v) =>
                // an isosceles triangle stays isosceles; otherwise the left angle is kept and the right one gives way
                setShape(Math.abs(f.skew) < 1e-9 ? shapeFromApexAngle(f.base, v) : shapeFromBaseAngles(f.base, m.leftDeg, 180 - v - m.leftDeg), 'angles')
              }
            />
          </label>
          <label>
            <span>{t('tri.angle.left')}</span>
            <NumberField label={t('tri.angle.left')} value={m.leftDeg} min={0.5} max={179} digits={4} suffix="°" onChange={(v) => setShape(shapeFromBaseAngles(f.base, v, m.rightDeg), 'angles')} />
          </label>
          <label>
            <span>{t('tri.angle.right')}</span>
            <NumberField label={t('tri.angle.right')} value={m.rightDeg} min={0.5} max={179} digits={4} suffix="°" onChange={(v) => setShape(shapeFromBaseAngles(f.base, m.leftDeg, v), 'angles')} />
          </label>
        </div>
        {refused === 'angles' && <p className="row-hint is-warn">{t('tri.cannotAngles')}</p>}
        <p className="row-hint">{t('tri.byAnglesHint')}</p>
        <Chips<number>
          label={t('tri.apexPresets')}
          value={Math.abs(f.skew) < 1e-9 ? (APEX_ANGLES.find((a) => Math.abs(a.deg - m.apexDeg) < 1e-6)?.deg ?? null) : null}
          onChange={(v) => setShape(shapeFromApexAngle(f.base, v), 'angles')}
          options={APEX_ANGLES.map((a) => ({ value: a.deg, label: t(`apex.${a.key}` as TKey) }))}
        />
      </Block>

      <Block>
        <div className="row-label">{t('tri.bySides')}</div>
        <div className="num-grid">
          <label>
            <span>{t('tri.side.base')}</span>
            <NumberField label={t('tri.side.base')} value={mm(m.base)} min={0.1} max={mm(span * 4)} digits={3} suffix="mm" onChange={(v) => setShape(shapeFromSides(v / unitMm, m.left, m.right), 'sides')} />
          </label>
          <label>
            <span>{t('tri.side.left')}</span>
            <NumberField label={t('tri.side.left')} value={mm(m.left)} min={0.1} max={mm(span * 4)} digits={3} suffix="mm" onChange={(v) => setShape(shapeFromSides(m.base, v / unitMm, m.right), 'sides')} />
          </label>
          <label>
            <span>{t('tri.side.right')}</span>
            <NumberField label={t('tri.side.right')} value={mm(m.right)} min={0.1} max={mm(span * 4)} digits={3} suffix="mm" onChange={(v) => setShape(shapeFromSides(m.base, m.left, v / unitMm), 'sides')} />
          </label>
        </div>
        {refused === 'sides' && <p className="row-hint is-warn">{t('tri.cannot')}</p>}
      </Block>

      <Block>
        <Chips<TrianglePivot> label={t('tri.pivot')} value={f.pivot} onChange={setPivot} options={PIVOTS.map((p) => ({ value: p, label: t(`pivot.${p}` as TKey) }))} />
        <p className="row-hint">{t('tri.pivotHint')}</p>
      </Block>
      <Block>
        <SliderRow label={t('tri.x')} value={f.x} min={-span} max={span} step={0.005} numeric={{ digits: 3, suffix: 'mm', scale: unitMm }} onChange={(v) => upd((x) => { x.x = v; }, 'x')} />
      </Block>
      <Block>
        {/* the drawing's y grows downward; people think of "up" as positive */}
        <SliderRow label={t('tri.y')} value={-f.y} min={-span} max={span} step={0.005} numeric={{ digits: 3, suffix: 'mm', scale: unitMm }} onChange={(v) => upd((x) => { x.y = -v; }, 'y')} />
        <button type="button" className="text-btn small" disabled={f.x === 0 && f.y === 0} onClick={() => upd((x) => { x.x = 0; x.y = 0; })}>
          {t('tri.centre')}
        </button>
      </Block>

      <Block>
        <Segmented<'up' | 'down' | 'other'>
          label={t('poly.direction')}
          value={up ? 'up' : down ? 'down' : 'other'}
          onChange={(v) => { if (v !== 'other') upd((x) => { x.rotationDeg = v === 'up' ? 0 : 180; }); }}
          options={[
            { value: 'up', label: `▲ ${t('poly.up')}` },
            { value: 'down', label: `▼ ${t('poly.down')}` },
          ]}
        />
      </Block>
      <Block>
        <SliderRow label={t('poly.turn')} value={norm(f.rotationDeg)} min={-180} max={180} step={0.5} numeric={{ digits: 3, suffix: '°' }} onChange={(v) => upd((x) => { x.rotationDeg = v; }, 'turn')} />
      </Block>

      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
      <Row label={t('shape.parallel')}>
        <Stepper label={t('shape.parallel')} value={f.lines} min={1} max={3} onChange={(v) => upd((x) => { x.lines = v; })} />
      </Row>
      {f.lines > 1 && (
        <Block>
          <SliderRow label={t('shape.parallelGap')} value={f.lineGapMm} min={0.2} max={10} step={0.05} log display={`${f.lineGapMm.toFixed(2)} mm`} onChange={(v) => upd((x) => { x.lineGapMm = v; }, 'gap')} />
        </Block>
      )}
      <FillRow id={f.id} fill={f.fill} />
    </>
  );
}
