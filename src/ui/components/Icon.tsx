/** The few line icons the app needs, drawn as inline SVG (24 × 24 grid). */
import type { ReactNode } from 'react';

export type IconName =
  | 'back'
  | 'undo'
  | 'redo'
  | 'share'
  | 'help'
  | 'info'
  | 'plus'
  | 'more'
  | 'check'
  | 'checkCircle'
  | 'warn'
  | 'chevronRight'
  | 'chevronDown'
  | 'trash'
  | 'duplicate'
  | 'up'
  | 'down'
  | 'close'
  | 'fit'
  | 'tabShape'
  | 'tabRings'
  | 'tabText'
  | 'tabStyle'
  | 'bandCircle'
  | 'bandLotus'
  | 'bandBeads'
  | 'bandText'
  | 'bandBhupura'
  | 'pin'
  | 'pencil'
  | 'reset'
  | 'yantra'
  | 'rotateL'
  | 'rotateR'
  | 'flip'
  | 'mirror'
  | 'copies'
  | 'copy'
  | 'magnet'
  | 'multi'
  | 'upload'
  | 'download';

const P: Record<IconName, ReactNode> = {
  rotateL: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4.5v4.2h4.2" />
    </>
  ),
  rotateR: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M20 4.5v4.2h-4.2" />
    </>
  ),
  flip: (
    <>
      <path d="M12 3.5 19 10H5l7-6.5Z" />
      <path d="M12 20.5 5 14h14l-7 6.5Z" strokeDasharray="2.2 2" />
    </>
  ),
  mirror: (
    <>
      <path d="M12 3v18" strokeDasharray="2 2" />
      <path d="M9 6 3.5 18H9V6Z" />
      <path d="M15 6l5.5 12H15V6Z" />
    </>
  ),
  copies: (
    <>
      <path d="M12 3.5 16 10H8l4-6.5Z" />
      <path d="M20.5 12 14 16v-8l6.5 4Z" />
      <path d="M12 20.5 8 14h8l-4 6.5Z" />
      <path d="M3.5 12 10 8v8l-6.5-4Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  magnet: (
    <>
      <path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4H6Z" />
      <path d="M6 8h4M14 8h4" />
    </>
  ),
  multi: (
    <>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="1.5" strokeDasharray="2.2 2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </>
  ),
  back: <path d="M15 4.5 7.5 12l7.5 7.5" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v12" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4.1" />
      <circle cx="12" cy="17.6" r=".6" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.6" r=".6" fill="currentColor" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m7.5 12.3 3 3 6-6.3" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r=".6" fill="currentColor" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7 7.5 20h9l1-13" />
      <path d="M10.2 11v5.5M13.8 11v5.5" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  fit: (
    <>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </>
  ),
  tabShape: (
    <>
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 20.5 5 8.5h14L12 20.5Z" />
    </>
  ),
  tabRings: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  tabText: (
    <text x="12" y="17.5" textAnchor="middle" fontSize="15" stroke="none" fill="currentColor" fontFamily="'Tiro Devanagari Sanskrit','Noto Sans Devanagari',serif">
      अ
    </text>
  ),
  tabStyle: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  bandCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.5" />
    </>
  ),
  bandLotus: (
    <>
      <path d="M12 3c2.6 3 2.6 7 0 10-2.6-3-2.6-7 0-10Z" />
      <path d="M21 12c-3 2.6-7 2.6-10 0 3-2.6 7-2.6 10 0Z" transform="translate(-.5 1)" />
      <path d="M3 12c3 2.6 7 2.6 10 0-3-2.6-7-2.6-10 0Z" transform="translate(.5 1)" />
      <path d="M12 21c2.6-3 2.6-7 0-10-2.6 3-2.6 7 0 10Z" transform="translate(0 2) scale(1 .9)" />
    </>
  ),
  bandBeads: (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={12 + 8 * Math.cos(a)} cy={12 + 8 * Math.sin(a)} r="1.5" />;
      })}
    </>
  ),
  bandText: (
    <>
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2.2 1.6" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor" fontFamily="'Tiro Devanagari Sanskrit',serif">
        ॐ
      </text>
    </>
  ),
  bandBhupura: (
    <path d="M9.5 3.5h5v2.5h3.5v3.5h2.5v5H18v3.5h-3.5v2.5h-5V18H6v-3.5H3.5v-5H6V6h3.5V3.5Z" />
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  yantra: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 20 4.6 7.6h14.8L12 20Z" />
      <path d="M12 4.2 19 16H5l7-11.8Z" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
