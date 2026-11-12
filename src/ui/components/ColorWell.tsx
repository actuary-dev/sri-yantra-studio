/** A round colour well wrapping the native colour picker. */
export interface ColorWellProps {
  value: string;
  onChange(v: string): void;
  label: string;
  /** small caption under the well */
  caption?: string;
}

/** Normalise any #rgb / #rrggbb colour for <input type="color">. */
export function toHex6(c: string): string {
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  return '#000000';
}

export function ColorWell({ value, onChange, label, caption }: ColorWellProps) {
  return (
    <label className="colorwell">
      <span className="colorwell-swatch" style={{ background: value }}>
        <input type="color" value={toHex6(value)} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      </span>
      {caption && <span className="colorwell-caption">{caption}</span>}
    </label>
  );
}
