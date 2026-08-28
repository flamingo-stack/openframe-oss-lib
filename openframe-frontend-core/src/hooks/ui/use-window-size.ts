import { useLayoutEffect, useState } from 'react';

/**
 * Hook to get window dimensions
 * @returns Window width and height
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useLayoutEffect(() => {
    // The size lives on `window`, not in React — this is the initial read of an
    // external system plus a subscription to it. The identity bail-out matters:
    // `resize` fires for height-only changes (mobile URL bar) and for the same
    // dimensions on orientation lock, and without it every one of those would
    // re-render every consumer of this hook.
    const handleResize = () => {
      setWindowSize(prev =>
        prev.width === window.innerWidth && prev.height === window.innerHeight
          ? prev
          : { width: window.innerWidth, height: window.innerHeight },
      );
    };

    // Set initial size
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}
