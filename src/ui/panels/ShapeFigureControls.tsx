/** Exact settings for a free triangle or square: kind, direction, sizes and position in millimetres. */
import { apexAngle, isTriangle, isTriangleLock, normaliseShape, shapeCorners, shapeFacts } from '../../core';
import type { ShapeFigure, ShapeLock } from '../../core/types';
import { putShapes } from '../shapeOps';
import { setEditorUI } from '../runtime';
import { useT, type TKey } from '../i18n';
import { Row, Block, Chips } from '../components/List';
import { NumberField } from '../components/NumberField';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { ColorWell } from '../components/ColorWell';
import { Icon } from '../components/Icon';

const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const near = (a: number, b: number) => Math.abs(norm(a - b)) < 1e-6;

export const LOCK_GLYPH: Record<ShapeLock, string> = { equilateral: '▲', isosceles: '⏶', right: '◣', free: '◭', square: '■', rect: '▬' };

function put(f: ShapeFigure, patch: Partial<ShapeFigure>, key?: string) {
  putShapes([normaliseShape({ ...f, ...patch })], key ? `shape:${f.id}:${key}` : undefined);
}

export function shapeName(f: ShapeFigure, t: (k: TKey) => string): string {
  const kind = t(`lock.${f.lock}` as TKey);
  if (!isTriangle(f)) return near(f.rotationDeg % 90, 45) && f.lock === 'square' ? t('lock.diamond') : kind;
  const dir = near(f.rotationDeg, 0) ? ' ▲' : near(f.rotationDeg, 180) ? ' ▼' : near(f.rotationDeg, 90) ? ' ▶' : near(f.rotationDeg, -90) ? ' ◀' : '';
  return kind + dir;
}

export function ShapeFigureControls({ f, unitMm }: { f: ShapeFigure; unitMm: number }) {
  const t = useT();
  const tri = isTriangle(f);
  const mm = (v: number) => v * unitMm;
  const un = (v: number) => v / unitMm;
  const rot = norm(f.rotationDeg);
  const vertical = Math.abs(Math.sin((f.rotationDeg * Math.PI) / 180)) < 1e-9;
  // with the axis vertical: σ = +1 apex up, −1 apex down
  const sigma = Math.cos((f.rotationDeg * Math.PI) / 180) > 0 ? 1 : -1;
  const apexY = f.y - (sigma * f.h) / 2;
  const baseY = f.y + (sigma * f.h) / 2;
  const facts = shapeFacts(f);
  const maxMm = Math.max(5000, mm(10));

  const setLock = (lock: ShapeLock) => {
    if (lock === f.lock) return;
    const next = { ...f, lock };
    if (isTriangleLock(lock) !== tri) next.h = lock === 'square' || lock === 'equilateral' ? f.w : f.w * (tri ? 1 : 0.8);
    put(next, {});
  };

  /** Move one edge of the box (apex or base for a triangle) to height `yUp` (mm, up = +), keeping the other edge. */
  const setEdge = (which: 'apex' | 'base', yUpMm: number) => {
    const y = -un(yUpMm);
    const other = which === 'apex' ? baseY : apexY;
    const h = Math.abs(other - y);
    if (h < 1e-4) return;
    // the apex side decides which way the triangle points
    const apex = which === 'apex' ? y : apexY;
    const base = which === 'apex' ? baseY : y;
    const rotationDeg = apex < base ? 0 : 180;
    const w = f.lock === 'equilateral' ? (2 * h) / Math.sqrt(3) : f.lock === 'square' ? h : f.w;
    put(f, { h, w, y: (apex + base) / 2, rotationDeg });
  };

  const fields = (
    <>
      {(f.lock === 'equilateral' || f.lock === 'square') && (
        <Row label={t('shapeF.side')}>
          <NumberField label={t('shapeF.side')} value={mm(f.w)} min={0.1} max={maxMm} digits={2} suffix="mm" onChange={(v) => put(f, { w: un(v) })} />
        </Row>
      )}
      {f.lock !== 'equilateral' && f.lock !== 'square' && (
        <>
          <Row label={tri ? t('shapeF.base') : t('shapeF.width')}>
            <NumberField label={t('shapeF.base')} value={mm(f.w)} min={0.1} max={maxMm} digits={2} suffix="mm" onChange={(v) => put(f, { w: un(v) })} />
          </Row>
          <Row label={t('shapeF.height')}>
            <NumberField label={t('shapeF.height')} value={mm(f.h)} min={0.1} max={maxMm} digits={2} suffix="mm" onChange={(v) => put(f, { h: un(v) })} />
          </Row>
        </>
      )}
      {f.lock === 'isosceles' && (
        <Row label={t('shapeF.apexAngle')} sub={t('shapeF.apexAngleSub')}>
          <NumberField
            label={t('shapeF.apexAngle')}
            value={apexAngle(f)}
            min={1}
            max={178}
            digits={3}
            suffix="°"
            onChange={(v) => put(f, { w: 2 * f.h * Math.tan(((v / 2) * Math.PI) / 180) })}
          />
        </Row>
      )}
      {f.lock === 'free' && (
        <Block>
          <SliderRow
            label={t('shapeF.apexAt')}
            value={f.skew}
            min={-1}
            max={1}
            step={0.001}
            display={`${(f.skew * 100).toFixed(1)} %`}
            onChange={(v) => put(f, { skew: v }, 'skew')}
          />
        </Block>
      )}
    </>
  );

  return (
    <>
      <Block>
        <Chips<ShapeLock>
          label={t('shapeF.kind')}
          value={f.lock}
          onChange={setLock}
          options={(['equilateral', 'isosceles', 'right', 'free', 'square', 'rect'] as ShapeLock[]).map((l) => ({
            value: l,
            label: `${LOCK_GLYPH[l]} ${t(`lock.${l}` as TKey)}`,
          }))}
        />
      </Block>
      <Block>
        <div className="row-label">{t('shapeF.direction')}</div>
        <Chips<number>
          label={t('shapeF.direction')}
          value={[0, 180, 90, -90, 45, -45].find((a) => near(rot, a)) ?? null}
          onChange={(a) => put(f, { rotationDeg: a })}
          options={
            tri
              ? [
                  { value: 0, label: `▲ ${t('poly.up')}` },
                  { value: 180, label: `▼ ${t('poly.down')}` },
                  { value: -90, label: '◀' , aria: t('shapeF.left') },
                  { value: 90, label: '▶', aria: t('shapeF.right') },
                ]
              : [
                  { value: 0, label: `■ ${t('shapeF.straight')}` },
                  { value: 45, label: `◆ ${t('shapeF.onCorner')}` },
                ]
          }
        />
      </Block>
      <Block>
        <SliderRow
          label={t('poly.turn')}
          value={rot}
          min={-180}
          max={180}
          step={0.5}
          numeric={{ digits: 3, suffix: '°' }}
          onChange={(v) => put(f, { rotationDeg: v }, 'turn')}
        />
      </Block>
      {fields}
      <Row label={t('shapeF.x')} sub={t('shapeF.xSub')}>
        <NumberField label={t('shapeF.x')} value={mm(f.x)} min={-maxMm} max={maxMm} digits={2} suffix="mm" onChange={(v) => put(f, { x: un(v) })} />
      </Row>
      {tri && vertical ? (
        <>
          <Row label={t('shapeF.apexY')} sub={t('shapeF.ySub')}>
            <NumberField label={t('shapeF.apexY')} value={-mm(apexY)} min={-maxMm} max={maxMm} digits={2} suffix="mm" onChange={(v) => setEdge('apex', v)} />
          </Row>
          <Row label={t('shapeF.baseY')}>
            <NumberField label={t('shapeF.baseY')} value={-mm(baseY)} min={-maxMm} max={maxMm} digits={2} suffix="mm" onChange={(v) => setEdge('base', v)} />
          </Row>
        </>
      ) : (
        <Row label={t('shapeF.y')} sub={t('shapeF.ySub')}>
          <NumberField label={t('shapeF.y')} value={-mm(f.y)} min={-maxMm} max={maxMm} digits={2} suffix="mm" onChange={(v) => put(f, { y: -un(v) })} />
        </Row>
      )}
      <div className="band-actions">
        <button type="button" className="pill-btn" onClick={() => put(f, { x: f.x - (shapeCorners(f).reduce((s, p) => s + p.x, 0) / shapeCorners(f).length) })}>
          {t('shapeF.centreLR')}
        </button>
        <button type="button" className="pill-btn" onClick={() => put(f, { x: 0, y: 0 })}>
          {t('shapeF.centreBox')}
        </button>
        <button type="button" className="pill-btn" onClick={() => setEditorUI({ arrangeOpen: true, sel: [f.id] })}>
          <Icon name="copies" size={18} /> {t('sel.copies')}
        </button>
      </div>
      <p className="row-hint" style={{ margin: '4px 16px 10px' }}>
        {t('shapeF.facts', {
          a: facts.angles.map((a) => `${+a.toFixed(2)}°`).join(' · '),
          s: facts.sides.map((v) => (v * unitMm).toFixed(1)).join(' · '),
        })}
      </p>
      {tri && (
        <Row label={t('shapeF.rows')} sub={t('shapeF.rowsSub', { n: Math.round(f.rows) ** 2 })}>
          <Stepper label={t('shapeF.rows')} value={Math.round(f.rows)} min={1} max={16} onChange={(v) => put(f, { rows: v })} />
        </Row>
      )}
      <Block>
        <SliderRow
          label={t('common.lineWeight')}
          value={f.lineMm}
          min={0.05}
          max={5}
          step={0.01}
          log
          display={`${f.lineMm.toFixed(2)} mm`}
          onChange={(v) => put(f, { lineMm: v }, 'line')}
        />
      </Block>
      <Row label={t('shape.parallel')}>
        <Stepper label={t('shape.parallel')} value={f.lines} min={1} max={3} onChange={(v) => put(f, { lines: v })} />
      </Row>
      {f.lines > 1 && (
        <Block>
          <SliderRow
            label={t('shape.parallelGap')}
            value={f.lineGapMm}
            min={0.2}
            max={10}
            step={0.05}
            log
            display={`${f.lineGapMm.toFixed(2)} mm`}
            onChange={(v) => put(f, { lineGapMm: v }, 'gap')}
          />
        </Block>
      )}
      <Row label={t('poly.fill')} sub={f.fill ? undefined : t('rings.noFill')}>
        <div className="inline-controls">
          {f.fill && <ColorWell value={f.fill} onChange={(v) => put(f, { fill: v }, 'fill')} label={t('poly.fill')} />}
          <Switch label={t('poly.fill')} checked={!!f.fill} onChange={(on) => put(f, { fill: on ? '#e8c15a' : null })} />
        </div>
      </Row>
    </>
  );
}
