/** iOS-style action sheet: a stack of large buttons with a separate Cancel. */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetAction {
  label: ReactNode;
  onSelect(): void;
  destructive?: boolean;
  sub?: ReactNode;
  icon?: ReactNode;
}

export interface ActionSheetProps {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  message?: ReactNode;
  actions: SheetAction[];
  cancelLabel: string;
}

export function ActionSheet({ open, onClose, title, message, actions, cancelLabel }: ActionSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="dialog dialog--actions" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="action-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="action-group">
          {(title || message) && (
            <div className="action-head">
              {title && <div className="action-title">{title}</div>}
              {message && <div className="action-message">{message}</div>}
            </div>
          )}
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`action-btn${a.destructive ? ' is-destructive' : ''}${a.sub ? ' has-sub' : ''}`}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
            >
              {a.icon && <span className="action-icon">{a.icon}</span>}
              <span className="action-text">
                <span>{a.label}</span>
                {a.sub && <span className="action-sub">{a.sub}</span>}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="action-btn action-cancel" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
