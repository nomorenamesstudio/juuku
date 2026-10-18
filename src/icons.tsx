import {
  ChevronDown,
  ChevronLeft,
  Heart,
  Library,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  MicVocal,
  Pause,
  Play,
  Plus,
  RotateCw,
  Repeat,
  Repeat1,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  UserRound,
  X,
  LogOut,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons are lucide (ISC, https://lucide.dev) - one 24px grid, one stroke width, so
 * glyphs keep their optical weight next to each other.
 *
 * Size scale - anything outside it is an accident:
 *   16  meta (track table header, inline notes) and optically dense glyphs
 *       (mic-vocal fills its box, so it sits one step below the heart)
 *   18  everything inside a 40px button: rows, rail, tabs, header, transport
 *   20  the deck's play button
 *   22  the big transport's prev/next
 *   26  the big round play
 */
const STROKE = 1.75;

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** filled glyphs (play, pause, favourite) instead of outlines */
  filled?: boolean;
};

function icon(Glyph: LucideIcon, defaultSize = 18) {
  return function Wrapped({ size = defaultSize, filled, ...rest }: Props) {
    return (
      <Glyph
        size={size}
        strokeWidth={STROKE}
        fill={filled ? 'currentColor' : 'none'}
        aria-hidden
        {...rest}
      />
    );
  };
}

export const PlayIcon = icon(Play);
export const PauseIcon = icon(Pause);
export const NextIcon = icon(SkipForward);
export const PrevIcon = icon(SkipBack);
export const ShuffleIcon = icon(Shuffle);
export const TrashIcon = icon(Trash2);
export const HeartIcon = icon(Heart);
export const PlusIcon = icon(Plus);
export const QueueIcon = icon(ListMusic);
export const PlaylistIcon = icon(ListMusic);
export const AddToPlaylistIcon = icon(ListPlus);
export const LibraryIcon = icon(Library);
export const ArtistIcon = icon(UserRound);
export const SearchIcon = icon(Search);
export const RefreshIcon = icon(RotateCw);
export const ChevronDownIcon = icon(ChevronDown);
export const ChevronLeftIcon = icon(ChevronLeft);
export const VolumeIcon = icon(Volume2);
export const MicIcon = icon(MicVocal);
export const MoreIcon = icon(MoreHorizontal);
export const CloseIcon = icon(X);
export const LogOutIcon = icon(LogOut);
export const SettingsIcon = icon(Settings);

/** lucide dropped brand marks, so this one is a plain path */
export function GithubIcon({ size = 18, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.4-3.88-1.4-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.19 3.17-1.19.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
export const RepeatIcon = icon(Repeat);
export const RepeatOneIcon = icon(Repeat1);
