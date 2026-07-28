import { useEffect, useRef, RefObject } from 'react';

/**
 * Reusable hook to handle clicks outside of a specific element or set of elements.
 * Works seamlessly on mobile (touch events) and desktop (mousedown).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  handler: (event: MouseEvent | TouchEvent) => void
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Check if clicking inside any of the refs
      const refs = Array.isArray(ref) ? ref : [ref];
      const isInside = refs.some(r => r.current && r.current.contains(target));

      if (isInside) {
        return;
      }

      handlerRef.current(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref]);
}
