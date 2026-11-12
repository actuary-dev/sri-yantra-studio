/** RINGS: the enclosures around the triangles, ordered from the centre outwards. */
import { useState, type ReactNode } from 'react';
import type { Band, BeadBand, BeadShape, BhupuraBand, CircleBand, FontId, GateStyle, LotusBand, PetalShape, TextRingBand } from '../../core/types';
import { beadBand, bhupuraBand, circleBand, lotusBand, newId, standardBands, textRingBand } from '../../presets';
import { FONT_FILES } from '../../text';
import { updateDesign as update } from '../store';
import { useT, type TKey } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block, Chips, ButtonRow } from '../components/List';
import { Segmented } from '../components/Segmented';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { ColorWell } from '../components/ColorWell';
import { Icon, type IconName } from '../components/Icon';
import { ActionSheet } from '../components/ActionSheet';
import { SanskritInput } from '../components/SanskritInput';
import { FONT_CSS } from '../YantraView';

const ICON: Record<Band['type'], IconName> = {
  circle: 'bandCircle',
  lotus: 'bandLotus',
  beads: 'bandBeads',
  textRing: 'bandText',
  bhupura: 'bandBhupura',
};

function updBand<T extends Band>(id: string, fn: (b: T) => void, coalesceKey?: string) {
  update(
    (d) => {
      const b = d.bands.find((x) => x.id === id);
      if (b) fn(b as T);
    },
    coalesceKey ? { coalesceKey: `band:${id}:${coalesceKey}` } : undefined,
  );
}

const PETAL_PATHS: Record<PetalShape, string> = {
  classic: 'M12 21C6 15 7 8 12 3c5 5 6 12 0 18Z',
  pointed: 'M12 21C7.5 15 8.5 9 12 2c3.5 7 4.5 13 0 19Z',
  round: 'M12 21C5 16 5 5 12 4c7 1 7 12 0 17Z',
  flame: 'M12 21c-5-4-5-9-1-12 1-1.5 0-4 1-6 2 3 6 6 5 11-1 4-3 6-5 7Z',
  lotus: 'M12 21C5 17 6 10 9 7c1 2 2 3 3 3 1 0 2-1 3-3 3 3 4 10-3 14ZM12 10c-1-3-1-5 0-7 1 2 1 4 0 7Z',
};

const BEAD_PATHS: Record<BeadShape, ReactNode> = {
  circle: <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  diamond: <path d="M12 5l7 7-7 7-7-7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" />,
  triangle: <path d="M12 5.5l7 12H5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
};

function FillRow({ value, onChange, label }: { value: string | null; onChange(v: string | null): void; label: string }) {
  const t = useT();
  return (
    <Row label={label} sub={value ? undefined : t('rings.noFill')}>
      <div className="inline-controls">
        {value && <ColorWell value={value} onChange={onChange} label={label} />}
        <Switch label={label} checked={!!value} onChange={(on) => onChange(on ? '#c0392b' : null)} />
      </div>
    </Row>
  );
}

function bandName(b: Band, t: (k: TKey, v?: Record<string, string | number>) => string): string {
  switch (b.type) {
    case 'circle':
      return b.count > 1 ? t('band.circleN', { n: b.count }) : t('band.circle');
    case 'lotus':
      return t('band.lotusN', { n: b.petals });
    case 'beads':
      return t('band.beadsN', { n: b.count });
    case 'textRing':
      return t('band.mantra');
    case 'bhupura':
      return t('band.bhupura');
  }
}

interface EditorProps<T extends Band> {
  b: T;
  unitMm: number;
}

const mmOf = (v: number, unitMm: number) => `${(v * unitMm).toFixed(1)} mm`;

function CommonControls({ b, unitMm }: EditorProps<Band>) {
  const t = useT();
  return (
    <>
      <Block>
        <SliderRow
          label={t('rings.gap')}
          value={b.gap}
          min={0}
          max={0.3}
          step={0.001}
          display={mmOf(b.gap, unitMm)}
          onChange={(v) => updBand(b.id, (x) => { x.gap = v; }, 'gap')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('common.lineWeight')}
          value={b.lineMm}
          min={0.05}
          max={5}
          step={0.01}
          log
          display={`${b.lineMm.toFixed(2)} mm`}
          onChange={(v) => updBand(b.id, (x) => { x.lineMm = v; }, 'line')}
        />
      </Block>
    </>
  );
}

function CircleControls({ b, unitMm }: EditorProps<CircleBand>) {
  const t = useT();
  return (
    <>
      <Row label={t('rings.circles')}>
        <Stepper label={t('rings.circles')} value={b.count} min={1} max={6} onChange={(v) => updBand<CircleBand>(b.id, (x) => { x.count = v; })} />
      </Row>
      {b.count > 1 && (
        <Block>
          <SliderRow
            label={t('rings.spacing')}
            value={b.spacing}
            min={0.005}
            max={0.12}
            step={0.001}
            display={mmOf(b.spacing, unitMm)}
            onChange={(v) => updBand<CircleBand>(b.id, (x) => { x.spacing = v; }, 'spacing')}
          />
        </Block>
      )}
    </>
  );
}

function LotusControls({ b, unitMm }: EditorProps<LotusBand>) {
  const t = useT();
  const shapes: PetalShape[] = ['classic', 'pointed', 'round', 'flame', 'lotus'];
  return (
    <>
      <Row label={t('rings.petals')}>
        <Stepper label={t('rings.petals')} value={b.petals} min={4} max={128} onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.petals = v; }, 'petals')} />
      </Row>
      <Block>
        <Chips
          label={t('rings.petals')}
          value={b.petals}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.petals = v; })}
          options={[8, 16, 24, 32, 64].map((n) => ({ value: n, label: String(n) }))}
        />
      </Block>
      <Block>
        <div className="block-label">{t('rings.petalShape')}</div>
        <Chips
          label={t('rings.petalShape')}
          value={b.shape}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.shape = v; })}
          options={shapes.map((s) => ({
            value: s,
            aria: t(`petal.${s}` as TKey),
            label: (
              <span className="shape-chip">
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={PETAL_PATHS[s]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <span>{t(`petal.${s}` as TKey)}</span>
              </span>
            ),
          }))}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.height')}
          value={b.height}
          min={0.04}
          max={0.5}
          step={0.002}
          display={mmOf(b.height, unitMm)}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.height = v; }, 'height')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.fullness')}
          value={b.fullness}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(b.fullness * 100)} %`}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.fullness = v; }, 'fullness')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.tip')}
          value={b.tip}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(b.tip * 100)} %`}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.tip = v; }, 'tip')}
        />
      </Block>
      <Row label={t('rings.tipAtTop')} sub={t('rings.tipAtTopSub')}>
        <Switch label={t('rings.tipAtTop')} checked={b.tipAtTop} onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.tipAtTop = v; })} />
      </Row>
      <Row label={t('rings.rows')}>
        <Segmented
          size="small"
          label={t('rings.rows')}
          value={b.rows}
          onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.rows = v; })}
          options={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
          ]}
        />
      </Row>
      <Row label={t('rings.insets')}>
        <Stepper label={t('rings.insets')} value={b.insets} min={0} max={3} onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.insets = v; })} />
      </Row>
      <Row label={t('rings.vein')}>
        <Switch label={t('rings.vein')} checked={b.vein} onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.vein = v; })} />
      </Row>
      <FillRow label={t('rings.fill')} value={b.fill} onChange={(v) => updBand<LotusBand>(b.id, (x) => { x.fill = v; }, 'fill')} />
    </>
  );
}

function BeadControls({ b, unitMm }: EditorProps<BeadBand>) {
  const t = useT();
  const shapes: BeadShape[] = ['circle', 'diamond', 'dot', 'triangle'];
  return (
    <>
      <Row label={t('rings.beadCount')}>
        <Stepper label={t('rings.beadCount')} value={b.count} min={4} max={432} onChange={(v) => updBand<BeadBand>(b.id, (x) => { x.count = v; }, 'count')} />
      </Row>
      <Block>
        <Chips
          label={t('rings.beadCount')}
          value={b.count}
          onChange={(v) => updBand<BeadBand>(b.id, (x) => { x.count = v; })}
          options={[27, 54, 108, 216].map((n) => ({ value: n, label: String(n) }))}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.beadSize')}
          value={b.size}
          min={0.004}
          max={0.05}
          step={0.0005}
          display={mmOf(b.size * 2, unitMm)}
          onChange={(v) => updBand<BeadBand>(b.id, (x) => { x.size = v; }, 'size')}
        />
      </Block>
      <Block>
        <div className="block-label">{t('rings.beadShape')}</div>
        <Chips
          label={t('rings.beadShape')}
          value={b.shape}
          onChange={(v) => updBand<BeadBand>(b.id, (x) => { x.shape = v; })}
          options={shapes.map((s) => ({
            value: s,
            aria: t(`bead.${s}` as TKey),
            label: (
              <span className="shape-chip">
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                  {BEAD_PATHS[s]}
                </svg>
                <span>{t(`bead.${s}` as TKey)}</span>
              </span>
            ),
          }))}
        />
      </Block>
      <FillRow label={t('rings.fill')} value={b.fill} onChange={(v) => updBand<BeadBand>(b.id, (x) => { x.fill = v; }, 'fill')} />
    </>
  );
}

function MantraControls({ b, unitMm }: EditorProps<TextRingBand>) {
  const t = useT();
  const fonts = Object.keys(FONT_FILES) as FontId[];
  return (
    <>
      <Block>
        <div className="block-label">{t('rings.mantraText')}</div>
        <SanskritInput multiline value={b.text} label={t('rings.mantraText')} onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.text = v; }, 'text')} />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.letterSize')}
          value={b.size}
          min={0.02}
          max={0.2}
          step={0.001}
          display={mmOf(b.size, unitMm)}
          onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.size = v; }, 'size')}
        />
      </Block>
      <Block>
        <div className="block-label">{t('text.font')}</div>
        <Chips
          label={t('text.font')}
          value={b.font}
          onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.font = v; })}
          options={fonts.map((f) => ({
            value: f,
            aria: FONT_FILES[f].label,
            label: (
              <span lang="sa" style={{ fontFamily: FONT_CSS[f] }}>
                श्री
              </span>
            ),
          }))}
        />
      </Block>
      <Row label={t('rings.repeat')} sub={t('rings.repeatSub')}>
        <Switch label={t('rings.repeat')} checked={b.repeat} onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.repeat = v; })} />
      </Row>
      {b.repeat && (
        <Block>
          <div className="block-label">{t('rings.separator')}</div>
          <Chips
            label={t('rings.separator')}
            value={b.separator}
            onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.separator = v; })}
            options={[' ॥ ', ' । ', ' • ', ' ॐ ', '  '].map((s) => ({ value: s, label: <span className="deva">{s.trim() || '␣'}</span>, aria: s.trim() || 'space' }))}
          />
        </Block>
      )}
      <Row label={t('rings.inward')} sub={t('rings.inwardSub')}>
        <Switch label={t('rings.inward')} checked={b.inward} onChange={(v) => updBand<TextRingBand>(b.id, (x) => { x.inward = v; })} />
      </Row>
    </>
  );
}

function BhupuraControls({ b, unitMm }: EditorProps<BhupuraBand>) {
  const t = useT();
  const styles: GateStyle[] = ['classic', 'plain', 'stepped'];
  return (
    <>
      <Row label={t('rings.lines')}>
        <Stepper label={t('rings.lines')} value={b.lines} min={1} max={4} onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.lines = v; })} />
      </Row>
      {b.lines > 1 && (
        <Block>
          <SliderRow
            label={t('rings.spacing')}
            value={b.spacing}
            min={0.01}
            max={0.1}
            step={0.001}
            display={mmOf(b.spacing, unitMm)}
            onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.spacing = v; }, 'spacing')}
          />
        </Block>
      )}
      <Block>
        <div className="block-label">{t('rings.gateStyle')}</div>
        <Chips
          label={t('rings.gateStyle')}
          value={b.style}
          onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.style = v; })}
          options={styles.map((s) => ({ value: s, label: t(`gate.${s}` as TKey) }))}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.gateWidth')}
          value={b.gateWidth}
          min={0.1}
          max={0.6}
          step={0.005}
          display={`${Math.round(b.gateWidth * 100)} %`}
          onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.gateWidth = v; }, 'gw')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.gateDepth')}
          value={b.gateDepth}
          min={0}
          max={0.4}
          step={0.002}
          display={mmOf(b.gateDepth, unitMm)}
          onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.gateDepth = v; }, 'gd')}
        />
      </Block>
      <Block>
        <SliderRow
          label={t('rings.gateFlare')}
          value={b.gateFlare}
          min={1}
          max={2.2}
          step={0.01}
          display={`× ${b.gateFlare.toFixed(2)}`}
          onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.gateFlare = v; }, 'gf')}
        />
      </Block>
      <FillRow label={t('rings.fill')} value={b.fill} onChange={(v) => updBand<BhupuraBand>(b.id, (x) => { x.fill = v; }, 'fill')} />
    </>
  );
}

function BandControls({ b, unitMm }: EditorProps<Band>) {
  switch (b.type) {
    case 'circle':
      return <CircleControls b={b} unitMm={unitMm} />;
    case 'lotus':
      return <LotusControls b={b} unitMm={unitMm} />;
    case 'beads':
      return <BeadControls b={b} unitMm={unitMm} />;
    case 'textRing':
      return <MantraControls b={b} unitMm={unitMm} />;
    case 'bhupura':
      return <BhupuraControls b={b} unitMm={unitMm} />;
  }
}

export function RingsPanel({ design, scene }: PanelProps) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Band | null>(null);
  const [resetting, setResetting] = useState(false);
  const bands = design.bands;

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.bands.length) return;
      [d.bands[i], d.bands[j]] = [d.bands[j], d.bands[i]];
    });

  const duplicate = (i: number) => {
    const id = newId('b');
    update((d) => {
      const copy = { ...structuredClone(d.bands[i]), id };
      d.bands.splice(i + 1, 0, copy);
    });
    setOpen(id);
  };

  const add = (type: Band['type']) => {
    const id = newId('b');
    const lineMm = design.triangles.lineMm;
    const band: Band =
      type === 'circle'
        ? circleBand(id, { lineMm })
        : type === 'lotus'
          ? lotusBand(id, 16, { lineMm })
          : type === 'beads'
            ? beadBand(id, 108)
            : type === 'textRing'
              ? textRingBand(id, 'ॐ श्रीं ह्रीं क्लीं')
              : bhupuraBand(id, { lineMm });
    update((d) => {
      const bi = d.bands.findIndex((x) => x.type === 'bhupura');
      if (bi >= 0 && type !== 'bhupura') d.bands.splice(bi, 0, band);
      else d.bands.push(band);
    });
    setOpen(id);
  };

  const sub = (b: Band): string | undefined => {
    if (b.type === 'textRing') return b.text.slice(0, 32) + (b.text.length > 32 ? '…' : '');
    return undefined;
  };

  return (
    <>
      <p className="panel-intro">{t('rings.intro')}</p>
      <Group>
        {bands.length === 0 && <div className="row muted">{t('rings.none')}</div>}
        {bands.map((b, i) => {
          const isOpen = open === b.id;
          return (
            <div key={b.id} className={`band${isOpen ? ' is-open' : ''}${b.visible ? '' : ' is-hidden'}`}>
              <div className="row band-row">
                <span className="row-icon band-glyph">
                  <Icon name={ICON[b.type]} size={26} strokeWidth={1.5} />
                </span>
                <button type="button" className="band-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : b.id)}>
                  <span className="row-text">
                    <span className="row-label">
                      <span className="band-index">{i + 1}</span> {bandName(b, t)}
                    </span>
                    {sub(b) && (
                      <span className="row-sub deva" lang="sa">
                        {sub(b)}
                      </span>
                    )}
                  </span>
                  <Icon name="chevronDown" size={18} className="band-chevron" />
                </button>
                <Switch label={t('rings.visibleAria', { name: bandName(b, t) })} checked={b.visible} onChange={(v) => updBand(b.id, (x) => { x.visible = v; })} />
              </div>
              {isOpen && (
                <div className="band-body">
                  <div className="band-actions">
                    <button type="button" className="pill-btn" onClick={() => move(i, -1)} disabled={i === 0}>
                      <Icon name="up" size={18} /> {t('rings.inwardMove')}
                    </button>
                    <button type="button" className="pill-btn" onClick={() => move(i, 1)} disabled={i === bands.length - 1}>
                      <Icon name="down" size={18} /> {t('rings.outwardMove')}
                    </button>
                    <button type="button" className="pill-btn" onClick={() => duplicate(i)}>
                      <Icon name="duplicate" size={18} /> {t('common.duplicate')}
                    </button>
                    <button type="button" className="pill-btn is-destructive" onClick={() => setDeleting(b)}>
                      <Icon name="trash" size={18} /> {t('common.delete')}
                    </button>
                  </div>
                  <BandControls b={b} unitMm={scene.unitMm} />
                  <CommonControls b={b} unitMm={scene.unitMm} />
                </div>
              )}
            </div>
          );
        })}
      </Group>

      <Group>
        <ButtonRow accent icon={<Icon name="plus" />} label={t('rings.add')} onClick={() => setAdding(true)} />
        <ButtonRow icon={<Icon name="reset" />} label={t('rings.reset')} onClick={() => setResetting(true)} />
      </Group>

      <ActionSheet
        open={adding}
        onClose={() => setAdding(false)}
        title={t('rings.addTitle')}
        cancelLabel={t('common.cancel')}
        actions={(['circle', 'lotus', 'beads', 'textRing', 'bhupura'] as const).map((type) => ({
          label: t(`bandType.${type}` as TKey),
          sub: t(`bandType.${type}Sub` as TKey),
          icon: <Icon name={ICON[type]} size={26} strokeWidth={1.5} />,
          onSelect: () => add(type),
        }))}
      />
      <ActionSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={deleting ? t('rings.deleteTitle', { name: bandName(deleting, t) }) : ''}
        cancelLabel={t('common.cancel')}
        actions={
          deleting
            ? [
                {
                  label: t('common.delete'),
                  destructive: true,
                  onSelect: () => update((d) => { d.bands = d.bands.filter((x) => x.id !== deleting.id); }),
                },
              ]
            : []
        }
      />
      <ActionSheet
        open={resetting}
        onClose={() => setResetting(false)}
        title={t('rings.resetTitle')}
        message={t('rings.resetMsg')}
        cancelLabel={t('common.cancel')}
        actions={[
          {
            label: t('rings.reset'),
            destructive: true,
            onSelect: () => update((d) => { d.bands = standardBands(d.triangles.lineMm); }),
          },
        ]}
      />
    </>
  );
}
