/** "How to use": six illustrated steps and a short note about the geometry. */
import type { ReactNode } from 'react';
import { useT, type TKey } from './i18n';
import { Sheet } from './components/Sheet';

const ART: ReactNode[] = [
  // 1 choose a design
  <g key="1">
    <rect x="6" y="10" width="22" height="22" rx="4" />
    <rect x="34" y="10" width="22" height="22" rx="4" />
    <rect x="6" y="36" width="22" height="22" rx="4" />
    <rect x="34" y="36" width="22" height="22" rx="4" className="hl" />
    <path d="M45 41l6 10H39Z M45 53l-6-10h12Z" />
  </g>,
  // 2 adjust the shape
  <g key="2">
    <path d="M32 8 56 50H8Z" />
    <path d="M32 58 10 20h44Z" />
    <path d="M8 60h48" />
    <circle cx="38" cy="60" r="4" className="hl" />
  </g>,
  // 3 add rings
  <g key="3">
    <circle cx="32" cy="34" r="12" />
    <circle cx="32" cy="34" r="19" />
    <circle cx="32" cy="34" r="25" className="hl" strokeDasharray="4 3" />
  </g>,
  // 4 Sanskrit text and the अ button
  <g key="4">
    <rect x="10" y="16" width="44" height="32" rx="8" className="hl" />
    <text x="32" y="40" textAnchor="middle" fontSize="20" stroke="none" fill="currentColor">
      अ
    </text>
  </g>,
  // 5 set the size
  <g key="5">
    <path d="M8 54h48M8 50v8M56 50v8" />
    <circle cx="32" cy="28" r="18" />
    <path d="M20 54h24" className="hl" />
  </g>,
  // 6 save and send
  <g key="6">
    <path d="M32 8v28M22 18l10-10 10 10" className="hl" />
    <path d="M22 28h-8v28h36V28h-8" />
  </g>,
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      modal
      detents={[0.94]}
      label={t('help.title')}
      title={t('help.title')}
      headerRight={
        <button type="button" className="text-btn is-strong" onClick={onClose}>
          {t('common.done')}
        </button>
      }
    >
      <div className="panel help">
        <ol className="help-steps">
          {ART.map((art, i) => (
            <li key={i} className="help-step">
              <svg className="help-art" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                {art}
              </svg>
              <div>
                <h3>
                  <span className="help-num">{i + 1}</span> {t(`help.s${i + 1}` as TKey)}
                </h3>
                <p>{t(`help.s${i + 1}b` as TKey)}</p>
              </div>
            </li>
          ))}
        </ol>
        <section className="help-about">
          <h3>{t('help.keysTitle')}</h3>
          <p>{t('help.keys')}</p>
        </section>
        <section className="help-about">
          <h3>{t('help.aboutTitle')}</h3>
          <p>{t('help.about1')}</p>
          <p>{t('help.about2')}</p>
        </section>
      </div>
    </Sheet>
  );
}
