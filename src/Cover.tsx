import { useLayoutEffect, useRef, useState } from 'react';

// a cover that has already been shown once never fades again: on a back
// navigation a fade reads as a flash, however long it is
const seen = new Set<string>();

export function Cover({
  src,
  alt = '',
  className = '',
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string }) {
  const [ready, setReady] = useState(() => (src ? seen.has(src) : false));
  const ref = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) {
      // cached: paint it now, without waiting for a load event
      img.style.transition = 'none';
      setReady(true);
      requestAnimationFrame(() => {
        img.style.transition = '';
      });
    }
  }, [src]);

  if (!src) return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      decoding="async"
      className={`cover ${ready ? 'ready' : ''} ${className}`.trim()}
      onLoad={() => {
        seen.add(src);
        setReady(true);
      }}
      {...rest}
    />
  );
}
