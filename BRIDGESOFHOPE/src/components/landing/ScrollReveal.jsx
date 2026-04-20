import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/** Scroll-triggered fade/slide-in — used on the public landing page. */
export function ScrollReveal({ children, className, delay = 0, y = 40 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-8% 0px -6% 0px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
