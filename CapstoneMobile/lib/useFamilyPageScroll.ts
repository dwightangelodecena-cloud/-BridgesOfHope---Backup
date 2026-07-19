import { useRef, useCallback } from 'react';
import type { ScrollView } from 'react-native';

/** Scroll-to-top for family tab pages — tap header brand/title to return to top. */
export function useFamilyPageScroll() {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return { scrollRef, scrollToTop };
}
