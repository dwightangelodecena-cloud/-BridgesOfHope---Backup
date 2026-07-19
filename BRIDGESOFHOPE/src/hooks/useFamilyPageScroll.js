import { useCallback } from 'react';

/** Scroll family portal main content to top (mobile brand / title tap). */
export function useFamilyPageScroll() {
  const scrollToTop = useCallback(() => {
    const el = document.querySelector('.main-view .scroll-content');
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { scrollToTop };
}
