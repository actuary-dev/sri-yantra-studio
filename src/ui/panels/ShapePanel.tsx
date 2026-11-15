/** SHAPE: the nine triangles — perfection goal, the four free lines, line work, bindu, guides. */
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { checkGeometry, GOAL_SOLVES, validRange } from '../../core';
import type { GeometrySpec, Goal } from '../../core/types';
import { updateDesign as update } from '../store';
import { useT } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block } from '../components/List';
import { Segmented } from '../components/Segmented';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { Icon } from '../components/Icon';

type Key = 'ravi' | 'kuja' | 'shani' | 'ketu';
const KEYS: Key[] = ['ravi', 'kuja', 'shani', 'ketu'];


export function formatCrossingError(errUnits: number, unitMm: number): string {
  const mm = errUnits * unitMm;
  if (!Number.isFinite(mm)) return '—';
  if (mm < 1e-6) return '< 0.000001 mm';
  return `${mm.toPrecision(2)} mm`;
}

function AccuracyCard({ scene, flip }: { scene: PanelProps['scene']; flip: boolean }) {
  const t = useT();
  const r = scene.report;
  const cells = r.ringCounts.reduce((a, b) => a + b, 0);
  const off = r.binduOffset;
  const offText =
    Math.abs(off) < 1e-9
      ? t('shape.exactlyCentred')
      : `${(Math.abs(off) * scene.unitMm).toFixed(3)} mm ${(off > 0) !== flip ? t('shape.aboveCentre') : t('shape.belowCentre')}`;
  const eq = Math.abs(r.centralAngleDeg - 60) < 1e-6;
  return (
    <div className={`accuracy${r.ok ? ' is-ok' : ' is-bad'}`}>
      <div className="accuracy-head">
        <Icon name={r.ok ? 'checkCircle' : 'warn'} size={30} />
        <div>
          <div className="accuracy-title">{r.ok ? t('shape.trueYantra') : t('shape.notTrue')}</div>
          <div className="accuracy-sub">{t('shape.counts', { cells, marma: r.marmaCount })}</div>
        </div>
      </div>
      <dl className="accuracy-list">
        <div>
          <dt>{t('shape.crossingError')}</dt>
          <dd>{formatCrossingError(r.concurrencyError, scene.unitMm)}</dd>
        </div>
        <div>
          <dt>{t('shape.binduOffset')}</dt>
          <dd>{offText}</dd>
        </div>
        <div>
          <dt>{t('shape.centralAngle')}</dt>
          <dd>
            {r.centralAngleDeg.toFixed(2)}°{eq ? ` · ${t('shape.equilateral')}` : ''}
          </dd>
        </div>
        {r.triangles.length === 9 && (
          <>
            <div>
              <dt>{t('shape.greatUp')}</dt>
              <dd>{r.triangles[6].baseAngleDeg.toFixed(3)}°</dd>
            </div>
            <div>
              <dt>{t('shape.greatDown')}</dt>
              <dd>{r.triangles[2].baseAngleDeg.toFixed(3)}°</dd>
            </div>
          </>
        )}
      </dl>
      <details className="disclosure">
        <summary>{t('shape.triangleDetails')}</summary>
        <table className="tri-table">
          <thead>
            <tr>
              <th scope="col">{t('shape.triangle')}</th>
              <th scope="col">{t('shape.points')}</th>
              <th scope="col">{t('shape.apex')}</th>
              <th scope="col">{t('shape.base')}</th>
              <th scope="col" title={t('shape.kundamshaHint')}>{t('shape.kundamsha')}</th>
            </tr>
          </thead>
          <tbody>
            {r.triangles.map((tr) => {
              const up = tr.up !== flip;
              return (
                <tr key={tr.name}>
                  <td>
                    {tr.name}{' '}
                    <span className="deva" lang="sa">
                      {tr.sanskrit}
                    </span>
                  </td>
                  <td>{up ? `▲ ${t('shape.up')}` : `▼ ${t('shape.down')}`}</td>
                  <td>{tr.apexAngleDeg.toFixed(2)}°</td>
                  <td>{tr.baseAngleDeg.toFixed(2)}°</td>
                  <td>{(tr.apexAngleDeg / (360 / 81)).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="row-hint">{t('shape.kundamshaHint')}</p>
      </details>
    </div>
  );
}

export function ShapePanel({ design, scene }: PanelProps) {
  const t = useT();
  const g = design.geometry;
  const solved = GOAL_SOLVES[g.goal];
  const report = scene.report;
  const [rejected, setRejected] = useState(false);
  const [active, setActive] = useState<Key | null>(null);
  const frozen = useRef<Partial<Record<Key, [number, number]>>>({});

  const gDeferred = useDeferredValue(g);
  const ranges = useMemo(() => {
    const out: Partial<Record<Key, [number, number]>> = {};
    for (const k of KEYS) {
      if (GOAL_SOLVES[gDeferred.goal].includes(k)) continue;
      try {
        out[k] = validRange(gDeferred, k) ?? [0.02, 0.98];
      } catch {
        out[k] = [0.02, 0.98];
      }
    }
    return out;
  }, [gDeferred]);

  const rangeFor = (k: Key): [number, number] => (active === k && frozen.current[k]) || ranges[k] || [0.02, 0.98];

  const tryGeometry = (next: GeometrySpec, key: string): boolean => {
    let ok = false;
    try {
      ok = checkGeometry({ geometry: next }).ok;
    } catch {
      ok = false;
    }
    if (ok) {
      update((d) => {
        d.geometry = next;
      }, { coalesceKey: key });
      setRejected(false);
    } else setRejected(true);
    return ok;
  };

  const setGoal = (goal: Goal) => {
    if (goal === g.goal) return;
    const res = report.ok ? report.resolved : null;
    const seeded: GeometrySpec = res ? { ...g, ...res, goal } : { ...g, goal };
    if (!tryGeometry(seeded, 'goal')) tryGeometry({ ...g, goal }, 'goal');
  };

  const names: Record<Key, string> = {
    ravi: t('shape.ravi'),
    kuja: t('shape.kuja'),
    shani: t('shape.shani'),
    ketu: t('shape.ketu'),
  };
  const goalHint: Record<Goal, string> = {
    free: t('goal.freeHint'),
    centered: t('goal.centeredHint'),
    equilateral: t('goal.equilateralHint'),
    optimal: t('goal.optimalHint'),
  };
  const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)} %` : '—');

  const tri = design.triangles;
  const lineMax = 5;

  return (
    <>
      <AccuracyCard scene={scene} flip={g.flip} />

      <Group title={t('shape.perfection')} footer={goalHint[g.goal]}>
        <Block>
          <Segmented
            label={t('shape.perfection')}
            value={g.goal}
            onChange={setGoal}
            options={[
              { value: 'free', label: t('goal.free') },
              { value: 'centered', label: t('goal.centered') },
              { value: 'equilateral', label: t('goal.equilateral') },
              { value: 'optimal', label: t('goal.optimal') },
            ]}
          />
        </Block>
      </Group>

      <Group title={t('shape.lines4')} footer={t('shape.lines4Hint')}>
        {rejected && (
          <div className="inline-note" role="status">
            <Icon name="warn" size={18} />
            <span>{t('shape.invalid')}</span>
          </div>
        )}
        {KEYS.map((k) => {
          const isSolved = solved.includes(k);
          if (isSolved) {
            const v = report.resolved[k];
            return (
              <Block key={k}>
                <SliderRow
                  label={`${names[k]} · ${t('shape.auto')}`}
                  value={v}
                  min={0}
                  max={1}
                  step={0.001}
                  display={pct(v)}
                  disabled
                  onChange={() => undefined}
                />
              </Block>
            );
          }
          const [lo, hi] = rangeFor(k);
          return (
            <Block key={k}>
              <SliderRow
                label={names[k]}
                value={g[k]}
                min={Math.min(lo, g[k])}
                max={Math.max(hi, g[k])}
                step={0.001}
                display={pct(g[k])}
                onChange={(v) => tryGeometry({ ...g, [k]: v }, `geom:${k}`)}
                onActiveChange={(on) => {
                  if (on) frozen.current[k] = ranges[k];
                  setActive(on ? k : null);
                }}
              />
            </Block>
          );
        })}
      </Group>

      <Group title={t('shape.direction')}>
        <Block>
          <Segmented
            label={t('shape.direction')}
            value={g.flip ? 'up' : 'down'}
            onChange={(v) => tryGeometry({ ...g, flip: v === 'up' }, 'flip')}
            options={[
              { value: 'down', label: `▼ ${t('shape.pointsDown')}` },
              { value: 'up', label: `▲ ${t('shape.pointsUp')}` },
            ]}
          />
        </Block>
      </Group>

      <Group title={t('shape.linesTitle')} footer={t('shape.linesHint', { size: Math.round(design.sizeMm) })}>
        <Row label={t('shape.showTriangles')}>
          <Switch label={t('shape.showTriangles')} checked={tri.visible} onChange={(v) => update((d) => { d.triangles.visible = v; })} />
        </Row>
        <Block>
          <SliderRow
            label={t('common.lineWeight')}
            value={tri.lineMm}
            min={0.05}
            max={lineMax}
            step={0.01}
            log
            display={`${tri.lineMm.toFixed(2)} mm`}
            onChange={(v) => update((d) => { d.triangles.lineMm = v; }, { coalesceKey: 'tri:line' })}
          />
          <button
            type="button"
            className="text-btn small"
            onClick={() =>
              update((d) => {
                for (const b of d.bands) b.lineMm = d.triangles.lineMm;
              })
            }
          >
            {t('shape.applyAllRings')}
          </button>
        </Block>
        <Row label={t('shape.parallel')} sub={t('shape.parallelSub')}>
          <Stepper label={t('shape.parallel')} value={tri.lines} min={1} max={3} onChange={(v) => update((d) => { d.triangles.lines = v; })} />
        </Row>
        {tri.lines > 1 && (
          <Block>
            <SliderRow
              label={t('shape.parallelGap')}
              value={tri.lineGapMm}
              min={0.2}
              max={10}
              step={0.05}
              log
              display={`${tri.lineGapMm.toFixed(2)} mm`}
              onChange={(v) => update((d) => { d.triangles.lineGapMm = v; }, { coalesceKey: 'tri:gap' })}
            />
          </Block>
        )}
        <Row label={t('shape.cellInsets')} sub={t('shape.cellInsetsSub')}>
          <Stepper label={t('shape.cellInsets')} value={design.cells.insets} min={0} max={3} onChange={(v) => update((d) => { d.cells.insets = v; })} />
        </Row>
        {design.cells.insets > 0 && (
          <Block>
            <SliderRow
              label={t('shape.cellGap')}
              value={design.cells.insetGapMm}
              min={0.2}
              max={10}
              step={0.05}
              log
              display={`${design.cells.insetGapMm.toFixed(2)} mm`}
              onChange={(v) => update((d) => { d.cells.insetGapMm = v; }, { coalesceKey: 'cells:gap' })}
            />
          </Block>
        )}
      </Group>

      <BinduGuides design={design} scene={scene} />
    </>
  );
}

/** Bindu and guide switches — shared by every kind of yantra. */
export function BinduGuides({ design, scene }: PanelProps) {
  const t = useT();
  const hasSri = scene.report.hasSri;
  return (
    <>
      <Group title={t('shape.bindu')}>
        <Row label={t('shape.showBindu')}>
          <Switch label={t('shape.showBindu')} checked={design.bindu.visible} onChange={(v) => update((d) => { d.bindu.visible = v; })} />
        </Row>
        {design.bindu.visible && (
          <>
            <Block>
              <Segmented
                label={t('shape.binduStyle')}
                value={design.bindu.style}
                onChange={(v) => update((d) => { d.bindu.style = v; })}
                options={[
                  { value: 'dot', label: `● ${t('bindu.dot')}` },
                  { value: 'ring', label: `○ ${t('bindu.ring')}` },
                  { value: 'ringdot', label: `◉ ${t('bindu.ringdot')}` },
                ]}
              />
            </Block>
            <Block>
              <SliderRow
                label={t('shape.binduSize')}
                value={design.bindu.radius}
                min={0.004}
                max={0.06}
                step={0.001}
                display={`${(design.bindu.radius * 2 * scene.unitMm).toFixed(1)} mm`}
                onChange={(v) => update((d) => { d.bindu.radius = v; }, { coalesceKey: 'bindu:r' })}
              />
            </Block>
          </>
        )}
      </Group>

      <Group title={t('shape.guides')} footer={t('shape.guidesHint')}>
        <Row label={hasSri ? t('shape.marma') : t('guides.crossings')} icon={<span className="dot" style={{ background: '#c0392b' }} />}>
          <Switch label={t('shape.marma')} checked={design.guides.marma} onChange={(v) => update((d) => { d.guides.marma = v; })} />
        </Row>
        {hasSri && (
          <Row label={t('shape.sandhi')} icon={<span className="dot" style={{ background: '#1f6fb2' }} />}>
            <Switch label={t('shape.sandhi')} checked={design.guides.sandhi} onChange={(v) => update((d) => { d.guides.sandhi = v; })} />
          </Row>
        )}
        <Row label={t('shape.axes')} icon={<span className="dot" style={{ background: '#8a8a8a' }} />}>
          <Switch label={t('shape.axes')} checked={design.guides.axes} onChange={(v) => update((d) => { d.guides.axes = v; })} />
        </Row>
      </Group>
    </>
  );
}
