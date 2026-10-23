import { type RefObject, useEffect } from 'react';

/**
 * iOS does not resize the layout viewport for the keyboard: it shrinks the visual one
 * and scrolls it, so anything fixed to `bottom: 0` ends up behind the keys. This pins
 * a fixed layer to what is actually visible.
 *
 * A no-op on browsers without `visualViewport`, where the keyboard resizes the layout
 * viewport anyway and `bottom: 0` is already correct.
 */
export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const node = ref.current;
    if (!node || !viewport) return;

    const sync = () => {
      node.style.top = `${viewport.offsetTop}px`;
      node.style.height = `${viewport.height}px`;
      node.style.bottom = 'auto';
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, [ref]);
}
