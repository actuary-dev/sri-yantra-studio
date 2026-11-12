/**
 * Sanskrit typing helper: a Devanagari text field with an optional
 * "type in English letters" mode (ITRANS → देवनागरी, live) and a row of
 * quick-insert chips.
 */
import { useEffect, useRef, useState } from 'react';
import { QUICK_INSERTS, transliterate } from '../../text';
import { studio, useStudio } from '../store';
import { useT } from '../i18n';

const FALLBACK_INSERTS: { label: string; text: string }[] = [
  ...['ॐ', 'श्रीं', 'ह्रीं', 'क्लीं', 'ऐं', 'सौः', 'नमः', '॥', '।'].map((s) => ({ label: s, text: s })),
  ...[...'०१२३४५६७८९'].map((d) => ({ label: d, text: d })),
];

function quickInserts(): { label: string; text: string }[] {
  try {
    return Array.isArray(QUICK_INSERTS) && QUICK_INSERTS.length ? QUICK_INSERTS : FALLBACK_INSERTS;
  } catch {
    return FALLBACK_INSERTS;
  }
}

export function safeTransliterate(raw: string): string {
  try {
    return transliterate(raw, 'itrans');
  } catch {
    return raw;
  }
}

export interface SanskritInputProps {
  value: string;
  onChange(v: string): void;
  label: string;
  multiline?: boolean;
  placeholder?: string;
  /** compact: no toggle and no chips (used in the letter grid); follows the shared setting */
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function SanskritInput({ value, onChange, label, multiline, placeholder, compact, autoFocus, className }: SanskritInputProps) {
  const t = useT();
  const translit = useStudio((s) => s.settings.translit);
  const [raw, setRaw] = useState(value);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // keep the Latin buffer in step with outside changes (undo, another field…)
  useEffect(() => {
    if (!translit) return;
    if (safeTransliterate(raw) !== value) setRaw(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, translit]);

  const shown = translit ? raw : value;
  const set = (next: string) => {
    if (translit) {
      setRaw(next);
      onChange(safeTransliterate(next));
    } else onChange(next);
  };

  const insert = (text: string) => {
    const el = fieldRef.current;
    const base = shown;
    const a = el?.selectionStart ?? base.length;
    const b = el?.selectionEnd ?? base.length;
    const next = base.slice(0, a) + text + base.slice(b);
    set(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const p = a + text.length;
      el.setSelectionRange(p, p);
    });
  };

  const common = {
    ref: fieldRef,
    value: shown,
    'aria-label': label,
    placeholder,
    autoFocus,
    lang: translit ? 'en' : 'sa',
    spellCheck: false,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    className: `text-input deva${translit ? ' is-latin' : ''}`,
  } as const;

  return (
    <div className={`skt${compact ? ' skt--compact' : ''}${className ? ` ${className}` : ''}`}>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => set(e.target.value)} />
      ) : (
        <input {...common} type="text" enterKeyHint="done" onChange={(e) => set(e.target.value)} />
      )}
      {translit && (
        <div className="skt-preview deva" lang="sa" aria-live="polite">
          {value || ' '}
        </div>
      )}
      {!compact && (
        <>
          <label className="skt-toggle">
            <input type="checkbox" checked={translit} onChange={(e) => studio.getState().setTranslit(e.target.checked)} />
            <span>{t('skt.toggle')}</span>
          </label>
          {translit && <div className="skt-hint">{t('skt.hint')}</div>}
          <div className="chips chips--scroll" role="group" aria-label={t('skt.quick')}>
            {quickInserts().map((q) => (
              <button
                key={q.label}
                type="button"
                className="chip deva"
                lang="sa"
                onPointerDown={(e) => e.preventDefault() /* keep the caret in the field */}
                onClick={() => insert(q.text)}
              >
                {q.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
