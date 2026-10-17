import type { SVGProps } from 'react';

// Icon size scale - anything outside it is an accident:
// 14 meta (table headers, fineprint icons)
// 16 row actions (heart, queue in lists)
// 18 controls (icon buttons, rail, deck, mic)
// 20 header actions and large controls (player favourite, deck play)
// 22 the big transport's prev/next
// 26 the big round play
type Props = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M8 5.2v13.6l11-6.8z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (props: Props) => (
  <Icon {...props}>
    <rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const NextIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M6 5.5v13l8.5-6.5z" fill="currentColor" stroke="none" />
    <path d="M17.5 5v14" strokeWidth={2} />
  </Icon>
);

export const PrevIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M18 5.5v13L9.5 12z" fill="currentColor" stroke="none" />
    <path d="M6.5 5v14" strokeWidth={2} />
  </Icon>
);

export const ShuffleIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M17 4h3v3" />
    <path d="M20 4l-6.5 6.5" />
    <path d="M4 20l5-5" />
    <path d="M17 20h3v-3" />
    <path d="M20 20l-5.5-5.5" />
    <path d="M4 4l4 4" />
  </Icon>
);

export const TrashIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l.9 12.5h9.2L17.5 7" />
    <path d="M10 11v5M14 11v5" />
  </Icon>
);

export const HeartIcon = ({ filled, ...props }: Props & { filled?: boolean }) => (
  <Icon {...props}>
    <path
      d="M12 20s-7.2-4.4-7.2-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7.2 2.8C19.2 15.6 12 20 12 20z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);

export const PlusIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" strokeWidth={2} />
  </Icon>
);

export const QueueIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 7h11M4 12h11M4 17h7" />
    <path d="M18 12v7" />
    <circle cx="18" cy="19.5" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
);

export const LibraryIcon = (props: Props) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
);

export const ArtistIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20.5c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
  </Icon>
);

export const RefreshIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 1 0-2.5 5.8" />
    <path d="M20 5v6h-6" />
  </Icon>
);

export const SearchIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" strokeWidth={2} />
  </Icon>
);

export const CloseIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} />
  </Icon>
);

export const ChevronDownIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M6 9.5l6 6 6-6" strokeWidth={1.8} />
  </Icon>
);

export const ChevronLeftIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M14.5 6l-6 6 6 6" strokeWidth={1.8} />
  </Icon>
);

export const VolumeIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 10v4h3l4.5 3.5v-11L7 10H4z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
  </Icon>
);

// vocal mic rather than a talk mic - the lyrics view is for singing along
// path: lucide `mic-vocal` (ISC, https://lucide.dev)
export const MicIcon = (props: Props) => (
  <Icon {...props}>
    <path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12" />
    <path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5" />
    <circle cx="16" cy="7" r="5" />
  </Icon>
);

export const ClockIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
