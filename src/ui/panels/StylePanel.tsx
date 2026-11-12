/** STYLE: finished size, material look (ink + paper), triangle colours. */
import { PAPERS } from '../../presets';
import { updateDesign as update } from '../store';
import { useT, type TKey } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block, Chips } from '../components/List';
import { Switch } from '../components/Switch';
import { ColorWell } from '../components/ColorWell';
import { NumberField } from '../components/NumberField';
import { Icon } from '../components/Icon';

const SIZE_CHIPS: { mm: number; label: string }[] = [
  { mm: 76.2, label: '76 mm · 3 in' },
  { mm: 152.4, label: '152 mm · 6 in' },
  { mm: 228.6, label: '229 mm · 9 in' },
  { mm: 300, label: '300 mm' },
  { mm: 420, label: '420 mm' },
  { mm: 600, label: '600 mm' },
  { mm: 840, label: '840 mm' },
];

type PaperId = keyof typeof PAPERS;

export function StylePanel({ design }: PanelProps) {
  const t = useT();
  const size = design.sizeMm;
  const { ink, paper } = design.style;
  const current = (Object.keys(PAPERS) as PaperId[]).find((k) => PAPERS[k].ink === ink && PAPERS[k].paper === paper) ?? null;
  const setSize = (v: number) => update((d) => { d.sizeMm = v; }, { coalesceKey: 'size' });
  const ringLabels = ['14', '10', '10', '8', t('style.centre')];

  return (
    <>
      <Group title={t('style.size')} footer={t('style.sizeHint')}>
        <Block className="size-block">
          <div className="size-field">
            <NumberField large value={size} min={20} max={3000} digits={1} label={t('style.sizeAria')} suffix="mm" onChange={setSize} />
            <div className="size-alt">
              = {(size / 25.4).toFixed(2)} in · {(size / 10).toFixed(1)} cm
            </div>
          </div>
          <Chips
            label={t('style.quickSizes')}
            value={SIZE_CHIPS.find((c) => Math.abs(c.mm - size) < 0.05)?.mm ?? null}
            onChange={setSize}
            options={SIZE_CHIPS.map((c) => ({ value: c.mm, label: c.label }))}
          />
        </Block>
      </Group>

      <Group title={t('style.material')}>
        <Block>
          <div className="swatches" role="radiogroup" aria-label={t('style.material')}>
            {(Object.keys(PAPERS) as PaperId[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={current === k}
                className={`swatch${current === k ? ' is-on' : ''}`}
                onClick={() => update((d) => { d.style = { ...PAPERS[k] }; })}
              >
                <span className="swatch-chip" style={{ background: PAPERS[k].paper, color: PAPERS[k].ink }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20.5 4.5 7.5h15L12 20.5Z M12 3.5 19.5 16.5h-15L12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  {current === k && (
                    <span className="swatch-check">
                      <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="swatch-label">{t(`paper.${k}` as TKey)}</span>
              </button>
            ))}
          </div>
        </Block>
        <Row label={t('style.ink')}>
          <ColorWell value={ink} label={t('style.ink')} onChange={(v) => update((d) => { d.style.ink = v; }, { coalesceKey: 'ink' })} />
        </Row>
        <Row label={t('style.paper')}>
          <ColorWell value={paper} label={t('style.paper')} onChange={(v) => update((d) => { d.style.paper = v; }, { coalesceKey: 'paper' })} />
        </Row>
      </Group>

      <Group title={t('style.colourTriangles')} footer={t('style.colourHint')}>
        <Row label={t('style.colourTriangles')}>
          <Switch label={t('style.colourTriangles')} checked={design.cells.filled} onChange={(v) => update((d) => { d.cells.filled = v; })} />
        </Row>
        {design.cells.filled && (
          <Block>
            <div className="wells">
              {design.cells.palette.map((c, i) => (
                <ColorWell
                  key={i}
                  value={c}
                  caption={ringLabels[i]}
                  label={t('style.ringColour', { n: ringLabels[i] })}
                  onChange={(v) => update((d) => { d.cells.palette[i] = v; }, { coalesceKey: `pal:${i}` })}
                />
              ))}
            </div>
          </Block>
        )}
      </Group>
    </>
  );
}
