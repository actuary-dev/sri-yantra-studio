/** Toast host: small translucent capsules near the top of the screen. */
import { dismissToast, useToasts } from '../runtime';
import { Icon } from './Icon';

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast--${t.kind}`} onClick={() => dismissToast(t.id)}>
          {t.kind === 'success' && <Icon name="checkCircle" size={20} />}
          {t.kind === 'error' && <Icon name="warn" size={20} />}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
