/**
 * Bottom sheet with a grabber and detents (iOS style). Drag the header to move
 * between detents or swipe down to close. With `modal` it has a backdrop and,
 * on large screens, becomes a centred card.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery, useViewportSize } from '../hooks';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  /** accessible name */
  label: string;
  title?: ReactNode;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  /** fractions of the viewport height */
  detents?: number[];
  initialDetent?: number;
  modal?: boolean;
  /** px kept free below the sheet (tab bar) */
  bottomOffset?: number;
  /** px kept free above the sheet (top bar) */
  topReserve?: number;
  onHeightChange?(px: number): void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  label,
  title,
  headerLeft,
  headerRight,
  detents = [0.42, 0.88],
  initialDetent = 0,
  modal = false,
  bottomOffset = 0,
  topReserve = 0,
  onHeightChange,
  children,
  footer,
  className,
}: SheetProps) {
  const vp = useViewportSize();
  const card = useMediaQuery('(min-width: 700px) and (min-height: 560px)') && modal;
  const [idx, setIdx] = useState(initialDetent);
  const [drag, setDrag] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const dragRef = useRef<{ y0: number; t0: number; id: number; moved: boolean } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const avail = Math.max(160, vp.h - topReserve - bottomOffset - 6);
  const heights = detents.map((f) => Math.round(Math.min(f * vp.h, avail)));
  const cur = Math.min(idx, heights.length - 1);
  const visible = heights[cur];

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = () => {
    setClosing(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => closeRef.current(), reduce ? 0 : 180);
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (open) {
      setIdx(initialDetent);
      setClosing(false);
    }
  }, [open, initialDetent]);

  useEffect(() => {
    if (open && !card) onHeightChange?.(visible);
  }, [open, visible, card, onHeightChange]);

  useEffect(() => {
    if (!open || !modal) return;
    const prev = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    return () => prev?.focus?.();
  }, [open, modal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // a non-modal sheet leaves Escape to any modal dialog that is open above it
        if (!modal && document.querySelector('.sheet--modal, .dialog')) return;
        e.stopPropagation();
        requestCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (card) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { y0: e.clientY, t0: performance.now(), id: e.pointerId, moved: false };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    let dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    const maxUp = heights[heights.length - 1] - visible;
    if (dy < -maxUp) dy = -maxUp - Math.sqrt(-dy - maxUp) * 2; // rubber band
    setDrag(dy);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    const dy = drag ?? 0;
    setDrag(null);
    if (!d.moved) {
      // tap on the grabber: toggle detent
      if (heights.length > 1) setIdx(cur === heights.length - 1 ? 0 : heights.length - 1);
      return;
    }
    const v = dy / Math.max(1, performance.now() - d.t0); // px per ms
    const target = visible - dy - v * 120;
    if (target < heights[0] * 0.6) {
      requestClose();
      return;
    }
    let best = 0;
    heights.forEach((h, i) => {
      if (Math.abs(h - target) < Math.abs(heights[best] - target)) best = i;
    });
    setIdx(best);
  };

  const style: React.CSSProperties = card
    ? {}
    : {
        height: visible,
        bottom: bottomOffset,
        transform: drag ? `translateY(${drag}px)` : undefined,
        transition: drag !== null ? 'none' : undefined,
      };

  const node = (
    <>
      {modal && <div className={`sheet-backdrop${closing ? ' is-closing' : ''}`} onClick={requestClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        className={`sheet${modal ? ' sheet--modal' : ''}${card ? ' sheet--card' : ''}${closing ? ' is-closing' : ''}${className ? ` ${className}` : ''}`}
        style={style}
        role="dialog"
        aria-modal={modal || undefined}
        aria-label={label}
        tabIndex={-1}
      >
        <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {!card && <div className="sheet-grabber" aria-hidden="true" />}
          {(title || headerLeft || headerRight) && (
            <div className="sheet-titlebar">
              <div className="sheet-titlebar-side">{headerLeft}</div>
              <h2 className="sheet-title">{title}</h2>
              <div className="sheet-titlebar-side sheet-titlebar-side--right">{headerRight}</div>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
  return modal ? createPortal(node, document.body) : node;
}
