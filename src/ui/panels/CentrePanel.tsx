/** CENTRE: the figures at the heart of the yantra — triangles, stars, circles, number squares, the Sri Yantra. */
import { useState } from 'react';
import { angleAt, centreOf, latticeHollow, latticeLines, sriAsTriangles, SYMBOL_NAMES, validMerges } from '../../core';
import type {
  ArcFigure, CentreFigure, CircleFigure, CrescentFigure, FreeFigure, GridFigure, LatticeFigure, LotusFigure, Orbit, PetalShape, PolygonFigure,
  RaysFigure, SriFigure, SymbolFigure, SymbolName, TriangleFigure,
} from '../../core/types';
import { arcFigure, circleFigure, crescentFigure, freeFigure, gridFigure, latticeFigure, lotusFigure, newId, polygonFigure, raysFigure, sriFigure, symbolFigure, triangleFigure } from '../../presets';
import { toDevanagariNumber } from '../../text';
import { updateDesign as update } from '../store';
import { setEditorUI, showToast, useEditorUI } from '../runtime';
import { useT, type TFn, type TKey } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block, Chips, ButtonRow } from '../components/List';
import { Segmented } from '../components/Segmented';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { ColorWell } from '../components/ColorWell';
import { Icon } from '../components/Icon';
import { ActionSheet } from '../components/ActionSheet';
import { NumberField } from '../components/NumberField';
import { BinduGuides, ShapePanel } from './ShapePanel';
import { CheckPanel } from './CheckPanel';
import { TriangleControls, triangleName } from './TrianglePanel';

const GLYPH: Record<CentreFigure['type'], string> = { sri: '✡', polygon: '△', circle: '○', grid: '▦', lotus: '❀', rays: '✳', lattice: '▲', arc: '◠', crescent: '☾', symbol: '卐', free: '✎', triangle: '◺' };

export function updFig<T extends CentreFigure>(id: string, fn: (f: T) => void, coalesceKey?: string) {
  update(
    (d) => {
      d.centre = centreOf(d);
      const f = d.centre.find((x) => x.id === id);
      if (f) fn(f as T);
    },
    coalesceKey ? { coalesceKey: `fig:${id}:${coalesceKey}` } : undefined,
  );
}

const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

function polygonName(f: PolygonFigure, t: TFn): string {
  const rot = Math.abs(norm(f.rotationDeg));
  let base: string;
  if (f.sides === 3 && f.step === 1) base = rot < 1 ? t('fig.triangleUp') : Math.abs(rot - 180) < 1 ? t('fig.triangleDown') : t('fig.triangle');
  else if (f.sides === 4 && f.step === 1) base = t('fig.square');
  else if (f.sides === 6 && f.step === 2) base = t('fig.star6');
  else if (f.sides === 5 && f.step === 2) base = t('fig.star5');
  else if (f.sides === 8 && (f.step === 2 || f.step === 3)) base = t('fig.star8');
  else base = f.step > 1 ? t('fig.starN', { n: f.sides }) : t('fig.polygonN', { n: f.sides });
  return f.nest > 1 ? t('fig.nested', { name: base, n: f.nest }) : base;
}

function figureName(f: CentreFigure, t: TFn): string {
  switch (f.type) {
    case 'sri':
      return t('fig.sri');
    case 'polygon':
      return polygonName(f, t);
    case 'circle':
      return f.count > 1 ? t('fig.circleN', { n: f.count }) : t('fig.circle');
    case 'grid':
      return t('fig.grid', { r: f.rows, c: f.cols });
    case 'lotus':
      return t('band.lotusN', { n: f.petals });
    case 'rays':
      return t('fig.raysN', { n: f.count });
    case 'lattice':
      return t('fig.lattice', { n: latticeLines(f).cells });
    case 'arc':
      return t('fig.arc');
    case 'crescent':
      return t('fig.crescent');
    case 'symbol':
      return t(`symbol.${f.symbol}` as TKey);
    case 'free':
      return t('fig.free', { n: f.points.length });
    case 'triangle':
      return triangleName(f, t);
  }
}

const mmOf = (v: number, unitMm: number) => `${(v * unitMm).toFixed(1)} mm`;

export function LineWeight({ id, value }: { id: string; value: number }) {
  const t = useT();
  return (
    <Block>
      <SliderRow
        label={t('common.lineWeight')}
        value={value}
        min={0.05}
        max={5}
        step={0.01}
        log
        display={`${value.toFixed(2)} mm`}
        onChange={(v) => updFig<Exclude<CentreFigure, SriFigure>>(id, (x) => { x.lineMm = v; }, 'line')}
      />
    </Block>
  );
}

type Quick = 'up' | 'down' | 'square' | 'star6' | 'star5' | 'star8' | 'other';
const QUICK: Record<Exclude<Quick, 'other'>, Pick<PolygonFigure, 'sides' | 'step' | 'rotationDeg'>> = {
  up: { sides: 3, step: 1, rotationDeg: 0 },
  down: { sides: 3, step: 1, rotationDeg: 180 },
  square: { sides: 4, step: 1, rotationDeg: 45 },
  star6: { sides: 6, step: 2, rotationDeg: 0 },
  star5: { sides: 5, step: 2, rotationDeg: 0 },
  star8: { sides: 8, step: 2, rotationDeg: 0 },
};

function quickOf(f: PolygonFigure): Quick {
  for (const k of Object.keys(QUICK) as Exclude<Quick, 'other'>[]) {
    const q = QUICK[k];
    if (q.sides === f.sides && q.step === f.step && Math.abs(norm(f.rotationDeg - q.rotationDeg)) < 0.01) return k;
  }
  return 'other';
}

function PolygonControls({ f, unitMm }: { f: PolygonFigure; unitMm: number }) {
  const t = useT();
  const maxStep = Math.max(1, Math.floor((f.sides - 1) / 2) || 1);
  const pointsDown = Math.abs(Math.abs(norm(f.rotationDeg)) - 180) < 0.01;
  const pointsUp = Math.abs(norm(f.rotationDeg)) < 0.01;
  return (
    <>
      <Block>
        <Chips<Quick>
          label={t('poly.quick')}
          value={quickOf(f)}
          onChange={(k) => {
            if (k === 'other') return;
            updFig<PolygonFigure>(f.id, (x) => Object.assign(x, QUICK[k]));
          }}
          options={[
            { value: 'up', label: '▲', aria: t('fig.triangleUp') },
            { value: 'down', label: '▼', aria: t('fig.triangleDown') },
            { value: 'star6', label: '✡', aria: t('fig.star6') },
            { value: 'star5', label: '★', aria: t('fig.star5') },
            { value: 'square', label: '■', aria: t('fig.square') },
            { value: 'star8', label: '✴', aria: t('fig.star8') },
          ]}
        />
      </Block>
      <Row label={t('poly.corners')}>
        <Stepper
          label={t('poly.corners')}
          value={f.sides}
          min={3}
          max={36}
          onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.sides = v; x.step = Math.min(x.step, Math.max(1, Math.floor((v - 1) / 2))); })}
        />
      </Row>
      {maxStep > 1 && (
        <Row label={t('poly.step')} sub={t('poly.stepHint')}>
          <Stepper label={t('poly.step')} value={Math.min(f.step, maxStep)} min={1} max={maxStep} onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.step = v; })} />
        </Row>
      )}
      <Block>
        <SliderRow
          label={t('poly.size')}
          value={f.radius}
          min={0.03}
          max={2.5}
          step={0.005}
          numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }}
          onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.radius = v; }, 'radius')}
        />
      </Block>
      <Block>
        <Segmented<'up' | 'down' | 'other'>
          label={t('poly.direction')}
          value={pointsUp ? 'up' : pointsDown ? 'down' : 'other'}
          onChange={(v) => { if (v !== 'other') updFig<PolygonFigure>(f.id, (x) => { x.rotationDeg = v === 'up' ? 0 : 180; }); }}
          options={[
            { value: 'up', label: `▲ ${t('poly.up')}` },
            { value: 'down', label: `▼ ${t('poly.down')}` },
          ]}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('poly.turn')}
          value={norm(f.rotationDeg)}
          min={-180}
          max={180}
          step={0.5}
          numeric={{ digits: 3, suffix: '°' }}
          onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.rotationDeg = v; }, 'turn')}
        />
      </Block>
      <Row label={t('poly.tipAngle')} sub={t('poly.tipAngleSub', { n: +(360 / f.sides).toFixed(4) })}>
        <span className="row-value">{+(180 - (360 * Math.min(f.step, maxStep)) / f.sides).toFixed(4)}°</span>
      </Row>
      <Row label={t('poly.copies')} sub={t('poly.copiesSub')}>
        <Stepper label={t('poly.copies')} value={f.nest} min={1} max={12} onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.nest = v; })} />
      </Row>
      {f.nest > 1 && (
        <Block>
          <SliderRow
            label={t('poly.copyRatio')}
            value={f.nestRatio}
            min={0.3}
            max={0.97}
            step={0.005}
            display={`${Math.round(f.nestRatio * 100)} %`}
            onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.nestRatio = v; }, 'ratio')}
          />
        </Block>
      )}
      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
      <Row label={t('shape.parallel')}>
        <Stepper label={t('shape.parallel')} value={f.lines} min={1} max={3} onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.lines = v; })} />
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
            onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.lineGapMm = v; }, 'gap')}
          />
        </Block>
      )}
      <Row label={t('poly.fill')} sub={f.fill ? undefined : t('rings.noFill')}>
        <div className="inline-controls">
          {f.fill && <ColorWell value={f.fill} onChange={(v) => updFig<PolygonFigure>(f.id, (x) => { x.fill = v; }, 'fill')} label={t('poly.fill')} />}
          <Switch label={t('poly.fill')} checked={!!f.fill} onChange={(on) => updFig<PolygonFigure>(f.id, (x) => { x.fill = on ? '#e8c15a' : null; })} />
        </div>
      </Row>
    </>
  );
}

function CircleControls({ f, unitMm }: { f: CircleFigure; unitMm: number }) {
  const t = useT();
  return (
    <>
      <Block>
        <SliderRow
          label={t('poly.size')}
          value={f.radius}
          min={0.02}
          max={2.5}
          step={0.005}
          numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }}
          onChange={(v) => updFig<CircleFigure>(f.id, (x) => { x.radius = v; }, 'radius')}
        />
      </Block>
      <Row label={t('rings.circles')}>
        <Stepper label={t('rings.circles')} value={f.count} min={1} max={6} onChange={(v) => updFig<CircleFigure>(f.id, (x) => { x.count = v; })} />
      </Row>
      {f.count > 1 && (
        <Block>
          <SliderRow
            label={t('rings.spacing')}
            value={f.spacing}
            min={0.005}
            max={0.2}
            step={0.001}
            display={mmOf(f.spacing, unitMm)}
            onChange={(v) => updFig<CircleFigure>(f.id, (x) => { x.spacing = v; }, 'spacing')}
          />
        </Block>
      )}
      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

/** Repeat a figure around the centre (or simply move it off-centre with a count of one). */
export function OrbitControls({ id, orbit, unitMm }: { id: string; orbit: Orbit | undefined; unitMm: number }) {
  const t = useT();
  const count = orbit && orbit.count >= 1 ? Math.round(orbit.count) : 0;
  type Orbiting = PolygonFigure | CircleFigure | ArcFigure | CrescentFigure | SymbolFigure | TriangleFigure;
  return (
    <>
      <Row label={t('orbit.count')} sub={t('orbit.countSub')}>
        <Stepper
          label={t('orbit.count')}
          value={count}
          min={0}
          max={36}
          onChange={(v) =>
            updFig<Orbiting>(id, (x) => {
              if (v <= 0) delete x.orbit;
              else x.orbit = { count: v, radius: x.orbit?.radius ?? 0.6, phaseDeg: x.orbit?.phaseDeg ?? 0 };
            })
          }
        />
      </Row>
      {orbit && count > 0 && (
        <>
          <Block>
            <SliderRow
              label={t('orbit.radius')}
              value={orbit.radius}
              min={0}
              max={2.5}
              step={0.005}
              numeric={{ digits: 2, suffix: 'mm', scale: unitMm }}
              onChange={(v) => updFig<Orbiting>(id, (x) => { if (x.orbit) x.orbit.radius = v; }, 'orbitR')}
            />
          </Block>
          <Block>
            <SliderRow
              label={t('orbit.phase')}
              value={norm(orbit.phaseDeg)}
              min={-180}
              max={180}
              step={0.5}
              numeric={{ digits: 3, suffix: '°' }}
              onChange={(v) => updFig<Orbiting>(id, (x) => { if (x.orbit) x.orbit.phaseDeg = v; }, 'orbitP')}
            />
          </Block>
        </>
      )}
    </>
  );
}

const PETAL_SHAPES: PetalShape[] = ['classic', 'pointed', 'round', 'flame', 'lotus'];

function LotusControls({ f, unitMm }: { f: LotusFigure; unitMm: number }) {
  const t = useT();
  return (
    <>
      <Row label={t('rings.petals')}>
        <Stepper label={t('rings.petals')} value={f.petals} min={2} max={128} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.petals = v; })} />
      </Row>
      <Block>
        <Chips<PetalShape>
          label={t('poly.quick')}
          value={f.shape}
          onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.shape = v; })}
          options={PETAL_SHAPES.map((sh) => ({ value: sh, label: t(`petal.${sh}` as TKey) }))}
        />
      </Block>
      <Block>
        <SliderRow label={t('poly.size')} value={f.radius} min={0.02} max={2.5} step={0.005} numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.radius = v; }, 'radius')} />
      </Block>
      <Block>
        <SliderRow label={t('rings.height')} value={f.height} min={0.02} max={1} step={0.005} display={mmOf(f.height, unitMm)} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.height = v; }, 'height')} />
      </Block>
      <Block>
        <SliderRow label={t('rings.fullness')} value={f.fullness} min={0} max={1} step={0.01} display={`${Math.round(f.fullness * 100)} %`} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.fullness = v; }, 'full')} />
      </Block>
      <Block>
        <SliderRow label={t('rings.tip')} value={f.tip} min={0} max={1} step={0.01} display={`${Math.round(f.tip * 100)} %`} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.tip = v; }, 'tip')} />
      </Block>
      <Row label={t('rings.tipAtTop')}>
        <Switch label={t('rings.tipAtTop')} checked={f.tipAtTop} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.tipAtTop = v; })} />
      </Row>
      <LineWeight id={f.id} value={f.lineMm} />
      <Row label={t('poly.fill')} sub={f.fill ? undefined : t('rings.noFill')}>
        <div className="inline-controls">
          {f.fill && <ColorWell value={f.fill} onChange={(v) => updFig<LotusFigure>(f.id, (x) => { x.fill = v; }, 'fill')} label={t('poly.fill')} />}
          <Switch label={t('poly.fill')} checked={!!f.fill} onChange={(on) => updFig<LotusFigure>(f.id, (x) => { x.fill = on ? '#c0392b' : null; })} />
        </div>
      </Row>
    </>
  );
}

function RaysControls({ f, unitMm }: { f: RaysFigure; unitMm: number }) {
  const t = useT();
  return (
    <>
      <Row label={t('rays.count')}>
        <Stepper label={t('rays.count')} value={f.count} min={1} max={108} onChange={(v) => updFig<RaysFigure>(f.id, (x) => { x.count = v; })} />
      </Row>
      <Block>
        <SliderRow label={t('rays.inner')} value={f.inner} min={0} max={2.5} step={0.005} display={mmOf(f.inner, unitMm)} onChange={(v) => updFig<RaysFigure>(f.id, (x) => { x.inner = Math.min(v, x.outer - 0.01); }, 'inner')} />
      </Block>
      <Block>
        <SliderRow label={t('rays.outer')} value={f.outer} min={0.05} max={2.5} step={0.005} display={mmOf(f.outer, unitMm)} onChange={(v) => updFig<RaysFigure>(f.id, (x) => { x.outer = Math.max(v, x.inner + 0.01); }, 'outer')} />
      </Block>
      <Block>
        <SliderRow label={t('poly.turn')} value={norm(f.rotationDeg)} min={-180} max={180} step={0.5} numeric={{ digits: 3, suffix: '°' }} onChange={(v) => updFig<RaysFigure>(f.id, (x) => { x.rotationDeg = v; }, 'turn')} />
      </Block>
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

function LatticeControls({ f, unitMm }: { f: LatticeFigure; unitMm: number }) {
  const t = useT();
  const hollow = latticeHollow(f.rows, f.hollow);
  const down = Math.abs(Math.abs(norm(f.rotationDeg)) - 180) < 0.01;
  const up = Math.abs(norm(f.rotationDeg)) < 0.01;
  // only some hollow sizes sit on the lattice: step to the next one that fits
  const nextHollow = (dir: 1 | -1) => {
    for (let h = hollow + dir; h >= 0 && h < f.rows; h += dir) if (latticeHollow(f.rows, h) === h) return h;
    return hollow;
  };
  return (
    <>
      <Row label={t('lattice.rows')}>
        <Stepper label={t('lattice.rows')} value={f.rows} min={1} max={16} onChange={(v) => updFig<LatticeFigure>(f.id, (x) => { x.rows = v; x.hollow = latticeHollow(v, x.hollow); })} />
      </Row>
      <Row label={t('lattice.hollow')} sub={t('lattice.hollowSub')}>
        <div className="inline-controls">
          <button type="button" className="pill-btn" aria-label="−" disabled={nextHollow(-1) === hollow} onClick={() => updFig<LatticeFigure>(f.id, (x) => { x.hollow = nextHollow(-1); })}>−</button>
          <span className="row-label" style={{ minWidth: 24, textAlign: 'center' }}>{hollow}</span>
          <button type="button" className="pill-btn" aria-label="+" disabled={nextHollow(1) === hollow} onClick={() => updFig<LatticeFigure>(f.id, (x) => { x.hollow = nextHollow(1); })}>+</button>
        </div>
      </Row>
      <Block>
        <SliderRow label={t('poly.size')} value={f.radius} min={0.05} max={2.5} step={0.005} numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }} onChange={(v) => updFig<LatticeFigure>(f.id, (x) => { x.radius = v; }, 'radius')} />
      </Block>
      <Block>
        <Segmented<'up' | 'down' | 'other'>
          label={t('poly.direction')}
          value={up ? 'up' : down ? 'down' : 'other'}
          onChange={(v) => { if (v !== 'other') updFig<LatticeFigure>(f.id, (x) => { x.rotationDeg = v === 'up' ? 0 : 180; }); }}
          options={[
            { value: 'up', label: `▲ ${t('poly.up')}` },
            { value: 'down', label: `▼ ${t('poly.down')}` },
          ]}
        />
      </Block>
      <Block>
        <SliderRow label={t('poly.turn')} value={norm(f.rotationDeg)} min={-180} max={180} step={0.5} numeric={{ digits: 3, suffix: '°' }} onChange={(v) => updFig<LatticeFigure>(f.id, (x) => { x.rotationDeg = v; }, 'turn')} />
      </Block>
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

export function FillRow({ id, fill }: { id: string; fill: string | null }) {
  const t = useT();
  type Fillable = CrescentFigure | FreeFigure | TriangleFigure;
  return (
    <Row label={t('poly.fill')} sub={fill ? undefined : t('rings.noFill')}>
      <div className="inline-controls">
        {fill && <ColorWell value={fill} onChange={(v) => updFig<Fillable>(id, (x) => { x.fill = v; }, 'fill')} label={t('poly.fill')} />}
        <Switch label={t('poly.fill')} checked={!!fill} onChange={(on) => updFig<Fillable>(id, (x) => { x.fill = on ? '#e8c15a' : null; })} />
      </div>
    </Row>
  );
}

function ArcControls({ f, unitMm }: { f: ArcFigure; unitMm: number }) {
  const t = useT();
  return (
    <>
      <Block>
        <SliderRow label={t('poly.size')} value={f.radius} min={0.02} max={2.5} step={0.005} numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }} onChange={(v) => updFig<ArcFigure>(f.id, (x) => { x.radius = v; }, 'radius')} />
      </Block>
      <Block>
        <SliderRow label={t('arc.start')} value={norm(f.startDeg)} min={-180} max={180} step={1} numeric={{ digits: 2, suffix: '°' }} onChange={(v) => updFig<ArcFigure>(f.id, (x) => { x.startDeg = v; }, 'start')} />
      </Block>
      <Block>
        <SliderRow label={t('arc.sweep')} value={f.sweepDeg} min={5} max={360} step={1} numeric={{ digits: 2, suffix: '°' }} onChange={(v) => updFig<ArcFigure>(f.id, (x) => { x.sweepDeg = v; }, 'sweep')} />
      </Block>
      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

function CrescentControls({ f, unitMm }: { f: CrescentFigure; unitMm: number }) {
  const t = useT();
  const up = Math.abs(norm(f.rotationDeg)) < 0.01;
  const down = Math.abs(Math.abs(norm(f.rotationDeg)) - 180) < 0.01;
  return (
    <>
      <Block>
        <SliderRow label={t('poly.size')} value={f.radius} min={0.02} max={2.5} step={0.005} numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }} onChange={(v) => updFig<CrescentFigure>(f.id, (x) => { x.radius = v; }, 'radius')} />
      </Block>
      <Block>
        <SliderRow label={t('crescent.thickness')} value={f.thickness} min={0.03} max={1.6} step={0.01} display={mmOf(f.thickness * f.radius, unitMm)} onChange={(v) => updFig<CrescentFigure>(f.id, (x) => { x.thickness = v; }, 'thick')} />
      </Block>
      <Block>
        <SliderRow label={t('crescent.inner')} value={f.inner} min={0.5} max={1.5} step={0.01} display={`${Math.round(f.inner * 100)} %`} onChange={(v) => updFig<CrescentFigure>(f.id, (x) => { x.inner = v; }, 'inner')} />
      </Block>
      <Block>
        <Segmented<'up' | 'down' | 'other'>
          label={t('poly.direction')}
          value={up ? 'up' : down ? 'down' : 'other'}
          onChange={(v) => { if (v !== 'other') updFig<CrescentFigure>(f.id, (x) => { x.rotationDeg = v === 'up' ? 0 : 180; }); }}
          options={[
            { value: 'up', label: t('crescent.up') },
            { value: 'down', label: t('crescent.down') },
          ]}
        />
      </Block>
      <Block>
        <SliderRow label={t('poly.turn')} value={norm(f.rotationDeg)} min={-180} max={180} step={0.5} numeric={{ digits: 3, suffix: '°' }} onChange={(v) => updFig<CrescentFigure>(f.id, (x) => { x.rotationDeg = v; }, 'turn')} />
      </Block>
      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
      <FillRow id={f.id} fill={f.fill} />
    </>
  );
}

function SymbolControls({ f, unitMm }: { f: SymbolFigure; unitMm: number }) {
  const t = useT();
  return (
    <>
      <Block>
        <Chips<SymbolName>
          label={t('poly.quick')}
          value={f.symbol}
          onChange={(v) => updFig<SymbolFigure>(f.id, (x) => { x.symbol = v; })}
          options={SYMBOL_NAMES.map((n) => ({ value: n, label: t(`symbol.${n}` as TKey) }))}
        />
      </Block>
      <Block>
        <SliderRow label={t('poly.size')} value={f.size} min={0.02} max={1.5} step={0.005} display={mmOf(f.size * 2, unitMm)} onChange={(v) => updFig<SymbolFigure>(f.id, (x) => { x.size = v; }, 'size')} />
      </Block>
      <Block>
        <SliderRow label={t('poly.turn')} value={norm(f.rotationDeg)} min={-180} max={180} step={0.5} numeric={{ digits: 3, suffix: '°' }} onChange={(v) => updFig<SymbolFigure>(f.id, (x) => { x.rotationDeg = v; }, 'turn')} />
      </Block>
      <OrbitControls id={f.id} orbit={f.orbit} unitMm={unitMm} />
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

const SNAPS = [0, 15, 22.5, 30, 45];

function FreeControls({ f, unitMm }: { f: FreeFigure; unitMm: number }) {
  const t = useT();
  const snap = useEditorUI((s) => s.drawSnapDeg);
  const n = f.points.length;
  return (
    <>
      <p className="row-hint" style={{ margin: '4px 16px 8px' }}>{t('free.hint')}</p>
      <ButtonRow accent icon={<Icon name="pin" />} label={t('free.draw')} sub={`${t('free.points')}: ${f.points.length}`} onClick={() => setEditorUI({ drawFigureId: f.id })} />
      <div className="band-actions">
        <button type="button" className="pill-btn" disabled={f.points.length === 0} onClick={() => updFig<FreeFigure>(f.id, (x) => { x.points.pop(); })}>
          {t('free.undo')}
        </button>
        <button type="button" className="pill-btn is-destructive" disabled={f.points.length === 0} onClick={() => updFig<FreeFigure>(f.id, (x) => { x.points = []; })}>
          {t('free.clear')}
        </button>
      </div>
      <Block>
        <Chips<number> label={t('free.snap')} value={snap} onChange={(v) => setEditorUI({ drawSnapDeg: v })} options={SNAPS.map((d) => ({ value: d, label: d === 0 ? t('free.snapOff') : `${d}°` }))} />
        <p className="row-hint">{t('free.snap')}</p>
      </Block>
      {n > 0 && (
        <Block>
          <div className="row-label">{t('free.coords')}</div>
          <p className="row-hint">{t('free.coordsHint')}</p>
          {f.points.map((q, i) => {
            const prev = f.points[(i - 1 + n) % n], next = f.points[(i + 1) % n];
            const inner = n >= 3 && (f.closed || (i > 0 && i < n - 1));
            return (
              <div key={i} className="num-grid num-grid--point">
                <span className="band-index">{i + 1}</span>
                <NumberField label={`${i + 1} · ${t('tri.x')}`} value={q.x * unitMm} min={-5000} max={5000} digits={3} suffix="mm" onChange={(v) => updFig<FreeFigure>(f.id, (x) => { x.points[i].x = v / unitMm; })} />
                <NumberField label={`${i + 1} · ${t('tri.y')}`} value={-q.y * unitMm} min={-5000} max={5000} digits={3} suffix="mm" onChange={(v) => updFig<FreeFigure>(f.id, (x) => { x.points[i].y = -v / unitMm; })} />
                <span className="row-sub">{inner ? `∠ ${angleAt(q, prev, next).toFixed(2)}°` : ''}</span>
              </div>
            );
          })}
        </Block>
      )}
      <Row label={t('free.closed')}>
        <Switch label={t('free.closed')} checked={f.closed} onChange={(v) => updFig<FreeFigure>(f.id, (x) => { x.closed = v; })} />
      </Row>
      <Row label={t('free.repeat')}>
        <Stepper label={t('free.repeat')} value={f.repeat} min={1} max={36} onChange={(v) => updFig<FreeFigure>(f.id, (x) => { x.repeat = v; })} />
      </Row>
      <LineWeight id={f.id} value={f.lineMm} />
      <FillRow id={f.id} fill={f.fill} />
    </>
  );
}

/** Join a block of cells into one (for a centre square such as Brahma's place in the Vastu mandala). */
function MergeControls({ f }: { f: GridFigure }) {
  const t = useT();
  const [row, setRow] = useState(1);
  const [col, setCol] = useState(1);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const merges = validMerges(f.merges, f.rows, f.cols);
  const candidate = { row: row - 1, col: col - 1, rows, cols };
  const fits = validMerges([...merges, candidate], f.rows, f.cols).length === merges.length + 1;
  return (
    <Block>
      <div className="row-label">{t('grid.join')}</div>
      {merges.map((m, i) => (
        <div key={i} className="inline-controls" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
          <span className="row-sub">{t('grid.joinFrom', { r: m.row + 1, c: m.col + 1, h: m.rows, w: m.cols })}</span>
          <button type="button" className="pill-btn is-destructive" onClick={() => updFig<GridFigure>(f.id, (x) => { x.merges = merges.filter((_, k) => k !== i); })}>
            <Icon name="trash" size={16} /> {t('common.delete')}
          </button>
        </div>
      ))}
      <Row label={t('grid.joinRow')}>
        <Stepper label={t('grid.joinRow')} value={Math.min(row, f.rows)} min={1} max={f.rows} onChange={setRow} />
      </Row>
      <Row label={t('grid.joinCol')}>
        <Stepper label={t('grid.joinCol')} value={Math.min(col, f.cols)} min={1} max={f.cols} onChange={setCol} />
      </Row>
      <Row label={t('grid.joinRows')}>
        <Stepper label={t('grid.joinRows')} value={rows} min={1} max={f.rows} onChange={setRows} />
      </Row>
      <Row label={t('grid.joinCols')}>
        <Stepper label={t('grid.joinCols')} value={cols} min={1} max={f.cols} onChange={setCols} />
      </Row>
      <button type="button" className="text-btn small" disabled={!fits} onClick={() => updFig<GridFigure>(f.id, (x) => { x.merges = [...merges, candidate]; })}>
        {t('grid.joinAdd')}
      </button>
    </Block>
  );
}

const DEVA = '०१२३४५६७८९';
const toLatinDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEVA.indexOf(d)));
const toDevaDigits = (s: string) => s.replace(/[0-9]/g, (d) => DEVA[Number(d)]);

/** The common sum of all rows, columns and diagonals, or null when they differ or a cell is not a number. */
export function magicSum(texts: string[], rows: number, cols: number): number | null {
  const v: number[] = [];
  for (let i = 0; i < rows * cols; i++) {
    const raw = toLatinDigits((texts[i] ?? '').trim());
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
    v.push(Number(raw));
  }
  const sums: number[] = [];
  for (let r = 0; r < rows; r++) sums.push(v.slice(r * cols, r * cols + cols).reduce((a, b) => a + b, 0));
  for (let c = 0; c < cols; c++) { let s = 0; for (let r = 0; r < rows; r++) s += v[r * cols + c]; sums.push(s); }
  if (rows === cols) {
    let d1 = 0, d2 = 0;
    for (let i = 0; i < rows; i++) { d1 += v[i * cols + i]; d2 += v[i * cols + (cols - 1 - i)]; }
    sums.push(d1, d2);
  }
  return sums.every((s) => Math.abs(s - sums[0]) < 1e-9) ? sums[0] : null;
}

/** Further facts about a number square: does it use 1…n once each, and do the broken diagonals add up too? */
export function gridFacts(texts: string[], rows: number, cols: number): { normal: boolean; pandiagonal: boolean } {
  const sum = magicSum(texts, rows, cols);
  if (sum === null || rows !== cols) return { normal: false, pandiagonal: false };
  const n = rows;
  const v = texts.slice(0, n * n).map((s) => Number(toLatinDigits((s ?? '').trim())));
  const normal = [...v].sort((a, b) => a - b).every((x, i) => x === i + 1);
  let pandiagonal = n >= 4;
  for (let k = 0; k < n && pandiagonal; k++) {
    let d1 = 0, d2 = 0;
    for (let i = 0; i < n; i++) { d1 += v[i * n + ((i + k) % n)]; d2 += v[i * n + ((k - i + n) % n)]; }
    if (Math.abs(d1 - sum) > 1e-9 || Math.abs(d2 - sum) > 1e-9) pandiagonal = false;
  }
  return { normal, pandiagonal };
}

function GridControls({ f, unitMm }: { f: GridFigure; unitMm: number }) {
  const t = useT();
  const resize = (rows: number, cols: number) =>
    updFig<GridFigure>(f.id, (x) => {
      const next: string[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) next.push(r < x.rows && c < x.cols ? x.texts[r * x.cols + c] ?? '' : '');
      x.rows = rows;
      x.cols = cols;
      x.texts = next;
    });
  const sum = magicSum(f.texts, f.rows, f.cols);
  const facts = gridFacts(f.texts, f.rows, f.cols);
  const allFilled = f.texts.slice(0, f.rows * f.cols).every((s) => (s ?? '').trim() !== '');
  const usesDeva = f.texts.some((s) => /[०-९]/.test(s ?? ''));
  return (
    <>
      <Row label={t('grid.rows')}>
        <Stepper label={t('grid.rows')} value={f.rows} min={1} max={9} onChange={(v) => resize(v, f.cols)} />
      </Row>
      <Row label={t('grid.cols')}>
        <Stepper label={t('grid.cols')} value={f.cols} min={1} max={9} onChange={(v) => resize(f.rows, v)} />
      </Row>
      <Block>
        <div className="row-label">{t('grid.cells')}</div>
        <div className="letter-grid" style={{ gridTemplateColumns: `repeat(${f.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: f.rows * f.cols }, (_, i) => (
            <div key={i} className="letter-cell">
              <input
                className="text-input deva"
                lang="sa"
                inputMode="text"
                aria-label={`${Math.floor(i / f.cols) + 1}, ${(i % f.cols) + 1}`}
                value={f.texts[i] ?? ''}
                onChange={(e) => updFig<GridFigure>(f.id, (x) => { x.texts[i] = e.target.value; }, `cell:${i}`)}
              />
            </div>
          ))}
        </div>
        {allFilled && sum !== null && (
          <p className="row-hint">
            ✓ {t('grid.sumsOk', { n: usesDeva ? toDevanagariNumber(sum) : sum })}
            {facts.normal ? ` ${t('grid.normal', { n: f.rows * f.cols })}` : ''}
            {facts.pandiagonal ? ` ${t('grid.pandiagonal')}` : ''}
          </p>
        )}
        {allFilled && sum === null && f.texts.slice(0, f.rows * f.cols).every((s) => /^[\d०-९.\-\s]+$/.test(s ?? '')) && (
          <p className="row-hint">{t('grid.sumsDiffer')}</p>
        )}
        <button type="button" className="text-btn small" onClick={() => updFig<GridFigure>(f.id, (x) => { x.texts = x.texts.map(usesDeva ? toLatinDigits : toDevaDigits); })}>
          {usesDeva ? t('grid.toLatin') : t('grid.toDeva')}
        </button>
      </Block>
      <MergeControls f={f} />
      <Block>
        <SliderRow
          label={t('grid.size')}
          value={f.size}
          min={0.1}
          max={3}
          step={0.005}
          display={mmOf(f.size, unitMm)}
          onChange={(v) => updFig<GridFigure>(f.id, (x) => { x.size = v; }, 'size')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('grid.textSize')}
          value={f.textSizeMm}
          min={1}
          max={80}
          step={0.5}
          log
          display={`${f.textSizeMm.toFixed(1)} mm`}
          onChange={(v) => updFig<GridFigure>(f.id, (x) => { x.textSizeMm = v; }, 'text')}
        />
      </Block>
      <LineWeight id={f.id} value={f.lineMm} />
    </>
  );
}

function SriControls({ f, unitMm, design }: { f: SriFigure; unitMm: number; design: PanelProps['design'] }) {
  const t = useT();
  const separate = () => {
    const parts = sriAsTriangles(design, f.radius, newId('s'));
    if (!parts) return;
    update((d) => {
      d.centre = centreOf(d);
      const i = d.centre.findIndex((x) => x.id === f.id);
      if (i < 0) return;
      d.centre.splice(i, 1, ...parts.triangles);
      // the bindu stays where the Sri Yantra had it
      d.bindu.x = parts.bindu.x;
      d.bindu.y = parts.bindu.y;
      d.guides.checks = true;
    });
    showToast(t('sri.separated'), 'info', 6000);
  };
  return (
    <>
    <Block>
      <SliderRow
        label={t('poly.size')}
        value={f.radius}
        min={0.1}
        max={2}
        step={0.005}
        numeric={{ digits: 2, suffix: 'mm', scale: 2 * unitMm }}
        onChange={(v) => updFig<SriFigure>(f.id, (x) => { x.radius = v; }, 'radius')}
      />
    </Block>
    <ButtonRow icon={<span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>◺</span>} label={t('sri.separate')} sub={t('sri.separateSub')} onClick={separate} />
    </>
  );
}

type AddKind = 'triangle' | 'freeTriangle' | 'star6' | 'square' | 'polygon' | 'circle' | 'lotus' | 'rays' | 'lattice' | 'arc' | 'crescent' | 'symbol' | 'free' | 'grid' | 'sri';

export function CentrePanel({ design, scene }: PanelProps) {
  const t = useT();
  const figures = centreOf(design);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<CentreFigure | null>(null);
  const hasSri = figures.some((f) => f.type === 'sri');
  const lineMm = design.triangles.lineMm;

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      d.centre = centreOf(d);
      const j = i + dir;
      if (j < 0 || j >= d.centre.length) return;
      [d.centre[i], d.centre[j]] = [d.centre[j], d.centre[i]];
    });

  const duplicate = (i: number) => {
    const id = newId('f');
    update((d) => {
      d.centre = centreOf(d);
      d.centre.splice(i + 1, 0, { ...structuredClone(d.centre[i]), id });
    });
    setOpen(id);
  };

  const add = (kind: AddKind) => {
    const id = newId('f');
    // a new figure starts a little smaller than the smallest one already there, so it is easy to see
    const radii = figures.filter((f): f is PolygonFigure | CircleFigure | SriFigure | LotusFigure | LatticeFigure | ArcFigure | CrescentFigure => 'radius' in f).map((f) => f.radius);
    const r = radii.length ? Math.max(0.12, Math.min(...radii) * 0.6) : 1;
    const fig: CentreFigure =
      kind === 'triangle'
        ? polygonFigure(id, 3, { radius: r, rotationDeg: 180, lineMm })
        : kind === 'freeTriangle'
          ? triangleFigure(id, { base: r * 1.2, height: r * 1.5, lineMm })
        : kind === 'star6'
          ? polygonFigure(id, 6, { step: 2, radius: r, lineMm })
          : kind === 'square'
            ? polygonFigure(id, 4, { rotationDeg: 45, radius: r, lineMm })
            : kind === 'polygon'
              ? polygonFigure(id, 8, { step: 3, radius: r, lineMm })
              : kind === 'circle'
                ? circleFigure(id, r, { lineMm })
                : kind === 'lotus'
                  ? lotusFigure(id, 8, r * 0.6, { height: r * 0.35, lineMm })
                  : kind === 'rays'
                    ? raysFigure(id, 12, { inner: 0, outer: r, lineMm })
                    : kind === 'lattice'
                      ? latticeFigure(id, 4, { radius: r, lineMm })
                      : kind === 'arc'
                        ? arcFigure(id, r, { lineMm })
                        : kind === 'crescent'
                          ? crescentFigure(id, r, { lineMm })
                          : kind === 'symbol'
                            ? symbolFigure(id, 'trident', { size: Math.min(0.3, r * 0.5), lineMm })
                            : kind === 'free'
                              ? freeFigure(id, [], { lineMm })
                : kind === 'grid'
                  ? gridFigure(id, 3, 3, [6, 1, 8, 7, 5, 3, 2, 9, 4], { size: Math.min(1.2, r * 1.3), textSizeMm: Math.max(3, design.sizeMm / 22), lineMm })
                  : sriFigure(id, 1);
    update((d) => {
      d.centre = centreOf(d);
      d.centre.push(fig);
      if (fig.type === 'sri') { delete d.bindu.x; delete d.bindu.y; }
    });
    setOpen(id);
    if (kind === 'free') setEditorUI({ drawFigureId: id });
  };

  const kinds: AddKind[] = ['freeTriangle', 'triangle', 'star6', 'square', 'polygon', 'circle', 'lotus', 'rays', 'lattice', 'arc', 'crescent', 'symbol', 'free', 'grid', ...(hasSri ? [] : (['sri'] as AddKind[]))];
  const addGlyph: Record<AddKind, string> = { freeTriangle: '◺', triangle: '▼', star6: '✡', square: '■', polygon: '✴', circle: '○', lotus: '❀', rays: '✳', lattice: '▲', arc: '◠', crescent: '☾', symbol: '卐', free: '✎', grid: '▦', sri: '✡' };

  return (
    <>
      <p className="panel-intro">{t('centre.intro')}</p>
      <Group>
        {figures.length === 0 && <div className="row muted">{t('centre.none')}</div>}
        {figures.map((f, i) => {
          const isOpen = open === f.id;
          const name = figureName(f, t);
          return (
            <div key={f.id} className={`band${isOpen ? ' is-open' : ''}${f.visible ? '' : ' is-hidden'}`}>
              <div className="row band-row">
                <span className="row-icon band-glyph" aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
                  {GLYPH[f.type]}
                </span>
                <button type="button" className="band-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.id)}>
                  <span className="row-text">
                    <span className="row-label">
                      <span className="band-index">{i + 1}</span> {name}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={18} className="band-chevron" />
                </button>
                <Switch label={t('centre.visibleAria', { name })} checked={f.visible} onChange={(v) => updFig(f.id, (x) => { x.visible = v; })} />
              </div>
              {isOpen && (
                <div className="band-body">
                  <div className="band-actions">
                    <button type="button" className="pill-btn" onClick={() => move(i, -1)} disabled={i === 0}>
                      <Icon name="up" size={18} /> {t('centre.moveBack')}
                    </button>
                    <button type="button" className="pill-btn" onClick={() => move(i, 1)} disabled={i === figures.length - 1}>
                      <Icon name="down" size={18} /> {t('centre.moveFront')}
                    </button>
                    {f.type !== 'sri' && (
                      <button type="button" className="pill-btn" onClick={() => duplicate(i)}>
                        <Icon name="duplicate" size={18} /> {t('common.duplicate')}
                      </button>
                    )}
                    <button type="button" className="pill-btn is-destructive" onClick={() => setDeleting(f)}>
                      <Icon name="trash" size={18} /> {t('common.delete')}
                    </button>
                  </div>
                  {f.type === 'polygon' && <PolygonControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'circle' && <CircleControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'grid' && <GridControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'sri' && <SriControls f={f} unitMm={scene.unitMm} design={design} />}
                  {f.type === 'lotus' && <LotusControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'rays' && <RaysControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'lattice' && <LatticeControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'arc' && <ArcControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'crescent' && <CrescentControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'symbol' && <SymbolControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'free' && <FreeControls f={f} unitMm={scene.unitMm} />}
                  {f.type === 'triangle' && <TriangleControls f={f} unitMm={scene.unitMm} extent={scene.extent} />}
                </div>
              )}
            </div>
          );
        })}
      </Group>

      <Group>
        <ButtonRow accent icon={<Icon name="plus" />} label={t('centre.add')} onClick={() => setAdding(true)} />
      </Group>

      <CheckPanel design={design} scene={scene} />

      {hasSri ? (
        <>
          <h3 className="group-title" style={{ marginTop: 18 }}>{t('centre.sriSettings')}</h3>
          <ShapePanel design={design} scene={scene} />
        </>
      ) : (
        <BinduGuides design={design} scene={scene} />
      )}

      <ActionSheet
        open={adding}
        onClose={() => setAdding(false)}
        title={t('centre.addTitle')}
        cancelLabel={t('common.cancel')}
        actions={kinds.map((k) => ({
          label: t(`figType.${k}` as TKey),
          sub: t(`figType.${k}Sub` as TKey),
          icon: <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>{addGlyph[k]}</span>,
          onSelect: () => add(k),
        }))}
      />
      <ActionSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={deleting ? t('rings.deleteTitle', { name: figureName(deleting, t) }) : ''}
        cancelLabel={t('common.cancel')}
        actions={
          deleting
            ? [
                {
                  label: t('common.delete'),
                  destructive: true,
                  onSelect: () => update((d) => { d.centre = centreOf(d).filter((x) => x.id !== deleting.id); }),
                },
              ]
            : []
        }
      />
    </>
  );
}
