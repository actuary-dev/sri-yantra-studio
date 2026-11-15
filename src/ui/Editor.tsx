/** The editor screen: top bar, live canvas, panels (bottom sheets or inspector). */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { angleAt, lineDirection } from '../core';
import type { Design, Scene } from '../core/types';
import { newId } from '../presets';
import { Canvas, type Insets } from './Canvas';
import { studio, useStudio } from './store';
import { editorUI, setEditorUI, showToast, useEditorUI, useShaper, type PanelId } from './runtime';
import { placeAnchors, safeBuildScene } from './sceneUtil';
import { useT } from './i18n';
import { useElementHeight, useMediaQuery } from './hooks';
import { Icon, type IconName } from './components/Icon';
import { Sheet } from './components/Sheet';
import { Segmented } from './components/Segmented';
import { PromptDialog } from './components/PromptDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SliderRow } from './components/SliderRow';
import { SanskritInput } from './components/SanskritInput';
import { CentrePanel } from './panels/CentrePanel';
import { RingsPanel } from './panels/RingsPanel';
import { TextPanel } from './panels/TextPanel';
import { StylePanel } from './panels/StylePanel';
import { ExportSheet, loadExportModule } from './ExportSheet';
import { HelpSheet } from './HelpSheet';

export interface PanelProps {
  design: Design;
  scene: Scene;
}

const TABS: { id: PanelId; icon: IconName; key: 'tab.shape' | 'tab.rings' | 'tab.text' | 'tab.style' }[] = [
  { id: 'shape', icon: 'tabShape', key: 'tab.shape' },
  { id: 'rings', icon: 'tabRings', key: 'tab.rings' },
  { id: 'text', icon: 'tabText', key: 'tab.text' },
  { id: 'style', icon: 'tabStyle', key: 'tab.style' },
];

function PanelContent({ id, design, scene }: PanelProps & { id: PanelId }) {
  const t = useT();
  return (
    <ErrorBoundary
      resetKey={id}
      fallback={(_e, reset) => (
        <div className="panel-error">
          <p>{t('error.panel')}</p>
          <button type="button" className="btn btn--tinted" onClick={reset}>
            {t('common.retry')}
          </button>
        </div>
      )}
    >
      <div className="panel">
        {id === 'shape' && <CentrePanel design={design} scene={scene} />}
        {id === 'rings' && <RingsPanel design={design} scene={scene} />}
        {id === 'text' && <TextPanel design={design} scene={scene} />}
        {id === 'style' && <StylePanel design={design} scene={scene} />}
      </div>
    </ErrorBoundary>
  );
}

/** Compact editor for a new piece of text after a place was tapped. */
function PlaceEditor({ scene, bottomOffset, topReserve }: { scene: Scene; bottomOffset: number; topReserve: number }) {
  const t = useT();
  const pending = useEditorUI((s) => s.pending);
  const design = useStudio((s) => s.design);
  const defaultSize = design ? Math.max(3, Math.round(design.sizeMm * 0.02)) : 6;
  const [text, setText] = useState('');
  const [size, setSize] = useState(defaultSize);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (pending) {
      setText('');
      setSize(defaultSize);
      setAngle(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  const close = () => setEditorUI({ pending: null, panel: 'text' });
  const add = () => {
    if (!pending || !text.trim()) return;
    const id = newId('t');
    studio.getState().update((d) => {
      d.text.visible = true;
      d.text.custom.push({ id, text: text.trim(), x: pending.x, y: pending.y, sizeMm: size, angleDeg: angle });
    });
    setEditorUI({ pending: null, panel: 'text', selectedCustomId: id });
  };
  const maxSize = Math.max(20, Math.round((design?.sizeMm ?? 300) / 6));
  return (
    <Sheet
      open={!!pending}
      onClose={close}
      label={t('place.title')}
      title={t('place.title')}
      detents={[0.5, 0.88]}
      bottomOffset={bottomOffset}
      topReserve={topReserve}
      headerLeft={
        <button type="button" className="text-btn" onClick={close}>
          {t('common.cancel')}
        </button>
      }
      headerRight={
        <button type="button" className="text-btn is-strong" onClick={add} disabled={!text.trim()}>
          {t('common.add')}
        </button>
      }
    >
      <div className="panel">
        <div className="group">
          <div className="group-body">
            <div className="block">
              <SanskritInput value={text} onChange={setText} label={t('place.text')} placeholder="ॐ" autoFocus />
            </div>
            <div className="block">
              <SliderRow label={t('text.size')} value={size} min={1} max={maxSize} step={0.5} display={`${size.toFixed(1)} mm`} onChange={setSize} />
            </div>
            <div className="block">
              <SliderRow label={t('text.angle')} value={angle} min={-180} max={180} step={1} numeric={{ digits: 0, suffix: '°' }} onChange={setAngle} />
            </div>
          </div>
        </div>
        <p className="group-footer">{scene.anchors.length ? t('place.hintAfter') : ''}</p>
      </div>
    </Sheet>
  );
}

export function Editor() {
  const t = useT();
  const design = useStudio((s) => s.design) as Design;
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const shaper = useShaper();
  const wide = useMediaQuery('(min-width: 900px)');
  const panel = useEditorUI((s) => s.panel);
  const placeMode = useEditorUI((s) => s.placeMode);
  const drawId = useEditorUI((s) => s.drawFigureId);
  const measure = useEditorUI((s) => s.measure);
  const pending = useEditorUI((s) => s.pending);
  const selectedId = useEditorUI((s) => s.selectedCustomId);
  const exportOpen = useEditorUI((s) => s.exportOpen);
  const helpOpen = useEditorUI((s) => s.helpOpen);
  const [renaming, setRenaming] = useState(false);
  const [topEl, setTopEl] = useState<HTMLElement | null>(null);
  const [tabEl, setTabEl] = useState<HTMLElement | null>(null);
  const topH = useElementHeight(topEl);
  const tabH = useElementHeight(tabEl);
  const [sheetH, setSheetH] = useState(0);

  // the design that feeds the (expensive) scene lags behind fast slider drags
  const deferred = useDeferredValue(design);
  const built = useMemo(() => safeBuildScene(deferred, shaper), [deferred, shaper]);
  const lastGood = useRef<Scene | null>(null);
  if (built.scene && built.scene.report.ok) lastGood.current = built.scene;
  const scene = built.scene && built.scene.report.ok ? built.scene : lastGood.current ?? built.scene;
  const invalid = !!built.scene && !built.scene.report.ok;

  const activePanel: PanelId | null = wide ? panel ?? 'shape' : panel;
  const sheetOpen = !wide && panel !== null && !placeMode && !pending && !drawId && !measure;

  // warm up the export module in the background
  useEffect(() => {
    const id = setTimeout(() => loadExportModule().catch(() => undefined), 2500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => () => setEditorUI({ panel: null, placeMode: false, pending: null, selectedCustomId: null, drawFigureId: null, measure: null, exportOpen: false, helpOpen: false }), []);

  // keyboard shortcuts: undo / redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        studio.getState().undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        studio.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const insets: Insets = useMemo(
    () => ({ top: topH, right: 0, left: 0, bottom: wide ? 0 : tabH + (sheetOpen ? sheetH : 0) }),
    [topH, tabH, sheetH, sheetOpen, wide],
  );

  const anchors = useMemo(() => (scene ? placeAnchors(scene.anchors) : []), [scene]);
  const dragOffset = useRef({ x: 0, y: 0 });

  const unitMm = scene?.unitMm ?? 1;
  const hitLabel = useCallback(
    (x: number, y: number, s: number) => {
      let best: { id: string; d: number } | null = null;
      for (const c of design.text.custom) {
        const r = Math.max((c.sizeMm / unitMm) * 0.8, 26 / s);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d <= r && (!best || d < best.d)) best = { id: c.id, d };
      }
      return best?.id ?? null;
    },
    [design.text.custom, unitMm],
  );

  const onTap = useCallback(
    (x: number, y: number, s: number) => {
      const ui = editorUI.getState();
      if (ui.measure) {
        // measuring: each tap takes the nearest exact corner or crossing when there is one close by
        let near: { x: number; y: number; d: number } | null = null;
        for (const a of anchors) {
          const d = Math.hypot(a.x - x, a.y - y);
          if (!near || d < near.d) near = { x: a.x, y: a.y, d };
        }
        const pt = near && near.d <= 20 / s ? { x: near.x, y: near.y } : { x, y };
        setEditorUI({ measure: ui.measure.length >= 3 ? [pt] : [...ui.measure, pt] });
        return;
      }
      if (ui.drawFigureId) {
        // drawing a free shape: each tap adds a point, joining to a nearby corner or crossing when there is one
        let near: { x: number; y: number; d: number } | null = null;
        for (const a of anchors) {
          const d = Math.hypot(a.x - x, a.y - y);
          if (!near || d < near.d) near = { x: a.x, y: a.y, d };
        }
        let pt = near && near.d <= 20 / s ? { x: near.x, y: near.y } : { x, y };
        const fid = ui.drawFigureId;
        const snapDeg = ui.drawSnapDeg;
        studio.getState().update((d) => {
          const f = (d.centre ?? []).find((q) => q.id === fid);
          if (!f || f.type !== 'free') return;
          const last = f.points[f.points.length - 1];
          if (last && snapDeg > 0 && !(near && near.d <= 20 / s)) {
            // keep the new line on an exact multiple of the chosen angle, at the length that was tapped
            const len = Math.hypot(pt.x - last.x, pt.y - last.y);
            const step = (snapDeg * Math.PI) / 180;
            const a = Math.round(Math.atan2(pt.y - last.y, pt.x - last.x) / step) * step;
            pt = { x: last.x + len * Math.cos(a), y: last.y + len * Math.sin(a) };
          }
          f.points.push(pt);
        });
        return;
      }
      if (ui.placeMode) {
        let best: { a: (typeof anchors)[number]; d: number } | null = null;
        for (const a of anchors) {
          const d = Math.hypot(a.x - x, a.y - y);
          if (!best || d < best.d) best = { a, d };
        }
        const snap = best && best.d <= 24 / s ? best.a : null;
        setEditorUI({ placeMode: false, pending: snap ? { x: snap.x, y: snap.y, anchorId: snap.id } : { x, y, anchorId: null } });
        return;
      }
      const textOpen = (wide ? ui.panel ?? 'shape' : ui.panel) === 'text';
      if (textOpen) setEditorUI({ selectedCustomId: hitLabel(x, y, s) });
    },
    [anchors, hitLabel, wide],
  );

  const dragTest = useCallback(
    (x: number, y: number, s: number) => {
      const id = editorUI.getState().selectedCustomId;
      if (!id || hitLabel(x, y, s) !== id) return false;
      const c = design.text.custom.find((l) => l.id === id);
      if (!c) return false;
      dragOffset.current = { x: c.x - x, y: c.y - y };
      return true;
    },
    [design.text.custom, hitLabel],
  );

  const onDrag = useCallback((x: number, y: number) => {
    const id = editorUI.getState().selectedCustomId;
    if (!id) return;
    const nx = x + dragOffset.current.x, ny = y + dragOffset.current.y;
    studio.getState().update(
      (d) => {
        const c = d.text.custom.find((l) => l.id === id);
        if (c) {
          c.x = nx;
          c.y = ny;
        }
      },
      { coalesceKey: `drag:${id}` },
    );
  }, []);

  const selected = selectedId ? design.text.custom.find((c) => c.id === selectedId) : undefined;
  const drawFig = drawId ? (design.centre ?? []).find((f) => f.id === drawId) : undefined;
  const drawPoints = useMemo(() => (drawFig && drawFig.type === 'free' ? drawFig.points : []), [drawFig]);
  const overlay = useCallback(
    (s: number) => (
      <g className="overlay">
        {(placeMode || drawId || measure) &&
          anchors.map((a) => (
            <circle key={a.id} cx={a.x} cy={a.y} r={(placeMode ? 5 : 3.5) / s} fill="var(--accent)" stroke="#fff" strokeWidth={1.5 / s} opacity={placeMode ? 0.9 : 0.55} />
          ))}
        {measure && measure.length > 1 && (
          <polyline points={measure.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#e67e22" strokeWidth={2.5 / s} strokeLinejoin="round" />
        )}
        {measure?.map((q, i) => (
          <circle key={`mp${i}`} cx={q.x} cy={q.y} r={6 / s} fill="#fff" stroke="#e67e22" strokeWidth={2.5 / s} />
        ))}
        {drawPoints.map((q, i) => (
          <circle key={`dp${i}`} cx={q.x} cy={q.y} r={6 / s} fill="#fff" stroke="var(--accent)" strokeWidth={2.5 / s} />
        ))}
        {selected && (
          <circle
            cx={selected.x}
            cy={selected.y}
            r={Math.max((selected.sizeMm / unitMm) * 0.75, 18 / s)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2 / s}
            strokeDasharray={`${6 / s} ${4 / s}`}
          />
        )}
      </g>
    ),
    [placeMode, drawId, measure, drawPoints, anchors, selected, unitMm],
  );

  const toggleText = () => {
    const on = !design.text.visible;
    studio.getState().update((d) => {
      d.text.visible = on;
    });
    showToast(on ? t('editor.textShown') : t('editor.textHidden'), 'info', 1800);
  };

  const onTab = (id: PanelId) => {
    setEditorUI({ panel: panel === id ? null : id, placeMode: false, drawFigureId: null, measure: null });
  };

  // what the measuring tool reads: a position, a length with its slope, or an angle between two lengths
  const mmN = (v: number, digits = 2) => (v * unitMm).toFixed(digits);
  const measureText = !measure
    ? ''
    : measure.length === 0
      ? t('measure.banner')
      : measure.length === 1
        ? t('measure.point', { x: mmN(measure[0].x), y: mmN(-measure[0].y), r: mmN(Math.hypot(measure[0].x, measure[0].y)) })
        : measure.length === 2
          ? t('measure.length', { len: mmN(Math.hypot(measure[1].x - measure[0].x, measure[1].y - measure[0].y), 3), dir: lineDirection(measure[0], measure[1]).toFixed(3) })
          : t('measure.angle', {
              deg: angleAt(measure[1], measure[0], measure[2]).toFixed(3),
              a: mmN(Math.hypot(measure[1].x - measure[0].x, measure[1].y - measure[0].y)),
              b: mmN(Math.hypot(measure[2].x - measure[1].x, measure[2].y - measure[1].y)),
            });

  return (
    <div className={`editor${wide ? ' editor--wide' : ''}`}>
      <header className="topbar material" ref={setTopEl}>
        <button type="button" className="icon-btn topbar-back" onClick={() => studio.getState().close()} aria-label={t('editor.back')}>
          <Icon name="back" />
          {wide && <span className="topbar-back-text">{t('editor.gallery')}</span>}
        </button>
        <button type="button" className="topbar-title" onClick={() => setRenaming(true)} aria-label={t('editor.renameAria', { name: design.name })}>
          <span className="topbar-title-text">{design.name}</span>
        </button>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => studio.getState().undo()} disabled={!canUndo} aria-label={t('editor.undo')}>
            <Icon name="undo" />
          </button>
          <button type="button" className="icon-btn" onClick={() => studio.getState().redo()} disabled={!canRedo} aria-label={t('editor.redo')}>
            <Icon name="redo" />
          </button>
          <button
            type="button"
            className={`text-toggle${design.text.visible ? ' is-on' : ''}`}
            onClick={toggleText}
            aria-pressed={design.text.visible}
            aria-label={t('editor.textToggle')}
            title={design.text.visible ? t('editor.textShown') : t('editor.textHidden')}
          >
            <span className="text-toggle-glyph" lang="hi">
              अ
            </span>
          </button>
          <button type="button" className={`icon-btn export-btn${wide ? ' has-label' : ''}`} onClick={() => setEditorUI({ exportOpen: true })} aria-label={t('editor.export')}>
            <Icon name="share" />
            {wide && <span>{t('editor.export')}</span>}
          </button>
        </div>
      </header>

      <div className="editor-canvas">
        {scene ? (
          <ErrorBoundary
            resetKey={scene}
            fallback={() => (
              <div className="canvas-error">
                <p>{t('error.canvas')}</p>
              </div>
            )}
          >
            <Canvas
              scene={scene}
              insets={insets}
              overlay={overlay}
              onTap={onTap}
              dragTest={dragTest}
              onDrag={onDrag}
              resetKey={design.id}
              extraControls={
                <>
                  <button type="button" className="float-btn float-btn--round" onClick={() => setEditorUI({ helpOpen: true })} aria-label={t('help.open')}>
                    <Icon name="info" size={20} />
                  </button>
                  <button
                    type="button"
                    className={`float-btn float-btn--round${measure ? ' is-on' : ''}`}
                    onClick={() => setEditorUI({ measure: measure ? null : [], placeMode: false, drawFigureId: null })}
                    aria-pressed={!!measure}
                    aria-label={t('measure.open')}
                    title={t('measure.open')}
                  >
                    <Icon name="ruler" size={20} />
                  </button>
                </>
              }
            />
          </ErrorBoundary>
        ) : (
          <div className="canvas-error">
            <p>{t('error.canvas')}</p>
            {built.error && <p className="muted small">{built.error}</p>}
          </div>
        )}

        {(invalid || placeMode || drawId || measure) && (
          <div className="canvas-banners" style={{ top: topH + 8 }}>
            {invalid && (
              <div className="banner banner--warn" role="status">
                <Icon name="warn" size={20} />
                <span>{t('shape.invalid')}</span>
              </div>
            )}
            {measure && (
              <div className="banner banner--accent banner--measure" role="status">
                <Icon name="ruler" size={20} />
                <span>{measureText}</span>
                <button type="button" className="text-btn" disabled={measure.length === 0} onClick={() => setEditorUI({ measure: [] })}>
                  {t('measure.clear')}
                </button>
                <button type="button" className="text-btn" onClick={() => setEditorUI({ measure: null })}>
                  {t('common.done')}
                </button>
              </div>
            )}
            {drawId && (
              <div className="banner banner--accent" role="status">
                <Icon name="pin" size={20} />
                <span>{t('free.banner')}</span>
                <button
                  type="button"
                  className="text-btn"
                  disabled={drawPoints.length === 0}
                  onClick={() =>
                    studio.getState().update((d) => {
                      const f = (d.centre ?? []).find((q) => q.id === drawId);
                      if (f && f.type === 'free') f.points.pop();
                    })
                  }
                >
                  {t('editor.undo')}
                </button>
                <button type="button" className="text-btn" onClick={() => setEditorUI({ drawFigureId: null, panel: 'shape' })}>
                  {t('common.done')}
                </button>
              </div>
            )}
            {placeMode && (
              <div className="banner banner--accent" role="status">
                <Icon name="pin" size={20} />
                <span>{t('place.banner')}</span>
                <button type="button" className="text-btn" onClick={() => setEditorUI({ placeMode: false, panel: 'text' })}>
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {wide && activePanel && scene && (
        <aside className="inspector material" aria-label={t('editor.inspector')} style={{ paddingTop: topH }}>
          <div className="inspector-head">
            <Segmented
              label={t('editor.panels')}
              value={activePanel}
              onChange={(id) => setEditorUI({ panel: id })}
              options={TABS.map((tb) => ({ value: tb.id, label: t(tb.key) }))}
            />
          </div>
          <div className="inspector-body">
            <PanelContent id={activePanel} design={design} scene={scene} />
          </div>
        </aside>
      )}

      {!wide && scene && (
        <>
          <Sheet
            open={sheetOpen}
            onClose={() => setEditorUI({ panel: null })}
            label={activePanel ? t(TABS.find((x) => x.id === activePanel)!.key) : ''}
            title={activePanel ? t(TABS.find((x) => x.id === activePanel)!.key) : ''}
            bottomOffset={tabH}
            topReserve={topH}
            onHeightChange={setSheetH}
          >
            {activePanel && <PanelContent id={activePanel} design={design} scene={scene} />}
          </Sheet>
          <nav className="tabbar material" ref={setTabEl} aria-label={t('editor.panels')}>
            {TABS.map((tb) => (
              <button key={tb.id} type="button" className={`tab${panel === tb.id && sheetOpen ? ' is-active' : ''}`} aria-pressed={panel === tb.id && sheetOpen} onClick={() => onTab(tb.id)}>
                <Icon name={tb.icon} size={26} />
                <span>{t(tb.key)}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {scene && <PlaceEditor scene={scene} bottomOffset={wide ? 0 : tabH} topReserve={topH} />}
      <ExportSheet open={exportOpen} onClose={() => setEditorUI({ exportOpen: false })} design={design} scene={scene} />
      <HelpSheet open={helpOpen} onClose={() => setEditorUI({ helpOpen: false })} />
      <PromptDialog
        open={renaming}
        title={t('mine.renameTitle')}
        initial={design.name}
        okLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onSubmit={(v) => studio.getState().rename(design.id, v)}
        onClose={() => setRenaming(false)}
      />
    </div>
  );
}
