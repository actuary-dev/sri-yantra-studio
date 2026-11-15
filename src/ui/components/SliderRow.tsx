/** A labelled slider row: title, value read-out, native range input (keyboard operable). */
import { useId, type ReactNode } from 'react';
import { NumberField } from './NumberField';

export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
  /** text shown at the right of the title */
  display?: string;
  disabled?: boolean;
  /** logarithmic mapping (for line weights) */
  log?: boolean;
  hint?: ReactNode;
  /**
   * show an editable number field instead of the plain read-out. A typed number is kept
   * exactly (it is not rounded to the slider's step). `scale` converts the stored value to
   * the unit shown, e.g. scene units to millimetres.
   */
  numeric?: { digits: number; suffix?: string; scale?: number };
  /** told when a drag starts / ends */
  onActiveChange?(active: boolean): void;
}

const LOG_STEPS = 1000;

export function SliderRow({ label, value, min, max, step, onChange, display, disabled, log, hint, numeric, onActiveChange }: SliderRowProps) {
  const id = useId();
  const snap = (v: number) => {
    const s = Math.round(v / step) * step;
    const d = Math.max(0, Math.ceil(-Math.log10(step)));
    return Math.min(max, Math.max(min, +s.toFixed(d + 1)));
  };
  const safe = Number.isFinite(value) ? value : min;
  const pos = log ? (LOG_STEPS * Math.log(Math.max(min, safe) / min)) / Math.log(max / min) : safe;
  const pct = Math.min(100, Math.max(0, log ? (pos / LOG_STEPS) * 100 : ((safe - min) / (max - min || 1)) * 100));

  return (
    <div className={`slider-row${disabled ? ' is-disabled' : ''}`}>
      <div className="slider-head">
        <label htmlFor={id} className="slider-label">
          {label}
        </label>
        {numeric ? (
          <NumberField
            value={value * (numeric.scale ?? 1)}
            onChange={(v) => onChange(Math.min(max, Math.max(min, v / (numeric.scale ?? 1))))}
            min={min * (numeric.scale ?? 1)}
            max={max * (numeric.scale ?? 1)}
            digits={numeric.digits}
            suffix={numeric.suffix}
            label={label}
          />
        ) : (
          <span className="slider-value" aria-hidden="true">
            {display ?? String(value)}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={log ? 0 : min}
        max={log ? LOG_STEPS : max}
        step={log ? 1 : step}
        value={pos}
        disabled={disabled}
        aria-valuetext={display}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          const v = log ? min * Math.pow(max / min, raw / LOG_STEPS) : raw;
          onChange(snap(v));
        }}
        onPointerDown={() => onActiveChange?.(true)}
        onPointerUp={() => onActiveChange?.(false)}
        onPointerCancel={() => onActiveChange?.(false)}
        onBlur={() => onActiveChange?.(false)}
      />
      {hint && <div className="row-hint">{hint}</div>}
    </div>
  );
}
