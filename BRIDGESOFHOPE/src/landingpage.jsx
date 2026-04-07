import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import {
  Phone,
  Smartphone,
  MapPin,
  Menu,
  X,
  Mail,
  Monitor,
  ChevronUp,
  ArrowRight,
  Quote,
} from 'lucide-react';
/* eslint-disable-next-line no-unused-vars -- motion is used as motion.div, motion.footer, etc. */
import { motion, AnimatePresence, useInView } from 'framer-motion';
// Import Swiper components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
// Assets from your project folder
import logo from '@/assets/logo.png';
import heroImg from '@/assets/landingpage.png';
import gma from '@/assets/gmanewstv.png';
import tv5 from '@/assets/tv5.png';
import wsj from '@/assets/wsj.png';
import vice from '@/assets/vicenews.png';
import rappler from '@/assets/rappler.png';
import reaksyon from '@/assets/reaksyon.png';
import containerImg from '@/assets/Container.png';
import prog1 from '@/assets/carousel1.png';
import prog2 from '@/assets/carousel2.png';
import prog3 from '@/assets/carousel3.jpg';
import prog4 from '@/assets/carousel4.png';
import prog5 from '@/assets/carousel5.jpg';
import hopeLogo from '@/assets/hoperecoverylogo.png';

const PROGRAM_SLIDES = [
  {
    title: 'Comprehensive Health Exams',
    text: 'A complete evaluation of your physical and mental health to understand your condition and guide a personalized path to recovery.',
    img: prog1,
  },
  {
    title: 'Medically Supervised Detox',
    text: 'A safe, medically guided detox process designed to manage withdrawal symptoms and support your body’s natural healing.',
    img: prog2,
  },
  {
    title: 'Counseling and Therapy',
    text: 'Professional counseling and therapy services tailored to help you address emotional, psychological, and behavioral challenges.',
    img: prog3,
  },
  {
    title: 'Personalized Treatment Plan',
    text: 'A customized recovery plan built around your unique experiences, needs, and goals for lasting change.',
    img: prog4,
  },
  {
    title: 'Lifetime Aftercare & Halfway Privileges',
    text: 'Ongoing support and counseling even after your program, helping you maintain sobriety and stay connected for life.',
    img: prog5,
  },
];
const HERO_ROTATE_WORDS = ['recovery', 'hope', 'sobriety', 'renewal'];
const NAV_BAR_OFFSET_PX = 100;
const SCROLL_DURATION_MS = 950;
const BACK_TO_TOP_SCROLL_THRESHOLD_PX = 200;
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function ScrollReveal({ children, className, delay = 0, y = 36 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10% 0px -8% 0px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [navElevated, setNavElevated] = useState(false);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const navigate = useNavigate(); // Hook to handle the redirection
  const scrollRafRef = useRef(null);
  const animateScrollToY = useCallback((targetY) => {
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    const clampedTarget = Math.max(0, targetY);
    const startY = window.scrollY;
    const distance = clampedTarget - startY;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) {
        scrollRafRef.current = requestAnimationFrame(step);
      } else {
        scrollRafRef.current = null;
      }
    };
    scrollRafRef.current = requestAnimationFrame(step);
  }, []);
  const scrollToSection = useCallback(
    (sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const targetY =
        el.getBoundingClientRect().top + window.scrollY - NAV_BAR_OFFSET_PX;
      animateScrollToY(targetY);
    },
    [animateScrollToY],
  );
  const scrollToTop = useCallback(() => {
    animateScrollToY(0);
  }, [animateScrollToY]);
  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null)
        cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowBackToTop(y > BACK_TO_TOP_SCROLL_THRESHOLD_PX);
      setNavElevated(y > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroWordIndex((i) => (i + 1) % HERO_ROTATE_WORDS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);
  const onNavSectionClick = (e, sectionId) => {
    e.preventDefault();
    setIsMenuOpen(false);
    scrollToSection(sectionId);
  };
  const partnerLinks = {
    [gma]:
      'https://bridgesofhope.com.ph/index.php/news-gma7s-brigada-features-bridges-of-hope-in-episode-on-alcoholism/',
    [tv5]:
      'https://bridgesofhope.com.ph/index.php/bridges-of-hope-program-director-gimo-gomez-on-tv5-the-evening-news/',
    [wsj]:
      'https://bridgesofhope.com.ph/index.php/wall-street-journals-trefor-moss-interviews-bridges-of-hope/',
    [vice]:
      'https://bridgesofhope.com.ph/index.php/vice-news-on-philippine-shabu-cartel/',
    [rappler]:
      'https://bridgesofhope.com.ph/index.php/rappler-goes-inside-bridges-of-hope/',
    [reaksyon]:
      'https://bridgesofhope.com.ph/index.php/program-director-gimo-gomez-appears-on-tv5-reaksyon/',
  };
  return (
    <div className="lp-wrapper">
      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');



        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          overflow-x: hidden;
        }



        #hero,
        #about,
        #programs,
        #testimonials,
        #contact {
          scroll-margin-top: 100px;
        }



        .lp-wrapper {
          --lp-accent: #ea4a1f;
          --lp-accent-soft: rgba(234, 74, 31, 0.12);
          --lp-accent-hover: #d63d15;
          --lp-ink: #0f172a;
          --lp-muted: #64748b;
          --lp-border: rgba(15, 23, 42, 0.08);
          --lp-surface: #ffffff;
          --lp-canvas: #f1f5f9;
          --lp-radius: 16px;
          --lp-radius-lg: 24px;
          --lp-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 40px rgba(15, 23, 42, 0.08);
          --lp-shadow-hover: 0 4px 12px rgba(15, 23, 42, 0.08), 0 24px 48px rgba(15, 23, 42, 0.12);



          font-family: 'Inter', system-ui, sans-serif;
          color: var(--lp-ink);
          width: 100%;
          min-height: 100vh;
          background: var(--lp-canvas);
          -webkit-font-smoothing: antialiased;
        }



        .swiper-pagination-bullet-active {
          background: var(--lp-accent) !important;
        }



        .full-screen-section {
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
          display: flex;
          justify-content: center;
        }



        .content-limit {
          width: min(92%, 1200px);
          margin: 0 auto;
        }



        .lp-eyebrow {
          display: inline-block;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lp-accent);
          margin-bottom: 0.75rem;
        }



        .lp-section-title {
          font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem 0;
          color: var(--lp-ink);
        }



        .lp-section-lead {
          font-size: 1.125rem;
          line-height: 1.65;
          color: var(--lp-muted);
          margin: 0 auto;
          max-width: 36rem;
        }



        .text-orange { color: var(--lp-accent); }



        .back-to-top-btn {
          position: fixed;
          bottom: 28px;
          right: 24px;
          z-index: 2100;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          background: var(--lp-ink);
          color: white;
          border: none;
          border-radius: 999px;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: var(--lp-shadow-hover);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(14px);
          transition: opacity 0.28s ease, visibility 0.28s ease, transform 0.28s ease, background 0.2s;
        }
        .back-to-top-btn:hover {
          background: #1e293b;
        }
        .back-to-top-btn.back-to-top-btn--visible {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0);
        }



        /* Nav */
        .nav-bar {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 0 clamp(1.25rem, 5vw, 4rem) !important;
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          width: 100% !important;
          box-sizing: border-box !important;
          border-bottom: 1px solid var(--lp-border) !important;
          height: 100px !important;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          transition: box-shadow 0.35s ease, background 0.35s ease, border-color 0.35s ease;
        }
        .nav-bar.nav-bar--elevated {
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.94) !important;
          border-bottom-color: rgba(15, 23, 42, 0.06) !important;
        }
        .nav-links {
          display: flex !important;
          align-items: center !important;
          gap: 2rem !important;
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
        }
        .nav-links a {
          text-decoration: none !important;
          color: #475569 !important;
          font-weight: 500 !important;
          font-size: 0.9375rem !important;
          position: relative;
          padding: 0.25rem 0;
        }
        .nav-links a::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 2px;
          background: var(--lp-accent);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.25s ease;
        }
        .nav-links a:hover { color: var(--lp-ink) !important; }
        .nav-links a:hover::after {
          transform: scaleX(1);
          transform-origin: left;
        }
        .login-btn {
          background: var(--lp-accent) !important;
          color: white !important;
          padding: 0.65rem 1.5rem !important;
          border-radius: 999px !important;
          border: none !important;
          font-weight: 600 !important;
          font-size: 0.9375rem !important;
          cursor: pointer !important;
          white-space: nowrap !important;
          box-shadow: 0 4px 14px rgba(234, 74, 31, 0.35);
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          font-family: inherit !important;
        }
        .login-btn:hover {
          background: var(--lp-accent-hover) !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(234, 74, 31, 0.4);
        }
        .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--lp-ink);
          position: relative;
          z-index: 5000 !important;
          padding: 0.5rem;
          border-radius: 10px;
        }
        .hamburger:hover { background: var(--lp-canvas); }



        /* Hero */
        .hero {
          position: relative;
          min-height: 88vh;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 120px clamp(1.25rem, 5vw, 4rem) 4rem;
          color: white;
          width: 100%;
          box-sizing: border-box;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
        .hero-inner {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1200px;
          margin: 0;
          margin-right: auto;
          box-sizing: border-box;
        }
        .hero-content {
          text-align: left;
          max-width: 38rem;
          margin: 0;
          padding-left: clamp(0.75rem, 4vw, 2.5rem);
        }
        .hero-lead {
          font-size: clamp(1rem, 2vw, 1.2rem);
          line-height: 1.65;
          opacity: 0.95;
          max-width: 32rem;
          margin: 0 0 2rem 0;
          text-shadow: 0 1px 18px rgba(0, 0, 0, 0.45), 0 1px 4px rgba(0, 0, 0, 0.35);
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.875rem;
          align-items: center;
        }
        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--lp-accent);
          color: white;
          padding: 1rem 1.75rem;
          border-radius: 999px;
          border: none;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(234, 74, 31, 0.45);
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .cta-btn:hover {
          background: var(--lp-accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(234, 74, 31, 0.5);
        }
        .cta-btn--ghost {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: none;
          backdrop-filter: blur(8px);
        }
        .cta-btn--ghost:hover {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.9rem;
          border-radius: 999px;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.95);
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.22);
          margin-bottom: 1.25rem;
          backdrop-filter: blur(10px);
          text-shadow: 0 1px 14px rgba(0, 0, 0, 0.4);
        }
        .hero-title {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.2rem;
          margin: 0 0 1.25rem 0;
          max-width: 100%;
        }
        .hero-title-line {
          font-size: clamp(1.75rem, 5.5vw, 4.25rem);
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: -0.03em;
          display: block;
          white-space: nowrap;
          text-shadow: 0 2px 28px rgba(0, 0, 0, 0.5), 0 1px 10px rgba(0, 0, 0, 0.4);
        }
        .hero-title-rotate-wrap {
          display: block;
          min-height: 1.15em;
          overflow: hidden;
          position: relative;
          font-size: clamp(2.5rem, 6vw, 4.25rem);
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: -0.03em;
          text-align: left;
        }
        .hero-title-rotate {
          display: inline-block;
          background: linear-gradient(120deg, #ff8f6b 0%, var(--lp-accent) 45%, #ff6b45 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 18px rgba(0, 0, 0, 0.45));
        }
        .hero-title-suffix {
          font-size: clamp(1.35rem, 3.5vw, 2rem);
          font-weight: 600;
          opacity: 0.95;
          letter-spacing: -0.02em;
          margin-top: 0.15rem;
          text-shadow: 0 2px 22px rgba(0, 0, 0, 0.48), 0 1px 8px rgba(0, 0, 0, 0.38);
        }
        .hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 2rem;
          max-width: 40rem;
        }
        .hero-badge {
          flex: 1 1 140px;
          min-width: 120px;
          padding: 0.85rem 1rem;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          text-align: left;
        }
        .hero-badge strong {
          display: block;
          font-size: 0.9375rem;
          font-weight: 700;
          margin-bottom: 0.2rem;
        }
        .hero-badge span {
          font-size: 0.78rem;
          opacity: 0.85;
          line-height: 1.35;
        }



        /* Partners */
        .partners-section {
          background: var(--lp-surface);
          border-bottom: 1px solid var(--lp-border);
          padding: 3rem clamp(1.25rem, 5vw, 4rem);
        }
        .partners-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: clamp(2rem, 6vw, 5rem);
        }
        .partners-section a {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.25s, transform 0.25s;
        }
        .partners-section img {
          height: clamp(36px, 5vw, 52px);
          width: auto;
          object-fit: contain;
          filter: grayscale(1);
          opacity: 0.5;
          transition: filter 0.3s, opacity 0.3s;
        }
        .partners-section a:hover img {
          filter: grayscale(0);
          opacity: 1;
        }
        .partners-section a:hover { transform: translateY(-2px); }



        /* About */
        .about-section {
          background: linear-gradient(180deg, #f8fafc 0%, var(--lp-canvas) 100%);
        }
        .about-flex {
          display: flex;
          padding: clamp(4rem, 10vw, 7rem) 0;
          align-items: center;
          gap: clamp(2.5rem, 6vw, 5rem);
        }
        .about-visual {
          position: relative;
          flex-shrink: 0;
        }
        .about-visual::before {
          content: '';
          position: absolute;
          inset: -8%;
          background: radial-gradient(circle at 30% 30%, var(--lp-accent-soft), transparent 55%);
          border-radius: 50%;
          z-index: 0;
        }
        .about-img {
          position: relative;
          z-index: 1;
          width: min(420px, 85vw);
          height: min(420px, 85vw);
          border-radius: 32px;
          object-fit: cover;
          box-shadow: var(--lp-shadow-hover);
        }
        .about-copy h2 {
          font-size: clamp(2rem, 4vw, 2.85rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 1.25rem 0;
        }
        .about-tagline {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }
        .about-body {
          font-size: 1.0625rem;
          line-height: 1.7;
          color: var(--lp-muted);
          margin: 0;
          max-width: 36rem;
        }



        /* Programs */
        .programs-section {
          padding: clamp(4rem, 10vw, 6rem) 0;
          text-align: center;
          background: var(--lp-surface);
          width: 100vw;
          overflow: hidden;
        }
        .programs-header {
          padding: 0 clamp(1.25rem, 5vw, 4rem);
          margin-bottom: 0.5rem;
        }
        .slider-isolation-box {
          width: min(94%, 1280px);
          margin: 0 auto;
          padding: 2rem 0 3rem;
        }
        .programs-swiper .swiper-slide {
          height: auto;
          display: flex;
          justify-content: center;
          align-items: stretch;
          box-sizing: border-box;
        }
        .programs-swiper .program-card {
          max-width: 56rem;
          width: 100%;
        }



        .program-card {
          background: var(--lp-surface);
          border-radius: var(--lp-radius-lg);
          border: 1px solid var(--lp-border);
          display: flex;
          padding: clamp(1.75rem, 3vw, 2.5rem);
          text-align: left;
          gap: clamp(1.5rem, 3vw, 2.25rem);
          box-shadow: var(--lp-shadow);
          min-height: 280px;
          align-items: center;
          margin: 8px;
          box-sizing: border-box;
          transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.2s;
        }
        .program-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--lp-shadow-hover);
          border-color: rgba(234, 74, 31, 0.2);
        }
        .program-card img {
          width: clamp(180px, 22vw, 240px);
          height: clamp(180px, 22vw, 240px);
          border-radius: 20px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .program-card h3 {
          color: var(--lp-ink);
          margin: 0 0 0.65rem 0;
          font-size: clamp(1.35rem, 2.5vw, 1.65rem);
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .program-card p {
          font-size: 1rem;
          color: var(--lp-muted);
          line-height: 1.65;
          margin: 0;
        }
        /* Testimonials */
        .testimonials-section {
          padding: clamp(4rem, 10vw, 6rem) 0;
          background: linear-gradient(180deg, var(--lp-canvas) 0%, #e2e8f0 100%);
        }
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 3rem;
          text-align: left;
        }
        .testimonial-card {
          background: var(--lp-surface);
          padding: 2rem;
          border-radius: var(--lp-radius-lg);
          border: 1px solid var(--lp-border);
          box-shadow: var(--lp-shadow);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--lp-shadow-hover);
        }
        .testimonial-quote-icon {
          color: var(--lp-accent);
          opacity: 0.35;
          margin-bottom: 0.75rem;
        }
        .testimonial-text {
          font-size: 1rem;
          color: #475569;
          line-height: 1.7;
          margin: 0 0 1.5rem 0;
        }
        .testimonial-footer {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }
        .testimonial-avatar {
          background: linear-gradient(135deg, var(--lp-accent), #c2410c);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .testimonial-name {
          font-weight: 600;
          color: var(--lp-ink);
        }



        /* Footer — palette only: #f6f4f1 #e4ded2 #f95c4b #000000 */
        .footer-cta-part {
          background: linear-gradient(180deg, #f6f4f1 0%, #e4ded2 100%);
          color: #000000;
          padding: clamp(4rem, 10vw, 5.5rem) 0;
          width: 100vw;
          position: relative;
          overflow: hidden;
        }
        .footer-cta-part::before {
          content: '';
          position: absolute;
          top: -40%;
          right: -10%;
          width: 50%;
          height: 120%;
          background: radial-gradient(
            ellipse,
            rgba(249, 92, 75, 0.2) 0%,
            transparent 68%
          );
          pointer-events: none;
        }
        .footer-cta-inner {
          position: relative;
          z-index: 1;
          text-align: center;
        }
        .footer-cta-part h2 {
          font-size: clamp(1.85rem, 4vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem 0;
          color: #000000;
        }
        .footer-cta-part .footer-lead {
          color: rgba(0, 0, 0, 0.62);
          font-size: 1.0625rem;
          margin: 0 0 2.5rem 0;
          max-width: 32rem;
          margin-left: auto;
          margin-right: auto;
        }
        .cta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        .footer-cta-box {
          background: #f6f4f1;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: var(--lp-radius);
          padding: 1.25rem 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          font-weight: 600;
          font-size: 0.9375rem;
          color: #000000;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
        }
        .footer-cta-box:hover {
          background: #e4ded2;
          border-color: #f95c4b;
          transform: translateY(-2px);
        }
        .footer-cta-box svg {
          flex-shrink: 0;
          color: #f95c4b;
        }

        .footer-info-part {
          background: #e4ded2;
          color: #000000;
          padding: 3.5rem 0 4rem 0;
          width: 100vw;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .footer-info-part .text-orange {
          color: #f95c4b !important;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: clamp(2rem, 5vw, 3.5rem);
        }
        .footer-brand-block p {
          color: rgba(0, 0, 0, 0.62);
          line-height: 1.65;
          font-size: 1rem;
          max-width: 22rem;
          margin: 0;
        }
        .footer-brand-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 1rem;
        }
        .footer-brand-row h4 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: #000000;
        }
        .footer-col-title {
          margin: 0 0 1.25rem 0;
          color: rgba(0, 0, 0, 0.48);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .footer-contact-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: #000000;
          font-size: 0.9375rem;
        }
        .footer-contact-item a {
          color: inherit;
          text-decoration: none;
        }
        .footer-contact-item a:hover { color: #f95c4b; }
        .footer-legal a {
          color: rgba(0, 0, 0, 0.55);
          text-decoration: none;
          font-size: 0.875rem;
        }
        .footer-legal a:hover { color: #000000; }



        @media (max-width: 1024px) {
          .hamburger { display: block !important; }
          .nav-links {
            position: fixed;
            top: 0;
            right: ${isMenuOpen ? '0' : '-100%'};
            height: 100vh;
            width: min(88%, 320px);
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(16px);
            flex-direction: column !important;
            justify-content: center !important;
            gap: 1.75rem !important;
            transition: 0.32s cubic-bezier(0.4, 0, 0.2, 1);
            left: auto !important;
            transform: none !important;
            box-shadow: -12px 0 40px rgba(15, 23, 42, 0.12);
            z-index: 4000 !important;
            padding: 2rem;
          }
          .nav-links a::after { display: none; }
          .desktop-login { display: none !important; }
          .mobile-login { display: block !important; margin-top: 0.5rem; width: 100%; max-width: 200px; }
          .hero { min-height: 78vh; text-align: left; justify-content: center; }
          .hero-content { padding-left: clamp(0.5rem, 3.5vw, 2rem); }
          .hero-title { align-items: flex-start; max-width: none; margin-left: 0; margin-right: 0; }
          .hero-title-rotate-wrap { text-align: left; }
          .hero-badges { justify-content: flex-start; margin-left: 0; margin-right: 0; }
          .hero-lead { margin-left: 0; margin-right: 0; }
          .hero-actions { justify-content: flex-start; }



          .about-flex {
            flex-direction: column !important;
            text-align: center;
            padding: 3.5rem 0 !important;
          }
          .about-body { margin-left: auto; margin-right: auto; }



          .program-card {
            flex-direction: column;
            min-height: 0;
            text-align: center;
            padding: 2rem 1.5rem;
          }
          .program-card img { width: 100%; max-width: 280px; height: 200px; }



          .cta-grid { grid-template-columns: 1fr !important; }
          .info-grid {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
            text-align: center;
          }
          .footer-contact-item { justify-content: center; }
          .footer-brand-block p { margin-left: auto; margin-right: auto; }
          .footer-brand-row { justify-content: center; }
        }
        @media (min-width: 1025px) {
          .mobile-login { display: none !important; }
        }
        @media (max-width: 480px) {
          .back-to-top-btn {
            right: 16px;
            bottom: 20px;
            padding: 10px 14px;
            font-size: 0.8125rem;
          }
        }

      `}</style>

      <header className={`nav-bar${navElevated ? ' nav-bar--elevated' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logo} alt="Bridges of Hope" height="56" />
        </div>
        <nav className="nav-links">
          <a href="#about" onClick={(e) => onNavSectionClick(e, 'about')}>
            About Us
          </a>
          <a href="#programs" onClick={(e) => onNavSectionClick(e, 'programs')}>
            Programs
          </a>
          <a
            href="#testimonials"
            onClick={(e) => onNavSectionClick(e, 'testimonials')}
          >
            Testimonials
          </a>
          <a href="#contact" onClick={(e) => onNavSectionClick(e, 'contact')}>
            Contact
          </a>
          <button
            type="button"
            className="login-btn mobile-login"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="login-btn desktop-login"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
          <button
            type="button"
            className="hamburger"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </header>
      <section className="hero" id="hero">
        <motion.img
          src={heroImg}
          className="hero-bg"
          alt="Bridges of Hope care environment"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="hero-overlay" aria-hidden />
        <motion.div
          className="hero-inner"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: { staggerChildren: 0.11, delayChildren: 0.2 },
            },
            hidden: {},
          }}
        >
          <div className="hero-content">
            <motion.h1
              className="hero-title"
              variants={{
                hidden: { opacity: 0, y: 26 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <span className="hero-title-line">Start your journey to</span>
              <span className="hero-title-rotate-wrap" aria-live="polite">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={HERO_ROTATE_WORDS[heroWordIndex]}
                    className="hero-title-rotate"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -22 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {HERO_ROTATE_WORDS[heroWordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="hero-title-suffix">&amp; lasting healing</span>
            </motion.h1>
            <motion.p
              className="hero-lead"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              Compassionate, evidence-based care in a private setting—so you can
              focus on what matters most.
            </motion.p>
            <motion.div
              className="hero-actions"
              variants={{
                hidden: { opacity: 0, y: 18 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <motion.button
                type="button"
                className="cta-btn"
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Get started today
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </motion.button>
              <motion.button
                type="button"
                className="cta-btn cta-btn--ghost"
                onClick={(e) => onNavSectionClick(e, 'about')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Learn more
              </motion.button>
            </motion.div>
            <motion.div
              className="hero-badges"
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
            </motion.div>
          </div>
        </motion.div>
      </section>
      <section
        className="partners-section full-screen-section"
        aria-label="Featured in"
      >
        <motion.div
          className="partners-inner"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-8% 0px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.09 } },
          }}
        >
          {[gma, tv5, wsj, vice, rappler, reaksyon].map((img, i) => (
            <motion.a
              key={i}
              href={partnerLinks[img]}
              target="_blank"
              rel="noopener noreferrer"
              variants={{
                hidden: { opacity: 0, y: 14 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <img src={img} alt="Media partner" />
            </motion.a>
          ))}
        </motion.div>
      </section>
      <section id="about" className="full-screen-section about-section">
        <div className="content-limit about-flex">
          <ScrollReveal className="about-visual" y={24}>
            <img
              src={containerImg}
              className="about-img"
              alt="Bridges of Hope facility and care"
            />
          </ScrollReveal>
          <ScrollReveal className="about-copy" delay={0.12} y={28}>
            <span className="lp-eyebrow">About us</span>
            <h2>
              The <span className="text-orange">largest</span> and most{' '}
              <span className="text-orange">trusted</span> addiction treatment
              center
            </h2>
            <p className="about-tagline">
              We are <span className="text-orange">Bridges of Hope</span>
            </p>
            <p className="about-body">
              We provide professional, private treatment for people struggling
              with addiction through world-class facilities and a dedicated
              clinical team.
            </p>
          </ScrollReveal>
        </div>
      </section>
      <section id="programs" className="programs-section">
        <ScrollReveal className="programs-header">
          <span className="lp-eyebrow">What we offer</span>
          <h2 className="lp-section-title">
            Our <span className="text-orange">treatment programs</span>
          </h2>
          <p className="lp-section-lead">
            Comprehensive care tailored to your needs and your recovery journey.
          </p>
        </ScrollReveal>
        <ScrollReveal className="slider-isolation-box" delay={0.1} y={40}>
          <Swiper
            modules={[Pagination, Autoplay]}
            className="programs-swiper"
            slidesPerView={1}
            spaceBetween={24}
            loop
            loopAdditionalSlides={1}
            speed={800}
            autoplay={{
              delay: 3500,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            pagination={{ clickable: true }}
            style={{ padding: '24px 12px 72px' }}
          >
            {PROGRAM_SLIDES.map((prog, i) => (
              <SwiperSlide key={i}>
                <div className="program-card">
                  <img src={prog.img} alt={prog.title} />
                  <div>
                    <h3>{prog.title}</h3>
                    <p>{prog.text}</p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </ScrollReveal>
      </section>
      <section
        id="testimonials"
        className="full-screen-section testimonials-section"
      >
        <div className="content-limit" style={{ textAlign: 'center' }}>
          <ScrollReveal>
            <span className="lp-eyebrow">Stories</span>
            <h2 className="lp-section-title">
              Hope &amp; <span className="text-orange">recovery</span>
            </h2>
            <p className="lp-section-lead">
              Real stories from people who found their path to sobriety.
            </p>
          </ScrollReveal>
          <div className="testimonials-grid">
            {[
              {
                initial: 'T',
                name: 'Tony S.',
                text: "Bridges of Hope has helped my recognize my destructive behaviors and patterns. I don't know where I would be if my family didn't make me go to this rehab. Today, I'm happy to say that I'm able to rebuild my life and commit to lifetime sobriety.",
              },
              {
                initial: 'J',
                name: 'James M.',
                text: "Being a recovering addict has its challenges, but it's nice to have Bridges of Hope to continue to become my support system even after I got out of rehab. Now, I look forward to finishing my studies and getting a job.",
              },
              {
                initial: 'J',
                name: 'James K.',
                text: "It was in 2013 when I thought, 'Enough!' and finally decided to call Bridges of Hope to treat my husband's addiction to meth. It was the best decision I have done. My husband is now 7 years sober and have turned his life around.",
              },
            ].map((story, i) => (
              <ScrollReveal key={story.name} delay={0.08 + i * 0.12} y={40}>
                <article className="testimonial-card">
                  <Quote
                    className="testimonial-quote-icon"
                    size={28}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <p className="testimonial-text">&ldquo;{story.text}&rdquo;</p>
                  <div className="testimonial-footer">
                    <div className="testimonial-avatar" aria-hidden>
                      {story.initial}
                    </div>
                    <span className="testimonial-name">{story.name}</span>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
      <motion.footer
        className="footer-cta-part full-screen-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="content-limit footer-cta-inner"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-10% 0px' }}
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.12, delayChildren: 0.08 },
            },
          }}
        >
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 22 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            Ready to take the first step?
          </motion.h2>
          <motion.p
            className="footer-lead"
            variants={{
              hidden: { opacity: 0, y: 18 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            Recovery is possible. Let us help you start your journey today.
          </motion.p>
          <motion.div
            className="cta-grid"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            <motion.button
              type="button"
              className="footer-cta-box"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
            >
              <Phone size={22} /> Call now: (555) 123-4567
            </motion.button>
            <motion.button
              type="button"
              className="footer-cta-box"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
            >
              <Monitor size={22} /> Use our website
            </motion.button>
            <motion.button
              type="button"
              className="footer-cta-box"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
            >
              <Smartphone size={22} /> Download our app
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.footer>
      <footer id="contact" className="footer-info-part full-screen-section">
        <ScrollReveal y={28}>
          <div className="content-limit info-grid">
            <div className="footer-brand-block">
              <div className="footer-brand-row">
                <img src={hopeLogo} alt="" style={{ height: '28px' }} />
                <h4>Hope Recovery</h4>
              </div>
              <p>
                Transforming lives through compassionate, evidence-based
                addiction treatment.
              </p>
            </div>
            <div>
              <h4 className="footer-col-title">Contact</h4>
              <div className="footer-contact-item">
                <Phone size={18} className="text-orange" /> (555) 123-4567
              </div>
              <div className="footer-contact-item">
                <Mail size={18} className="text-orange" /> info@hoperecovery.com
              </div>
              <div
                className="footer-contact-item"
                style={{ alignItems: 'flex-start' }}
              >
                <MapPin
                  size={18}
                  className="text-orange"
                  style={{ marginTop: '3px', flexShrink: 0 }}
                />
                <span>
                  123 Recovery Way
                  <br />
                  Cavite, Philippines
                </span>
              </div>
            </div>
            <div className="footer-legal">
              <h4 className="footer-col-title">Legal</h4>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </ScrollReveal>
      </footer>
      <button
        type="button"
        className={`back-to-top-btn${showBackToTop ? ' back-to-top-btn--visible' : ''}`}
        onClick={scrollToTop}
      >
        <ChevronUp size={20} strokeWidth={2.5} aria-hidden />
        Back to top
      </button>
    </div>
  );
};
export default LandingPage;
