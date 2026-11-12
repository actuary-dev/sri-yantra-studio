/** iOS-style segmented control, keyboard operable (arrow keys), as a radio group. */
import { useRef, type ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** accessible name when the label is not plain text */
  aria?: string;
}

export interface SegmentedProps<T extends string | number> {
  value: T;
  options: SegmentOption<T>[];
  onChange(value: T): void;
  label: string;
  size?: 'normal' | 'small';
  className?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, label, size = 'normal', className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e: React.KeyboardEvent) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`segmented${size === 'small' ? ' segmented--small' : ''}${className ? ` ${className}` : ''}`}
      style={{ ['--seg-n' as string]: options.length, ['--seg-i' as string]: idx }}
      onKeyDown={onKey}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.aria}
          tabIndex={o.value === value ? 0 : -1}
          className="segmented-item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
