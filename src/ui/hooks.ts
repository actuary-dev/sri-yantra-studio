import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function useViewportSize(): { w: number; h: number } {
  const get = () => ({ w: typeof window !== 'undefined' ? window.innerWidth : 1024, h: typeof window !== 'undefined' ? window.innerHeight : 768 });
  const [size, setSize] = useState(get);
  useEffect(() => {
    const on = () => setSize((s) => {
      const n = get();
      return n.w === s.w && n.h === s.h ? s : n;
    });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return size;
}

/** Element height, kept up to date with a ResizeObserver. */
export function useElementHeight(el: HTMLElement | null): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!el) return;
    const measure = () => setH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return h;
}
