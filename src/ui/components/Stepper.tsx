/** iOS-style − / + stepper with the value shown between the buttons. */
export interface StepperProps {
  value: number;
  onChange(v: number): void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?(v: number): string;
  /** wrap around at the ends (for "start position") */
  wrap?: boolean;
}

export function Stepper({ value, onChange, min, max, step = 1, label, format, wrap }: StepperProps) {
  const dec = () => {
    const v = value - step;
    onChange(v < min ? (wrap ? max : min) : +v.toFixed(6));
  };
  const inc = () => {
    const v = value + step;
    onChange(v > max ? (wrap ? min : max) : +v.toFixed(6));
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={dec} disabled={!wrap && value <= min} aria-label={`${label} −`}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      <output className="stepper-value" aria-live="polite">
        {format ? format(value) : value}
      </output>
      <button type="button" className="stepper-btn" onClick={inc} disabled={!wrap && value >= max} aria-label={`${label} +`}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
