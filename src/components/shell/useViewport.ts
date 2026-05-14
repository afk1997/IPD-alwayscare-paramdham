'use client';
import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 760;

export function useViewport() {
  const [width, setWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { width, narrow: width < MOBILE_BREAKPOINT };
}
