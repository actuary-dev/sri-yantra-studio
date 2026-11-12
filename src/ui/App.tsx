/** Root component: screen routing (just state), error boundary, toasts. */
import { useEffect } from 'react';
import { useStudio } from './store';
import { useLang, useT } from './i18n';
import { Gallery } from './Gallery';
import { Editor } from './Editor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastHost } from './components/Toast';

function Crash({ error, reset }: { error: Error; reset(): void }) {
  const t = useT();
  return (
    <div className="crash" role="alert">
      <h1>{t('error.title')}</h1>
      <p>{t('error.body')}</p>
      <p className="muted small">{error.message}</p>
      <div className="crash-actions">
        <button type="button" className="btn btn--filled" onClick={reset}>
          {t('common.retry')}
        </button>
        <button type="button" className="btn btn--tinted" onClick={() => location.reload()}>
          {t('error.reload')}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const screen = useStudio((s) => s.screen);
  const hasDesign = useStudio((s) => s.design !== null);
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);
  return (
    <>
      <ErrorBoundary resetKey={screen} fallback={(e, reset) => <Crash error={e} reset={reset} />}>
        {screen === 'editor' && hasDesign ? <Editor /> : <Gallery />}
      </ErrorBoundary>
      <ToastHost />
    </>
  );
}
