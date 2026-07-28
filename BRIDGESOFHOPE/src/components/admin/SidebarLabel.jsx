import React, { useEffect, useRef, useState } from 'react';

/**
 * Sidebar nav label that auto-slides to reveal text the fixed sidebar width cuts off,
 * instead of just ellipsizing — same idea as the mobile app's MarqueeText. No-op
 * (renders as plain static text) when the label already fits.
 */
export function SidebarLabel({ children, className = 'sidebar-label' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [marquee, setMarquee] = useState(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;

    const measure = () => {
      const shift = inner.scrollWidth - outer.clientWidth;
      if (shift > 2) {
        const duration = Math.max(2.2, shift * 0.045).toFixed(2);
        setMarquee({ shift, duration });
      } else {
        setMarquee(null);
      }
    };

    // Debounced: the sidebar's expand/collapse width transition fires this observer on
    // every frame — only measure once the size has actually settled, so re-renders don't
    // fight the transition and make it feel less smooth.
    let debounceId;
    const scheduleMeasure = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(measure, 80);
    };

    measure();
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(outer);
    return () => {
      clearTimeout(debounceId);
      ro.disconnect();
    };
  }, [children]);

  return (
    <span className={className} ref={outerRef}>
      <span
        className={`sidebar-label-inner${marquee ? ' sidebar-label-marquee' : ''}`}
        ref={innerRef}
        style={
          marquee
            ? { '--marquee-shift': `-${marquee.shift}px`, '--marquee-duration': `${marquee.duration}s` }
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
