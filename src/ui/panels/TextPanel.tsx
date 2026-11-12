/** TEXT: master switch, font, colour, label sets, your own text (custom labels). */
import { useRef, useState } from 'react';
import type { Band, CustomLabel, FontId, LabelOverride, LabelSet, Orient, CentreFigure } from '../../core/types';
import { FONT_FILES, LABEL_KINDS, createLabelSet, type LabelKind } from '../../text';
import { updateDesign as update } from '../store';
import { setEditorUI, showToast, useEditorUI } from '../runtime';
import { useLang, useT } from '../i18n';
import type { PanelProps } from '../Editor';
import { Group, Row, Block, ButtonRow } from '../components/List';
import { Segmented } from '../components/Segmented';
import { SliderRow } from '../components/SliderRow';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/Switch';
import { ColorWell } from '../components/ColorWell';
import { Icon } from '../components/Icon';
import { ActionSheet } from '../components/ActionSheet';
import { SanskritInput } from '../components/SanskritInput';
import { Sheet } from '../components/Sheet';
import { FONT_CSS } from '../YantraView';

function updSet(id: string, fn: (s: LabelSet) => void, key?: string) {
  update(
    (d) => {
      const s = d.text.sets.find((x) => x.id === id);
      if (s) fn(s);
    },
    key ? { coalesceKey: `set:${id}:${key}` } : undefined,
  );
}

function updCustom(id: string, fn: (c: CustomLabel) => void, key?: string) {
  update(
    (d) => {
      const c = d.text.custom.find((x) => x.id === id);
      if (c) fn(c);
    },
    key ? { coalesceKey: `custom:${id}:${key}` } : undefined,
  );
}

function setOverride(setId: string, i: number, patch: Partial<LabelOverride> | null, key?: string) {
  updSet(
    setId,
    (s) => {
      if (patch === null) {
        delete s.overrides[i];
        return;
      }
      const o: LabelOverride = { ...(s.overrides[i] ?? {}), ...patch };
      (Object.keys(o) as (keyof LabelOverride)[]).forEach((k) => o[k] === undefined && delete o[k]);
      s.overrides[i] = o;
    },
    key ? `ov:${i}:${key}` : undefined,
  );
}

/* ------------------------------------------------------------ one label */

function LabelDetail({ set, i, unitMm, maxSize }: { set: LabelSet; i: number; unitMm: number; maxSize: number }) {
  const t = useT();
  const o = set.overrides[i] ?? {};
  const nudge = 0.005;
  return (
    <div className="label-detail">
      <div className="label-detail-head">
        <strong>{t('text.labelN', { n: i + 1 })}</strong>
        <button type="button" className="text-btn small" onClick={() => setOverride(set.id, i, null)}>
          {t('text.resetLabel')}
        </button>
      </div>
      <SanskritInput value={set.texts[i] ?? ''} label={t('text.labelN', { n: i + 1 })} onChange={(v) => updSet(set.id, (s) => { s.texts[i] = v; }, `txt:${i}`)} />
      <Row label={t('text.ownSize')}>
        <Switch label={t('text.ownSize')} checked={o.sizeMm !== undefined} onChange={(on) => setOverride(set.id, i, { sizeMm: on ? set.sizeMm : undefined })} />
      </Row>
      {o.sizeMm !== undefined && (
        <SliderRow
          label={t('text.size')}
          value={o.sizeMm}
          min={0.5}
          max={maxSize}
          step={0.1}
          display={`${o.sizeMm.toFixed(1)} mm`}
          onChange={(v) => setOverride(set.id, i, { sizeMm: v }, 'size')}
        />
      )}
      <SliderRow
        label={t('text.ownAngle')}
        value={o.angleDeg ?? 0}
        min={-180}
        max={180}
        step={1}
        numeric={{ digits: 0, suffix: '°' }}
        onChange={(v) => setOverride(set.id, i, { angleDeg: v === 0 ? undefined : v }, 'angle')}
      />
      <div className="nudge">
        <span className="block-label">{t('text.nudge')}</span>
        <div className="nudge-pad" role="group" aria-label={t('text.nudge')}>
          <button type="button" className="nudge-btn up" aria-label={t('text.nudgeUp')} onClick={() => setOverride(set.id, i, { dy: (o.dy ?? 0) - nudge })}>
            <Icon name="up" size={20} />
          </button>
          <button type="button" className="nudge-btn left" aria-label={t('text.nudgeLeft')} onClick={() => setOverride(set.id, i, { dx: (o.dx ?? 0) - nudge })}>
            <Icon name="back" size={20} />
          </button>
          <button type="button" className="nudge-btn right" aria-label={t('text.nudgeRight')} onClick={() => setOverride(set.id, i, { dx: (o.dx ?? 0) + nudge })}>
            <Icon name="chevronRight" size={20} />
          </button>
          <button type="button" className="nudge-btn down" aria-label={t('text.nudgeDown')} onClick={() => setOverride(set.id, i, { dy: (o.dy ?? 0) + nudge })}>
            <Icon name="down" size={20} />
          </button>
        </div>
        <span className="muted small">
          {((o.dx ?? 0) * unitMm).toFixed(1)} / {((o.dy ?? 0) * unitMm).toFixed(1)} mm
        </span>
      </div>
      <Row label={t('text.hideLabel')}>
        <Switch label={t('text.hideLabel')} checked={!!o.hidden} onChange={(v) => setOverride(set.id, i, { hidden: v || undefined })} />
      </Row>
    </div>
  );
}

function LetterGrid({ set, unitMm, maxSize, count }: { set: LabelSet; unitMm: number; maxSize: number; count: number }) {
  const t = useT();
  const [detail, setDetail] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = (i: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDetail(i), 550);
  };
  const endPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <>
      <p className="row-hint">{t('text.gridHint')}</p>
      <div className="letter-grid">
        {set.texts.slice(0, count > 0 ? Math.min(set.texts.length, count) : set.texts.length).map((txt, i) => {
          const o = set.overrides[i];
          return (
            <div
              key={i}
              className={`letter-cell${detail === i ? ' is-open' : ''}${o?.hidden ? ' is-hidden' : ''}${o && Object.keys(o).length ? ' has-override' : ''}`}
              onPointerDown={() => startPress(i)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
            >
              <button type="button" className="letter-index" aria-label={t('text.labelDetails', { n: i + 1 })} aria-expanded={detail === i} onClick={() => setDetail(detail === i ? null : i)}>
                {i + 1}
              </button>
              <SanskritInput compact value={txt} label={t('text.labelN', { n: i + 1 })} onChange={(v) => updSet(set.id, (s) => { s.texts[i] = v; }, `txt:${i}`)} />
            </div>
          );
        })}
      </div>
      {detail !== null && detail < set.texts.length && <LabelDetail set={set} i={detail} unitMm={unitMm} maxSize={maxSize} />}
    </>
  );
}

/* ------------------------------------------------------------- one set */

function SetEditor({ set, anchorCount, unitMm, maxSize, onDelete }: { set: LabelSet; anchorCount: number; unitMm: number; maxSize: number; onDelete(): void }) {
  const t = useT();
  const [letters, setLetters] = useState(false);
  const n = Math.max(1, anchorCount || set.texts.length);
  return (
    <div className="band-body">
      <Block>
        <SliderRow label={t('text.size')} value={set.sizeMm} min={0.5} max={maxSize} step={0.1} display={`${set.sizeMm.toFixed(1)} mm`} onChange={(v) => updSet(set.id, (s) => { s.sizeMm = v; }, 'size')} />
      </Block>
      <Row label={t('text.fit')} sub={t('text.fitSub')}>
        <Switch label={t('text.fit')} checked={set.fit} onChange={(v) => updSet(set.id, (s) => { s.fit = v; })} />
      </Row>
      <Block>
        <div className="block-label">{t('text.orient')}</div>
        <Segmented
          label={t('text.orient')}
          value={set.orient}
          onChange={(v: Orient) => updSet(set.id, (s) => { s.orient = v; })}
          options={[
            { value: 'upright', label: t('orient.upright') },
            { value: 'radial', label: t('orient.radial') },
            { value: 'tangent', label: t('orient.tangent') },
            { value: 'fixed', label: t('orient.fixed') },
          ]}
        />
      </Block>
      <Block>
        <SliderRow label={t('text.angle')} value={set.angleDeg} min={-180} max={180} step={1} numeric={{ digits: 0, suffix: '°' }} onChange={(v) => updSet(set.id, (s) => { s.angleDeg = v; }, 'angle')} />
      </Block>
      <Block>
        <SliderRow
          label={t('text.offset')}
          value={set.offset}
          min={-0.15}
          max={0.15}
          step={0.001}
          display={`${(set.offset * unitMm).toFixed(1)} mm`}
          hint={t('text.offsetHint')}
          onChange={(v) => updSet(set.id, (s) => { s.offset = v; }, 'offset')}
        />
      </Block>
      <Row label={t('text.start')} sub={t('text.startSub')}>
        <Stepper label={t('text.start')} value={((set.start % n) + n) % n} min={0} max={n - 1} wrap format={(v) => String(v + 1)} onChange={(v) => updSet(set.id, (s) => { s.start = v; })} />
      </Row>
      <Block>
        <Segmented
          label={t('text.direction')}
          value={set.clockwise ? 'cw' : 'acw'}
          onChange={(v) => updSet(set.id, (s) => { s.clockwise = v === 'cw'; })}
          options={[
            { value: 'acw', label: `↺ ${t('text.anticlockwise')}` },
            { value: 'cw', label: `↻ ${t('text.clockwise')}` },
          ]}
        />
      </Block>
      <Block>
        <button type="button" className="disclosure-btn" aria-expanded={letters} onClick={() => setLetters(!letters)}>
          <Icon name="pencil" size={18} />
          <span>{t('text.editLetters', { n: set.texts.length })}</span>
          <Icon name="chevronDown" size={18} className="band-chevron" />
        </button>
        {letters && <LetterGrid set={set} unitMm={unitMm} maxSize={maxSize} count={anchorCount} />}
      </Block>
      <div className="band-actions">
        <button type="button" className="pill-btn is-destructive" onClick={onDelete}>
          <Icon name="trash" size={18} /> {t('text.deleteSet')}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- add labels */

/** Centre lotuses and spokes offer places for ring labels just like the outer lotus and bead rings. */
function centreRings(design: { centre?: CentreFigure[] }): Band[] {
  const out: Band[] = [];
  for (const f of design.centre ?? []) {
    if (f.type === 'lotus') out.push({ id: f.id, type: 'lotus', visible: true, gap: 0, lineMm: f.lineMm, petals: f.petals, height: f.height, shape: f.shape, fullness: f.fullness, tip: f.tip, tipAtTop: f.tipAtTop, rows: 1, insets: 0, vein: false, fill: null });
    else if (f.type === 'rays') out.push({ id: f.id, type: 'beads', visible: true, gap: 0, lineMm: f.lineMm, count: f.count, size: 0, shape: 'dot', fill: null, sectors: true } as Band);
  }
  return out;
}

function targetBands(bands: Band[]): Band[] {
  return bands.filter((b) => b.type === 'lotus' || b.type === 'beads');
}

function defaultTarget(kind: LabelKind, bands: Band[]): string | null {
  const cands = targetBands(bands);
  if (!cands.length) return null;
  const wanted = kind.defaultGroup.slice('band:'.length);
  if (cands.some((b) => b.id === wanted)) return wanted;
  const m = /(\d+)/.exec(kind.kind);
  if (m) {
    const n = Number(m[1]);
    const hit = cands.find((b) => (b.type === 'lotus' && b.petals === n) || (b.type === 'beads' && b.count === n));
    if (hit) return hit.id;
  }
  return (cands.find((b) => b.type === 'lotus') ?? cands[0]).id;
}

function AddLabelsSheet({ open, onClose, bands }: { open: boolean; onClose(): void; bands: Band[] }) {
  const t = useT();
  const lang = useLang();
  const [kind, setKind] = useState<LabelKind | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const kinds = (() => {
    try {
      return LABEL_KINDS;
    } catch {
      return [] as LabelKind[];
    }
  })();

  const close = () => {
    setKind(null);
    onClose();
  };
  const create = (k: LabelKind, group?: string) => {
    try {
      const set = createLabelSet(k.kind, group);
      update((d) => {
        d.text.visible = true;
        d.text.sets.push(set);
      });
      showToast(t('text.added', { name: lang === 'hi' ? k.nameHi : k.name }), 'success');
      close();
    } catch (e) {
      console.error(e);
      showToast(t('error.text'), 'error');
    }
  };
  const choose = (k: LabelKind) => {
    if (k.defaultGroup.startsWith('band:')) {
      setKind(k);
      setTarget(defaultTarget(k, bands));
    } else create(k);
  };
  const bandLabel = (b: Band) => (b.type === 'lotus' ? t('band.lotusN', { n: b.petals }) : b.type === 'beads' ? ((b as { sectors?: boolean }).sectors ? t('fig.raysN', { n: b.count }) : t('band.beadsN', { n: b.count })) : b.id);

  return (
    <Sheet
      open={open}
      onClose={close}
      modal
      detents={[0.88]}
      label={t('text.addLabels')}
      title={kind ? (lang === 'hi' ? kind.nameHi : kind.name) : t('text.addLabels')}
      headerLeft={
        kind ? (
          <button type="button" className="text-btn" onClick={() => setKind(null)}>
            ‹ {t('common.back')}
          </button>
        ) : (
          <button type="button" className="text-btn" onClick={close}>
            {t('common.cancel')}
          </button>
        )
      }
    >
      <div className="panel">
        {!kind ? (
          kinds.length === 0 ? (
            <p className="panel-intro">{t('error.text')}</p>
          ) : (
            <Group footer={t('text.addLabelsHint')}>
              {kinds.map((k) => (
                <ButtonRow
                  key={k.kind}
                  label={lang === 'hi' ? k.nameHi : k.name}
                  sub={lang === 'hi' ? k.name : k.description}
                  chevron
                  onClick={() => choose(k)}
                />
              ))}
            </Group>
          )
        ) : (
          <>
            <p className="panel-intro">{t('text.pickRing')}</p>
            {targetBands(bands).length === 0 ? (
              <p className="inline-note">{t('text.noRing')}</p>
            ) : (
              <>
                <Group>
                  {targetBands(bands).map((b) => (
                    <button key={b.id} type="button" className="row row--button" role="radio" aria-checked={target === b.id} onClick={() => setTarget(b.id)}>
                      <span className="row-text">
                        <span className="row-label">{bandLabel(b)}</span>
                      </span>
                      {target === b.id && <Icon name="check" className="accent" />}
                    </button>
                  ))}
                </Group>
                <div className="sheet-actions">
                  <button type="button" className="btn btn--filled btn--block" disabled={!target} onClick={() => target && create(kind, `band:${target}`)}>
                    {t('common.add')}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ----------------------------------------------------------- the panel */

export function TextPanel({ design, scene }: PanelProps) {
  const t = useT();
  const text = design.text;
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingSet, setDeletingSet] = useState<LabelSet | null>(null);
  const selectedId = useEditorUI((s) => s.selectedCustomId);
  const fonts = Object.keys(FONT_FILES) as FontId[];
  const maxSize = Math.max(20, Math.round(design.sizeMm / 6));
  const groupCount = (g: string) => scene.anchors.filter((a) => a.group === g).length;

  return (
    <>
      <Group>
        <Row label={t('text.show')} sub={t('text.showSub')}>
          <Switch label={t('text.show')} checked={text.visible} onChange={(v) => update((d) => { d.text.visible = v; })} />
        </Row>
      </Group>

      <Group title={t('text.font')}>
        {fonts.map((f) => (
          <button key={f} type="button" className="row row--button" role="radio" aria-checked={text.font === f} onClick={() => update((d) => { d.text.font = f; })}>
            <span className="row-text">
              <span className="row-label font-sample" lang="sa" style={{ fontFamily: FONT_CSS[f] }}>
                श्री यन्त्र · ॐ
              </span>
              <span className="row-sub" style={{ fontFamily: FONT_CSS[f] }}>
                {FONT_FILES[f].label}
              </span>
            </span>
            {text.font === f && <Icon name="check" className="accent" />}
          </button>
        ))}
      </Group>

      <Group title={t('text.colour')}>
        <Block>
          <Segmented
            label={t('text.colour')}
            value={text.color ? 'custom' : 'ink'}
            onChange={(v) => update((d) => { d.text.color = v === 'ink' ? null : d.text.color ?? '#b8312f'; })}
            options={[
              { value: 'ink', label: t('text.sameAsInk') },
              { value: 'custom', label: t('text.customColour') },
            ]}
          />
        </Block>
        {text.color && (
          <Row label={t('text.customColour')}>
            <ColorWell value={text.color} label={t('text.customColour')} onChange={(v) => update((d) => { d.text.color = v; }, { coalesceKey: 'text:color' })} />
          </Row>
        )}
      </Group>

      <Group title={t('text.sets')} footer={text.sets.length ? undefined : t('text.setsEmpty')}>
        {text.sets.map((s) => {
          const isOpen = openSet === s.id;
          return (
            <div key={s.id} className={`band${isOpen ? ' is-open' : ''}${s.visible ? '' : ' is-hidden'}`}>
              <div className="row band-row">
                <button type="button" className="band-toggle" aria-expanded={isOpen} onClick={() => setOpenSet(isOpen ? null : s.id)}>
                  <span className="row-text">
                    <span className="row-label">{s.name}</span>
                    <span className="row-sub deva" lang="sa">
                      {s.texts.slice(0, 8).join(' ')}
                      {s.texts.length > 8 ? ' …' : ''}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={18} className="band-chevron" />
                </button>
                <Switch label={t('rings.visibleAria', { name: s.name })} checked={s.visible} onChange={(v) => updSet(s.id, (x) => { x.visible = v; })} />
              </div>
              {isOpen && <SetEditor set={s} anchorCount={groupCount(s.group)} unitMm={scene.unitMm} maxSize={maxSize} onDelete={() => setDeletingSet(s)} />}
            </div>
          );
        })}
        <ButtonRow accent icon={<Icon name="plus" />} label={t('text.addLabels')} onClick={() => setAdding(true)} />
      </Group>

      <Group title={t('text.own')} footer={t('text.ownHint')}>
        {text.custom.map((c) => {
          const isOpen = selectedId === c.id;
          return (
            <div key={c.id} className={`band${isOpen ? ' is-open' : ''}`}>
              <div className="row band-row">
                <button type="button" className="band-toggle" aria-expanded={isOpen} onClick={() => setEditorUI({ selectedCustomId: isOpen ? null : c.id })}>
                  <span className="row-text">
                    <span className="row-label deva" lang="sa">
                      {c.text || '—'}
                    </span>
                    <span className="row-sub">
                      {c.sizeMm.toFixed(1)} mm{c.angleDeg ? ` · ${c.angleDeg}°` : ''}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={18} className="band-chevron" />
                </button>
              </div>
              {isOpen && (
                <div className="band-body">
                  <Block>
                    <SanskritInput value={c.text} label={t('place.text')} onChange={(v) => updCustom(c.id, (x) => { x.text = v; }, 'text')} />
                  </Block>
                  <Block>
                    <SliderRow label={t('text.size')} value={c.sizeMm} min={0.5} max={maxSize} step={0.1} display={`${c.sizeMm.toFixed(1)} mm`} onChange={(v) => updCustom(c.id, (x) => { x.sizeMm = v; }, 'size')} />
                  </Block>
                  <Block>
                    <SliderRow label={t('text.angle')} value={c.angleDeg} min={-180} max={180} step={1} numeric={{ digits: 0, suffix: '°' }} onChange={(v) => updCustom(c.id, (x) => { x.angleDeg = v; }, 'angle')} />
                  </Block>
                  <p className="row-hint">{t('text.dragHint')}</p>
                  <div className="band-actions">
                    <button
                      type="button"
                      className="pill-btn is-destructive"
                      onClick={() => {
                        update((d) => { d.text.custom = d.text.custom.filter((x) => x.id !== c.id); });
                        setEditorUI({ selectedCustomId: null });
                      }}
                    >
                      <Icon name="trash" size={18} /> {t('common.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <ButtonRow accent icon={<Icon name="pin" />} label={t('text.addOwn')} onClick={() => setEditorUI({ placeMode: true, selectedCustomId: null })} />
      </Group>

      <AddLabelsSheet open={adding} onClose={() => setAdding(false)} bands={[...design.bands, ...centreRings(design)]} />
      <ActionSheet
        open={!!deletingSet}
        onClose={() => setDeletingSet(null)}
        title={deletingSet ? t('text.deleteSetTitle', { name: deletingSet.name }) : ''}
        cancelLabel={t('common.cancel')}
        actions={
          deletingSet
            ? [
                {
                  label: t('common.delete'),
                  destructive: true,
                  onSelect: () => update((d) => { d.text.sets = d.text.sets.filter((x) => x.id !== deletingSet.id); }),
                },
              ]
            : []
        }
      />
    </>
  );
}
