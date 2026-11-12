/** Grouped inset list building blocks (iOS Settings style). */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Group({ title, footer, children, className }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`group${className ? ` ${className}` : ''}`}>
      {title && <h3 className="group-title">{title}</h3>}
      <div className="group-body">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  );
}

/** A simple row: label on the left, control on the right. */
export function Row({ label, sub, children, icon }: { label: ReactNode; sub?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="row">
      {icon && <span className="row-icon">{icon}</span>}
      <div className="row-text">
        <div className="row-label">{label}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {children !== undefined && <div className="row-control">{children}</div>}
    </div>
  );
}

/** A full-width stacked row (control below the label). */
export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`block${className ? ` ${className}` : ''}`}>{children}</div>;
}

/** A tappable row (button) with an optional chevron. */
export function ButtonRow({
  label,
  sub,
  onClick,
  icon,
  accent,
  destructive,
  chevron,
  value,
}: {
  label: ReactNode;
  sub?: ReactNode;
  onClick(): void;
  icon?: ReactNode;
  accent?: boolean;
  destructive?: boolean;
  chevron?: boolean;
  value?: ReactNode;
}) {
  return (
    <button type="button" className={`row row--button${accent ? ' is-accent' : ''}${destructive ? ' is-destructive' : ''}`} onClick={onClick}>
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-text">
        <span className="row-label">{label}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value">{value}</span>}
      {chevron && <Icon name="chevronRight" size={18} className="row-chevron" />}
    </button>
  );
}

/** Horizontal row of selectable chips. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; aria?: string }[];
  value: T | null;
  onChange(v: T): void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`chip${o.value === value ? ' is-on' : ''}`}
          aria-pressed={o.value === value}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
