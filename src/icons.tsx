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
export const RepeatIcon = icon(Repeat);
export const RepeatOneIcon = icon(Repeat1);
