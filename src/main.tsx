import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { studio } from './ui/store';
import { ensureShaper } from './ui/runtime';
import { FONT_FILES } from './text';
import './ui/styles.css';

/** @font-face rules with document-relative URLs, so the app also works from a sub-path. */
function declareFonts() {
  const fallback: Record<string, { label: string; file: string }> = {
    tiro: { label: 'Tiro Devanagari Sanskrit', file: 'fonts/TiroDevanagariSanskrit-Regular.ttf' },
    'noto-sans': { label: 'Noto Sans Devanagari', file: 'fonts/NotoSansDevanagari-Regular.ttf' },
    'noto-serif': { label: 'Noto Serif Devanagari', file: 'fonts/NotoSerifDevanagari-Regular.ttf' },
  };
  let files: Record<string, { label: string; file: string }> = fallback;
  try {
    if (FONT_FILES && Object.keys(FONT_FILES).length) files = FONT_FILES;
  } catch {
    /* use fallback */
  }
  const css = Object.values(files)
    .map(
      (f) =>
        `@font-face{font-family:'${f.label}';src:url('${new URL(f.file, document.baseURI).href}') format('truetype');font-display:swap;font-weight:400;font-style:normal;}`,
    )
    .join('\n');
  const style = document.createElement('style');
  style.setAttribute('data-fonts', '');
  style.textContent = css;
  document.head.appendChild(style);
}

declareFonts();

// start loading HarfBuzz + fonts right away; the canvas uses native text until it is ready
void ensureShaper();

// never lose work when the app is closed or sent to the background
const flush = () => studio.flush();
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch((e) => console.warn('Service worker not registered', e));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
