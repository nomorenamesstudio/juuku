export interface PixelIconProps {
  size?: number;
  className?: string;
}

/**
 * Pixel Art Icons (MIT, https://github.com/halfmage/pixelarticons) for the geek
 * theme: 24x24 artefact-free pixel glyphs, drawn with currentColor so they inherit
 * the theme's ink. Generated once; only the icons juuku uses are bundled.
 */

export function PixelPlayIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M15 11h-2V9h2zm0 4h-2v-2h2zm-2 2h-2v-2h2zm0-8h-2V7h2zm-2-2H9V5h2zM9 21H7V3h2zm6-8h2v-2h-2zm-6 4h2v2H9z" />
    </svg>
  );
}

export function PixelPauseIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M10 20H4V4h6v16Zm8-16v16h-6V4h6Z" />
    </svg>
  );
}

export function PixelNextIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M20 4v16h2V4zM2 11v2h16v-2zm12 2v2h2v-2zm-2 2v2h2v-2zm-2 2v2h2v-2zm4-8v2h2V9zm-2-2v2h2V7zm-2-2v2h2V5z" />
    </svg>
  );
}

export function PixelPrevIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M4 4v16H2V4zm18 7v2H6v-2zm-12 2v2H8v-2zm2 2v2h-2v-2zm2 2v2h-2v-2zm-4-8v2H8V9zm2-2v2h-2V7zm2-2v2h-2V5z" />
    </svg>
  );
}

export function PixelShuffleIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M10 19H2v-2h8v2Zm12 0h-8v-2h8v2Zm-10-2h-2v-6h2v6Zm6-10h2v2h2v2h-2v2h-2v2h-2v-4h-4V9h4V5h2v2ZM8 11H2V9h6v2Z" />
    </svg>
  );
}

export function PixelTrashIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M18 22H6V20H18V22ZM9 6H15V4H17V6H22V8H20V20H18V8H6V20H4V8H2V6H7V4H9V6ZM15 4H9V2H15V4Z" />
    </svg>
  );
}

export function PixelHeartIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M13 22h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 16H5v-2h2v2Zm12 0h-2v-2h2v2ZM5 14H3v-2h2v2Zm16 0h-2v-2h2v2ZM3 12H1V6h2v6Zm20 0h-2V6h2v6ZM13 8h-2V6h2v2ZM5 6H3V4h2v2Zm6 0H9V4h2v2Zm4 0h-2V4h2v2Zm6 0h-2V4h2v2ZM9 4H5V2h4v2Zm10 0h-4V2h4v2Z" />
    </svg>
  );
}

export function PixelPlusIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M13 11h7v2h-7v7h-2v-7H4v-2h7V4h2v7Z" />
    </svg>
  );
}

export function PixelQueueIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M4 2h16v2H4zm2 5h2v2H6zm4 0h8v2h-8zm-4 4h2v2H6zm4 0h8v2h-8zm-4 4h2v2H6zm4 0h8v2h-8zm-6 5h16v2H4zM2 4h2v16H2zm18 0h2v16h-2z" />
    </svg>
  );
}

export function PixelPlaylistIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M4 2h16v2H4zm2 5h2v2H6zm4 0h8v2h-8zm-4 4h2v2H6zm4 0h8v2h-8zm-4 4h2v2H6zm4 0h8v2h-8zm-6 5h16v2H4zM2 4h2v16H2zm18 0h2v16h-2z" />
    </svg>
  );
}

export function PixelAddToPlaylistIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zM7 11h10v2H7z" /><path d="M11 17V7h2v10z" />
    </svg>
  );
}

export function PixelLibraryIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M3 4h2v17H3zm4 4h2v13H7zm4-2h2v15h-2zm4 0h2v5h-2zm2 5h2v5h-2zm2 5h2v5h-2z" />
    </svg>
  );
}

export function PixelArtistIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M9 2h6v2H9zm0 8h6v2H9zm6-6h2v6h-2zM7 4h2v6H7zM4 18h2v4H4zm14 0h2v4h-2zM8 14h8v2H8zm-2 2h2v2H6zm10 0h2v2h-2z" />
    </svg>
  );
}

export function PixelSearchIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M22 22h-2v-2h2v2Zm-2-2h-2v-2h2v2Zm-6-2H6v-2h8v2Zm4 0h-2v-2h2v2ZM6 16H4v-2h2v2Zm10 0h-2v-2h2v2ZM4 14H2V6h2v8Zm14 0h-2V6h2v8ZM6 6H4V4h2v2Zm10 0h-2V4h2v2Zm-2-2H6V2h8v2Z" />
    </svg>
  );
}

export function PixelRefreshIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M16 4h2v6h-2zm-2-2h2v2h-2zm0 2h2v8h-2zM4 8H2v5h2z" /><path d="M4 6h16v2H4zm4 14H6v-6h2zm2 2H8v-2h2zm0-2H8v-8h2zm10-4h2v-5h-2z" /><path d="M20 18H4v-2h16z" />
    </svg>
  );
}

export function PixelChevronDownIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M13 16h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 10H5V8h2v2Zm12 0h-2V8h2v2Z" />
    </svg>
  );
}

export function PixelChevronLeftIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M8 13v-2h2v2H8Zm2-2V9h2v2h-2Zm0 4v-2h2v2h-2Zm2-6V7h2v2h-2Zm0 8v-2h2v2h-2Zm2-10V5h2v2h-2Zm0 12v-2h2v2h-2Z" />
    </svg>
  );
}

export function PixelVolumeIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M11 22H9v-2H7v-2h2V6H7V4h2V2h2v20Zm8 0h-6v-2h6v2Zm2-2h-2v-2h2v2ZM7 18H5v-2h2v2Zm10 0h-4v-2h4v2Zm6 0h-2V6h2v12ZM5 10H3v4h2v2H1V8h4v2Zm14 6h-2V8h2v8Zm-4-2h-2v-4h2v4ZM7 8H5V6h2v2Zm10 0h-4V6h4v2Zm4-2h-2V4h2v2Zm-2-2h-6V2h6v2Z" />
    </svg>
  );
}

export function PixelMicIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M6 4H4v16h2zm10-2H6v2h10zm4 4h-2v14h2zm-2 14H6v2h12zM16 4h2v2h-2zm-4 0h2v6h-2z"/>
  <path d="M12 8h6v2h-6zm-4 8h8v2H8zm0-4h8v2H8zm0-4h2v2H8z"/>
    </svg>
  );
}

export function PixelMoreIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M3 9h2v2H3zm8 0h2v2h-2zm8 0h2v2h-2zM1 11h2v2H1zm8 0h2v2H9zm8 0h2v2h-2zM3 13h2v2H3zm8 0h2v2h-2zm8 0h2v2h-2zM5 11h2v2H5zm8 0h2v2h-2zm8 0h2v2h-2z" />
    </svg>
  );
}

export function PixelCloseIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z" />
    </svg>
  );
}

export function PixelLogOutIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M8 11h12v2H8zm8-2h2v2h-2z" /><path d="M14 7h2v10h-2zm2 6h2v2h-2zM6 2h12v2H6zm0 18h12v2H6zM4 4h2v16H4zm14 0h2v3h-2zm0 13h2v3h-2z" />
    </svg>
  );
}

export function PixelRepeatIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M17 5h2v2h-2zM5 17h2v2H5zm6-14h2v6h-2zM9 1h2v8H9zm0 8h2v2H9zm10 8H9v2h10zM5 7H3v10h2z" /><path d="M13 15h-2v6h2zm2-2h-2v8h2zm0 8h-2v2h2zM5 5h10v2H5zm14 12h2V7h-2z" />
    </svg>
  );
}

export function PixelRepeatOneIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M19 19H15V23H13V21H11V19H9V17H19V19ZM7 19H5V17H7V19ZM5 17H3L3 7H5L5 17ZM21 17H19V7H21V17ZM13 9L13 13L15 13V15L9 15V13H11V11H9V9H13ZM11 3H13V5H15V7L5 7V5L9 5V1L11 1V3ZM19 7L17 7V5L19 5V7Z" />
    </svg>
  );
}

export function PixelSettingsIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M4 14h2v6H4zm6 0h2v6h-2zm-4-2h4v2H6zm0 8h4v2H6zm-4-4h2v2H2zm20-8h-4V6h4z" /><path d="M10 16h12v2H10zm4-8H2V6h12zm6-4v2h-2V4zm0 6V8h-2v2zm-6-8h4v2h-4zm0 10h4v-2h-4zm-2-8h2v2h-2zm0 6h2V8h-2z" />
    </svg>
  );
}

export function PixelGithubIcon({ size = 18, ...rest }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden {...rest}>
      <path d="M5 2h4v2H7v2H5V2Zm0 10H3V6h2v6Zm2 2H5v-2h2v2Zm2 2v-2H7v2H3v-2H1v2h2v2h4v4h2v-4h2v-2H9Zm0 0v2H7v-2h2Zm6-12v2H9V4h6Zm4 2h-2V4h-2V2h4v4Zm0 6V6h2v6h-2Zm-2 2v-2h2v2h-2Zm-2 2v-2h2v2h-2Zm0 2h-2v-2h2v2Zm0 0h2v4h-2v-4Z" />
    </svg>
  );
}
