/** Numeric text field that commits on Enter / blur and clamps to its range. */
import { useEffect, useState } from 'react';

export interface NumberFieldProps {
  value: number;
  onChange(v: number): void;
  min: number;
  max: number;
  /** decimals shown */
  digits?: number;
  label: string;
  suffix?: string;
  className?: string;
  large?: boolean;
}

export function NumberField({ value, onChange, min, max, digits = 0, label, suffix, className, large }: NumberFieldProps) {
  const fmt = (v: number) => (Number.isFinite(v) ? String(+v.toFixed(digits)) : '');
  const [text, setText] = useState(fmt(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing, digits]);

  const commit = () => {
    setEditing(false);
    const v = parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(v)) {
      setText(fmt(value));
      return;
    }
    const c = Math.min(max, Math.max(min, v));
    setText(fmt(c));
    if (c !== value) onChange(c);
  };

  return (
    <span className={`numfield${large ? ' numfield--large' : ''}${className ? ` ${className}` : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={label}
        value={text}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setText(fmt(value));
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
      {suffix && <span className="numfield-suffix">{suffix}</span>}
    </span>
  );
}
