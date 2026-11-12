/** Alert-style dialog with one text field (used for renaming). */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  initial: string;
  okLabel: string;
  cancelLabel: string;
  onSubmit(value: string): void;
  onClose(): void;
}

export function PromptDialog({ open, title, initial, okLabel, cancelLabel, onSubmit, onClose }: PromptDialogProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setValue(initial);
      setTimeout(() => ref.current?.select(), 30);
    }
  }, [open, initial]);
  if (!open) return null;
  const submit = () => {
    if (value.trim()) onSubmit(value.trim());
    onClose();
  };
  return createPortal(
    <div className="dialog dialog--alert" role="presentation">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <form
        className="alert"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="alert-title">{title}</div>
        <input ref={ref} className="text-input" value={value} onChange={(e) => setValue(e.target.value)} aria-label={title} enterKeyHint="done" maxLength={80} />
        <div className="alert-buttons">
          <button type="button" className="alert-btn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="submit" className="alert-btn is-strong" disabled={!value.trim()}>
            {okLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
