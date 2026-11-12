/** EXPORT: choose a file type and options, then save / share the file. */
import { useEffect, useMemo, useState } from 'react';
import { buildScene } from '../core';
import type { Design, Scene } from '../core/types';
import type { ExportFormat, ExportOptions, PageSize } from '../export';
import { studio, useStudio } from './store';
import { ensureShaper, showToast } from './runtime';
import { useT, type TKey } from './i18n';
import { Sheet } from './components/Sheet';
import { Group, Row, Block, Chips } from './components/List';
import { Segmented } from './components/Segmented';
import { Switch } from './components/Switch';
import { Stepper } from './components/Stepper';
import { Icon } from './components/Icon';

type ExportModule = typeof import('../export');

let modPromise: Promise<ExportModule> | null = null;
/** The export module (with pdf-lib) is loaded only when it is needed, keeping the first paint quick. */
export function loadExportModule(): Promise<ExportModule> {
  if (!modPromise)
    modPromise = import('../export').catch((e: unknown) => {
      modPromise = null;
      throw e;
    });
  return modPromise;
}

const FORMATS: ExportFormat[] = ['pdf', 'svg', 'png', 'dxf'];

function pageGroup(p: PageSize): string {
  if (/^a\d/i.test(p.id)) return 'ISO A';
  if (/^b\d/i.test(p.id)) return 'ISO B';
  if (/^(us|arch)/i.test(p.id)) return 'US / ARCH';
  if (/chart/i.test(p.id)) return 'Chart paper';
  if (/plate/i.test(p.id)) return 'Square plates';
  return 'Other';
}

interface ExportSheetProps {
  open: boolean;
  onClose(): void;
  design: Design;
  scene: Scene | null;
}

export function ExportSheet(props: ExportSheetProps) {
  const t = useT();
  const [mod, setMod] = useState<ExportModule | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!props.open || mod) return;
    let alive = true;
    setFailed(false);
    loadExportModule()
      .then((m) => alive && setMod(m))
      .catch((e: unknown) => {
        console.error(e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [props.open, mod]);
  if (mod) return <ExportSheetInner {...props} mod={mod} />;
  return (
    <Sheet open={props.open} onClose={props.onClose} modal detents={[0.94]} label={t('export.title')} title={t('export.title')}>
      <div className="canvas-error">
        {failed ? <p>{t('export.unavailable')}</p> : <span className="spinner" aria-label={t('export.working')} />}
      </div>
    </Sheet>
  );
}

function ExportSheetInner({ open, onClose, design, scene, mod }: ExportSheetProps & { mod: ExportModule }) {
  const t = useT();
  const { DEFAULT_EXPORT, computePlacement, pngPixelSize, exportScene, deliver } = mod;
  const initialOptions = (saved: ExportOptions | null): ExportOptions => ({ ...DEFAULT_EXPORT, ...(saved ?? {}) });
  const saved = useStudio((s) => s.settings.exportOptions);
  const [opts, setOpts] = useState<ExportOptions>(() => initialOptions(saved));
  const [busy, setBusy] = useState(false);
  const pages: PageSize[] = Array.isArray(mod.PAGE_SIZES) ? mod.PAGE_SIZES : [];

  useEffect(() => {
    if (open) setOpts(initialOptions(studio.getState().settings.exportOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<ExportOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const pageMatch = opts.page
    ? pages.find(
        (p) =>
          (Math.abs(p.widthMm - opts.page!.widthMm) < 0.05 && Math.abs(p.heightMm - opts.page!.heightMm) < 0.05) ||
          (Math.abs(p.widthMm - opts.page!.heightMm) < 0.05 && Math.abs(p.heightMm - opts.page!.widthMm) < 0.05),
      )
    : undefined;
  const landscape = !!opts.page && opts.page.widthMm > opts.page.heightMm;

  const grouped = useMemo(() => {
    const m = new Map<string, PageSize[]>();
    for (const p of pages) {
      const g = pageGroup(p);
      m.set(g, [...(m.get(g) ?? []), p]);
    }
    return [...m.entries()];
  }, [pages]);

  const choosePage = (id: string, land = landscape) => {
    const p = pages.find((x) => x.id === id);
    if (!p) return;
    const [w, h] = land ? [Math.max(p.widthMm, p.heightMm), Math.min(p.widthMm, p.heightMm)] : [Math.min(p.widthMm, p.heightMm), Math.max(p.widthMm, p.heightMm)];
    set({ page: { widthMm: w, heightMm: h } });
  };

  const png = useMemo(() => {
    if (opts.format !== 'png' || !scene) return null;
    try {
      return pngPixelSize(scene, opts);
    } catch {
      return null;
    }
  }, [opts, scene]);

  const yantraMm = useMemo(() => {
    if (!scene) return design.sizeMm;
    try {
      return 2 * scene.extent * computePlacement(scene, opts).scale;
    } catch {
      return design.sizeMm;
    }
  }, [scene, opts, design.sizeMm]);

  const summary = [
    opts.format.toUpperCase(),
    opts.page
      ? `${pageMatch ? pageMatch.label.split(' (')[0] : t('export.page')} ${Math.round(opts.page.widthMm)} × ${Math.round(opts.page.heightMm)} mm`
      : `${Math.round(yantraMm)} × ${Math.round(yantraMm)} mm`,
    opts.page && opts.fitToPage ? t('export.sumFitted', { n: Math.round(yantraMm) }) : null,
    opts.lineOnly ? t('export.sumLines') : null,
    opts.hairline ? t('export.sumHair') : null,
    opts.mirror ? t('export.sumMirror') : null,
    !opts.includeText ? t('export.sumNoText') : null,
    opts.format === 'png' && png ? `${png.width} × ${png.height} px` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const run = async () => {
    setBusy(true);
    try {
      studio.getState().setExportOptions(opts);
      const shaper = await ensureShaper();
      const full = buildScene(design, shaper ?? undefined);
      if (!full.report.ok) throw new Error(t('shape.invalid'));
      const { blob, filename } = await exportScene(full, opts, design.name);
      const how = await deliver(blob, filename);
      studio.getState().saveNow();
      showToast(how === 'shared' ? t('export.sharedToast', { name: filename }) : t('export.savedToast', { name: filename }), 'success', 5000);
      onClose();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error && e.message ? e.message : String(e);
      showToast(t('export.failed', { msg }), 'error', 7000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      modal
      detents={[0.94]}
      label={t('export.title')}
      title={t('export.title')}
      headerLeft={
        <button type="button" className="text-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      }
      className="export-sheet"
      footer={
        <div className="export-footer">
          <p className="export-summary" aria-live="polite">
            {summary}
          </p>
          <button type="button" className="btn btn--filled btn--block btn--large" onClick={run} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="share" />}
            <span>{busy ? t('export.working') : t('export.save')}</span>
          </button>
        </div>
      }
    >
      <div className="panel">
        <Group title={t('export.kind')}>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={opts.format === f}
              className={`format-row${opts.format === f ? ' is-on' : ''}`}
              onClick={() => set(f === 'dxf' ? { format: f, lineOnly: true } : { format: f })}
            >
              <span className="format-badge">{f.toUpperCase()}</span>
              <span className="row-text">
                <span className="row-label">{t(`export.${f}` as TKey)}</span>
                <span className="row-sub">{t(`export.${f}Sub` as TKey)}</span>
              </span>
              <span className="radio-mark" aria-hidden="true">
                {opts.format === f && <Icon name="check" size={18} strokeWidth={2.6} />}
              </span>
            </button>
          ))}
        </Group>

        <Group title={t('export.sheet')}>
          <Block>
            <Segmented
              label={t('export.sheet')}
              value={opts.page ? 'page' : 'exact'}
              onChange={(v) => {
                if (v === 'exact') set({ page: null });
                else choosePage(pages.find((p) => p.id === 'a4')?.id ?? pages[0]?.id ?? '', false);
              }}
              options={[
                { value: 'exact', label: t('export.exact') },
                { value: 'page', label: t('export.onPage') },
              ]}
            />
          </Block>
          {opts.page ? (
            <>
              <Block>
                <label className="block-label" htmlFor="page-select">
                  {t('export.pageSize')}
                </label>
                <select id="page-select" className="select" value={pageMatch?.id ?? ''} onChange={(e) => choosePage(e.target.value)}>
                  {!pageMatch && <option value="">{`${Math.round(opts.page.widthMm)} × ${Math.round(opts.page.heightMm)} mm`}</option>}
                  {grouped.map(([g, list]) => (
                    <optgroup key={g} label={g}>
                      {list.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Block>
              <Block>
                <Segmented
                  label={t('export.orientation')}
                  value={landscape ? 'land' : 'port'}
                  onChange={(v) => opts.page && set({ page: v === 'land' ? { widthMm: Math.max(opts.page.widthMm, opts.page.heightMm), heightMm: Math.min(opts.page.widthMm, opts.page.heightMm) } : { widthMm: Math.min(opts.page.widthMm, opts.page.heightMm), heightMm: Math.max(opts.page.widthMm, opts.page.heightMm) } })}
                  options={[
                    { value: 'port', label: t('export.portrait') },
                    { value: 'land', label: t('export.landscape') },
                  ]}
                />
              </Block>
              <Row label={t('export.fit')} sub={t('export.fitSub')}>
                <Switch label={t('export.fit')} checked={opts.fitToPage} onChange={(v) => set({ fitToPage: v })} />
              </Row>
            </>
          ) : (
            <p className="group-note">{t('export.exactSub', { n: Math.round(design.sizeMm) })}</p>
          )}
          <Row label={t('export.margin')}>
            <Stepper label={t('export.margin')} value={opts.marginMm} min={0} max={100} step={5} format={(v) => `${v} mm`} onChange={(v) => set({ marginMm: v })} />
          </Row>
        </Group>

        <Group title={t('export.options')}>
          <Row label={t('export.lineOnly')} sub={t('export.lineOnlySub')}>
            <Switch label={t('export.lineOnly')} checked={opts.lineOnly} onChange={(v) => set({ lineOnly: v })} />
          </Row>
          <Row label={t('export.hairline')} sub={t('export.hairlineSub')}>
            <Switch label={t('export.hairline')} checked={opts.hairline} onChange={(v) => set({ hairline: v })} />
          </Row>
          <Row label={t('export.mirror')} sub={t('export.mirrorSub')}>
            <Switch label={t('export.mirror')} checked={opts.mirror} onChange={(v) => set({ mirror: v })} />
          </Row>
          <Row label={t('export.includeText')}>
            <Switch label={t('export.includeText')} checked={opts.includeText} onChange={(v) => set({ includeText: v })} />
          </Row>
          <Row label={t('export.includeGuides')}>
            <Switch label={t('export.includeGuides')} checked={opts.includeGuides} onChange={(v) => set({ includeGuides: v })} />
          </Row>
          {!opts.lineOnly && (
            <Row label={t('export.background')}>
              <Switch label={t('export.background')} checked={opts.background} onChange={(v) => set({ background: v })} />
            </Row>
          )}
        </Group>

        {opts.format === 'png' && (
          <Group title={t('export.resolution')} footer={png ? `${png.width} × ${png.height} ${t('export.pixels')}` : undefined}>
            <Block>
              <Chips label={t('export.resolution')} value={opts.dpi} onChange={(v) => set({ dpi: v })} options={[150, 300, 600].map((d) => ({ value: d, label: `${d} DPI` }))} />
            </Block>
            {png?.clamped && (
              <div className="inline-note" role="status">
                <Icon name="warn" size={18} />
                <span>{t('export.clamped')}</span>
              </div>
            )}
          </Group>
        )}
      </div>
    </Sheet>
  );
}
