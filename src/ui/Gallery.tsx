/** Home screen: starting designs and the user's saved yantras. */
import { memo, useState } from 'react';
import type { Design } from '../core/types';
import { PRESETS, type Preset } from '../presets';
import { YantraView } from './YantraView';
import { useThumbScene, dropThumbs } from './thumbs';
import { studio, useStudio } from './store';
import { showToast } from './runtime';
import { useT, useLang } from './i18n';
import { Segmented } from './components/Segmented';
import { Icon } from './components/Icon';
import { ActionSheet } from './components/ActionSheet';
import { PromptDialog } from './components/PromptDialog';
import { HelpSheet } from './HelpSheet';

const Thumb = memo(function Thumb({ thumbKey, make, alt }: { thumbKey: string; make: () => Design; alt: string }) {
  const entry = useThumbScene(thumbKey, make);
  if (!entry) return <div className="thumb thumb--loading" aria-hidden="true" />;
  if (entry === 'error')
    return (
      <div className="thumb thumb--error" aria-hidden="true">
        <Icon name="yantra" size={48} strokeWidth={1.2} />
      </div>
    );
  const minSw = (2 * entry.extent * 1.03) / 220;
  return (
    <div className="thumb">
      <YantraView scene={entry} minStrokeUnits={minSw} title={alt} />
    </div>
  );
});

function openPreset(p: Preset, errorText: string) {
  try {
    studio.getState().open(p.make());
  } catch (e) {
    console.error(e);
    showToast(errorText, 'error');
  }
}

export function Gallery() {
  const t = useT();
  const lang = useLang();
  const library = useStudio((s) => s.library);
  const [tab, setTab] = useState<'designs' | 'mine'>('designs');
  const [menuFor, setMenuFor] = useState<Design | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Design | null>(null);
  const [renaming, setRenaming] = useState<Design | null>(null);
  const [help, setHelp] = useState(false);

  const fmtDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleDateString(lang === 'hi' ? 'hi-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return new Date(ms).toDateString();
    }
  };

  return (
    <div className="gallery">
      <header className="gallery-bar">
        <Segmented
          size="small"
          label={t('lang.label')}
          value={lang}
          onChange={(l) => studio.getState().setLang(l)}
          options={[
            { value: 'en', label: 'EN', aria: 'English' },
            { value: 'hi', label: 'हिन्दी', aria: 'हिन्दी' },
          ]}
        />
        <button type="button" className="icon-btn" onClick={() => setHelp(true)} aria-label={t('help.open')}>
          <Icon name="help" />
        </button>
      </header>

      <main className="gallery-main">
        <div className="large-title">
          <h1>{t('app.title')}</h1>
          <p className="large-subtitle deva" lang="sa">
            यन्त्र
          </p>
        </div>

        <Segmented<'designs' | 'mine'>
          className="gallery-tabs"
          label={t('gallery.tabs')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'designs', label: t('gallery.designs') },
            { value: 'mine', label: `${t('gallery.mine')}${library.length ? ` (${library.length})` : ''}` },
          ]}
        />

        {tab === 'designs' ? (
          <>
            <p className="gallery-intro">{t('gallery.intro')}</p>
            {(['forms', 'numbers', 'sri'] as const).map((cat) => (
              <section key={cat} aria-label={t(`gallery.cat.${cat}`)}>
                <h2 className="group-title" style={{ margin: '22px 4px 10px', fontSize: 15 }}>{t(`gallery.cat.${cat}`)}</h2>
                <div className="card-grid">
                  {PRESETS.filter((p) => p.category === cat).map((p) => {
                    const name = lang === 'hi' ? p.nameHi : p.name;
                    return (
                      <button key={p.id} type="button" className="card" onClick={() => openPreset(p, t('error.preset'))}>
                        <Thumb thumbKey={`preset:${p.id}`} make={p.make} alt={name} />
                        <span className="card-text">
                          <span className="card-title">{name}</span>
                          <span className="card-sub">{lang === 'hi' ? p.blurbHi : p.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        ) : library.length === 0 ? (
          <div className="empty">
            <Icon name="yantra" size={64} strokeWidth={1.1} />
            <h2>{t('mine.emptyTitle')}</h2>
            <p>{t('mine.emptyHint')}</p>
            <button type="button" className="btn btn--tinted" onClick={() => setTab('designs')}>
              {t('mine.browse')}
            </button>
          </div>
        ) : (
          <div className="card-grid">
            {library.map((d) => (
              <div key={d.id} className="card card--saved">
                <button type="button" className="card-main" onClick={() => studio.getState().open(d)}>
                  <Thumb thumbKey={`saved:${d.id}:${d.updatedAt}`} make={() => d} alt={d.name} />
                  <span className="card-text">
                    <span className="card-title">{d.name}</span>
                    <span className="card-sub">
                      {fmtDate(d.updatedAt)} · {Math.round(d.sizeMm)} mm
                    </span>
                  </span>
                </button>
                <button type="button" className="card-more icon-btn" aria-label={t('mine.actionsFor', { name: d.name })} onClick={() => setMenuFor(d)}>
                  <Icon name="more" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <ActionSheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        cancelLabel={t('common.cancel')}
        actions={
          menuFor
            ? [
                { label: t('mine.open'), onSelect: () => studio.getState().open(menuFor) },
                {
                  label: t('mine.duplicate'),
                  onSelect: () => {
                    if (studio.getState().duplicate(menuFor.id)) showToast(t('mine.duplicated'), 'success');
                  },
                },
                { label: t('mine.rename'), onSelect: () => setRenaming(menuFor) },
                { label: t('mine.delete'), destructive: true, onSelect: () => setConfirmDelete(menuFor) },
              ]
            : []
        }
      />
      <ActionSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('mine.deleteTitle', { name: confirmDelete?.name ?? '' })}
        message={t('mine.deleteMsg')}
        cancelLabel={t('common.cancel')}
        actions={
          confirmDelete
            ? [
                {
                  label: t('mine.delete'),
                  destructive: true,
                  onSelect: () => {
                    dropThumbs(`saved:${confirmDelete.id}:`);
                    studio.getState().remove(confirmDelete.id);
                  },
                },
              ]
            : []
        }
      />
      <PromptDialog
        open={!!renaming}
        title={t('mine.renameTitle')}
        initial={renaming?.name ?? ''}
        okLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onSubmit={(v) => renaming && studio.getState().rename(renaming.id, v)}
        onClose={() => setRenaming(null)}
      />
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
