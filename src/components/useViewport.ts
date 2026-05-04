import { useEffect, useState } from 'react';

interface Viewport {
  /** True if the device is primarily touch (phone/tablet). */
  isTouch: boolean;
  /** True when the viewport is small (phones / small tablets). */
  isSmall: boolean;
  /** True when in portrait orientation. */
  isPortrait: boolean;
}

const SMALL_BREAKPOINT = 820;

function readViewport(): Viewport {
  if (typeof window === 'undefined') {
    return { isTouch: false, isSmall: false, isPortrait: false };
  }

  // matchMedia-based touch detection: more reliable than userAgent sniffing
  // and handles hybrid devices (Surface, iPad with mouse) correctly.
  // 'pointer: coarse' = primary input is finger-sized.
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isSmall = window.innerWidth < SMALL_BREAKPOINT;
  const isPortrait = window.innerHeight > window.innerWidth;

  return { isTouch, isSmall, isPortrait };
}

/**
 * Tracks viewport state — touch capability, size, orientation.
 * Re-renders consumers when any of these change (resize, rotate).
 */
export function useViewport(): Viewport {
  const [v, setV] = useState<Viewport>(readViewport);

  useEffect(() => {
    const update = () => setV(readViewport());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return v;
}
