/** ACCURACY: what nearly-but-not-exactly meets, the symmetry of the figure, the directions of its lines, angle guides. */
import { useMemo } from 'react';
import { analyse } from '../../core';
import { updateDesign as update } from '../store';
import { useT, type TKey } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block, Chips } from '../components/List';
import { Switch } from '../components/Switch';
import { Icon } from '../components/Icon';

const RADIAL = [0, 90, 60, 45, 36, 30, 22.5, 15];

const fmtMm = (mm: number) => (mm < 0.001 ? `${mm.toExponential(1)} mm` : `${mm.toFixed(mm < 0.1 ? 4 : 3)} mm`);
const fmtDeg = (d: number) => `${+d.toFixed(2)}°`;

export function CheckPanel({ design, scene }: PanelProps) {
  const t = useT();
  const r = useMemo(() => analyse(scene.lines, scene.rounds), [scene.lines, scene.rounds]);
  const misses = r.nearMisses;
  const ok = misses.length === 0;
  const sym = r.symmetry;
  const symParts = [sym.mirrorX ? t('check.mirrorX') : null, sym.mirrorY ? t('check.mirrorY') : null, sym.turns > 1 ? t('check.turns', { n: sym.turns }) : null].filter(Boolean);
  const shown = r.directions.slice(0, 16);
  const radial = design.guides.radialDeg ?? 0;

  return (
    <>
      <h3 className="group-title" style={{ marginTop: 18 }}>{t('check.title')}</h3>
      {r.lineCount === 0 ? (
        <p className="panel-intro">{t('check.none')}</p>
      ) : (
        <div className={`accuracy${ok ? ' is-ok' : ' is-bad'}`}>
          <div className="accuracy-head">
            <Icon name={ok ? 'checkCircle' : 'warn'} size={30} />
            <div>
              <div className="accuracy-title">{ok ? t('check.ok') : t('check.bad', { n: misses.length })}</div>
              <div className="accuracy-sub">
                {ok ? t('check.okSub', { n: r.lineCount }) : t('check.worst', { mm: fmtMm(misses[0].error * scene.unitMm) })}
                {r.complete ? '' : ` · ${t('check.tooMany')}`}
              </div>
            </div>
          </div>
          {!ok && (
            <dl className="accuracy-list">
              {misses.slice(0, 6).map((m, i) => (
                <div key={i}>
                  <dt>
                    {t(`check.${m.kind}` as TKey)} · {t('check.where', { x: (m.x * scene.unitMm).toFixed(1), y: (-m.y * scene.unitMm).toFixed(1) })}
                  </dt>
                  <dd>{fmtMm(m.error * scene.unitMm)}</dd>
                </div>
              ))}
            </dl>
          )}
          <dl className="accuracy-list">
            <div>
              <dt>{t('check.symmetry')}</dt>
              <dd>{symParts.length ? symParts.join(' · ') : t('check.noSym')}</dd>
            </div>
            {sym.mirrorXError !== null && (
              <div>
                <dt>{t('check.nearMirror')}</dt>
                <dd>{fmtMm(sym.mirrorXError * scene.unitMm)}</dd>
              </div>
            )}
            <div>
              <dt>{t('check.directions')}</dt>
              <dd>
                {shown.map(fmtDeg).join(', ')}
                {r.directions.length > shown.length ? ' …' : ''}
                {r.angleGrid ? ` · ${t('check.grid', { n: r.angleGrid })}` : ''}
              </dd>
            </div>
          </dl>
        </div>
      )}
      <Group footer={t('check.hint')}>
        <Row label={t('check.mark')} icon={<span className="dot" style={{ background: '#e67e22' }} />}>
          <Switch label={t('check.mark')} checked={!!design.guides.checks} onChange={(v) => update((d) => { d.guides.checks = v; })} />
        </Row>
      </Group>
      <Group title={t('guides.radial')} footer={t('guides.radialHint')}>
        <Block>
          <Chips<number>
            label={t('guides.radial')}
            value={radial}
            onChange={(v) => update((d) => { d.guides.radialDeg = v; })}
            options={RADIAL.map((d) => ({ value: d, label: d === 0 ? t('guides.radialOff') : `${d}°` }))}
          />
        </Block>
      </Group>
    </>
  );
}
