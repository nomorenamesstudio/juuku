import { type ComponentType, useSyncExternalStore } from 'react';
import {
  PixelAddToPlaylistIcon,
  PixelAlbumsIcon,
  PixelHomeIcon,
  PixelArtistIcon,
  PixelChevronDownIcon,
  PixelChevronLeftIcon,
  PixelCloseIcon,
  PixelGithubIcon,
  PixelHeartIcon,
  PixelKebabIcon,
  PixelLibraryIcon,
  PixelLogOutIcon,
  PixelMicIcon,
  PixelMoreIcon,
  PixelNextIcon,
  PixelPauseIcon,
  PixelPlayIcon,
  PixelPlaylistIcon,
  PixelPlusIcon,
  PixelPrevIcon,
  PixelQueueIcon,
  PixelRefreshIcon,
  PixelRepeatIcon,
  PixelRepeatOneIcon,
  PixelSearchIcon,
  PixelSettingsIcon,
  PixelShuffleIcon,
  PixelTrashIcon,
  PixelVolumeIcon,
  type PixelIconProps,
} from './pixel-icons';
import {
  SolidAddToPlaylistIcon,
  SolidAlbumsIcon,
  SolidHomeIcon,
  SolidArtistIcon,
  SolidCloseIcon,
  SolidGithubIcon,
  SolidHeartIcon,
  SolidKebabIcon,
  SolidLibraryIcon,
  SolidLogOutIcon,
  SolidMicIcon,
  SolidMoreIcon,
  SolidNextIcon,
  SolidPauseIcon,
  SolidPlayIcon,
  SolidPlaylistIcon,
  SolidPlusIcon,
  SolidPrevIcon,
  SolidQueueIcon,
  SolidRefreshIcon,
  SolidRepeatIcon,
  SolidRepeatOneIcon,
  SolidSearchIcon,
  SolidSettingsIcon,
  SolidShuffleIcon,
  SolidTrashIcon,
  SolidVolumeIcon,
  type SolidIconProps,
} from './solid-icons';
import { getTheme, subscribeTheme } from './theme';
import {
  ChevronDown,
  ChevronLeft,
  Heart,
  House,
  Disc3,
  Library,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  MoreVertical,
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

/**
 * Every icon keeps its name, but the geek theme draws the pixel set instead: the
 * component subscribes to the theme, so the swap happens with the rest of the
 * repaint and no call site has to know.
 */
function icon(
  Glyph: LucideIcon,
  pixel?: ComponentType<PixelIconProps>,
  solid?: ComponentType<SolidIconProps>,
  defaultSize = 18,
) {
  return function Wrapped({ size = defaultSize, filled, ...rest }: Props) {
    const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'mocha' as const);
    if (theme === 'geek' && pixel) {
      const Pixel = pixel;
      return <Pixel size={size} {...rest} />;
    }
    if (theme === 'modern' && solid) {
      const Solid = solid;
      return <Solid size={size} {...rest} />;
    }
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

export const PlayIcon = icon(Play, PixelPlayIcon, SolidPlayIcon);
export const PauseIcon = icon(Pause, PixelPauseIcon, SolidPauseIcon);
export const NextIcon = icon(SkipForward, PixelNextIcon, SolidNextIcon);
export const PrevIcon = icon(SkipBack, PixelPrevIcon, SolidPrevIcon);
export const ShuffleIcon = icon(Shuffle, PixelShuffleIcon, SolidShuffleIcon);
export const TrashIcon = icon(Trash2, PixelTrashIcon, SolidTrashIcon);
export const HeartIcon = icon(Heart, PixelHeartIcon, SolidHeartIcon);
export const PlusIcon = icon(Plus, PixelPlusIcon, SolidPlusIcon);
export const QueueIcon = icon(ListMusic, PixelQueueIcon, SolidQueueIcon);
export const PlaylistIcon = icon(ListMusic, PixelPlaylistIcon, SolidPlaylistIcon);
export const AddToPlaylistIcon = icon(ListPlus, PixelAddToPlaylistIcon, SolidAddToPlaylistIcon);
export const HomeIcon = icon(House, PixelHomeIcon, SolidHomeIcon);
export const AlbumsIcon = icon(Disc3, PixelAlbumsIcon, SolidAlbumsIcon);
export const LibraryIcon = icon(Library, PixelLibraryIcon, SolidLibraryIcon);
export const ArtistIcon = icon(UserRound, PixelArtistIcon, SolidArtistIcon);
export const SearchIcon = icon(Search, PixelSearchIcon, SolidSearchIcon);
export const RefreshIcon = icon(RotateCw, PixelRefreshIcon, SolidRefreshIcon);
export const ChevronDownIcon = icon(ChevronDown, PixelChevronDownIcon);
export const ChevronLeftIcon = icon(ChevronLeft, PixelChevronLeftIcon);
export const VolumeIcon = icon(Volume2, PixelVolumeIcon, SolidVolumeIcon);
export const MicIcon = icon(MicVocal, PixelMicIcon, SolidMicIcon);
export const MoreIcon = icon(MoreHorizontal, PixelMoreIcon, SolidMoreIcon);
/** the vertical dots: a row's menu on the right, and a playlist's behind a kebab */
export const KebabIcon = icon(MoreVertical, PixelKebabIcon, SolidKebabIcon);
export const CloseIcon = icon(X, PixelCloseIcon, SolidCloseIcon);
export const LogOutIcon = icon(LogOut, PixelLogOutIcon, SolidLogOutIcon);
export const SettingsIcon = icon(Settings, PixelSettingsIcon, SolidSettingsIcon);

/** lucide dropped brand marks, so this one is a plain path */
export function GithubIcon({ size = 18, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'mocha' as const);
  if (theme === 'geek') return <PixelGithubIcon size={size} />;
  if (theme === 'modern') return <SolidGithubIcon size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.4-3.88-1.4-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.19 3.17-1.19.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
export const RepeatIcon = icon(Repeat, PixelRepeatIcon, SolidRepeatIcon);
export const RepeatOneIcon = icon(Repeat1, PixelRepeatOneIcon, SolidRepeatOneIcon);
