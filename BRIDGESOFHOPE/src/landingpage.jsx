import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Brain,
  Frown,
  ShieldAlert,
  Route,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';

import {
  loadSiteContent,
  saveMergedSiteContent,
  SITE_CONTENT_EVENT,
  getLandingThemeStyles,
  normalizeSectionOrder,
  parseBrandingLogoHeightPx,
} from '@/lib/siteContentStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { pullSiteContentFromSupabase } from '@/lib/siteContentRemote';
import {
  CMS_MAINTENANCE_EVENT,
  CMS_MAINTENANCE_STORAGE_KEY,
  DEFAULT_CMS_MAINTENANCE_MESSAGE,
  fetchCmsMaintenanceFromSupabase,
  readCmsMaintenanceMirror,
} from '@/lib/cmsMaintenance';
import { LandingPageBodySections } from '@/components/landing/LandingPageBodySections';

// ─── Asset imports (unchanged) ──────────────────────────────────────────────
import logo from '@/assets/kalingalogo.png';
import gma from '@/assets/gmanewstv.png';
import tv5 from '@/assets/tv5.png';
import wsj from '@/assets/wsj.png';
import vice from '@/assets/vicenews.png';
import rappler from '@/assets/rappler.png';
import reaksyon from '@/assets/reaksyon.png';
import prog1 from '@/assets/carousel11.jpg';
import prog2 from '@/assets/carousel2.png';
import prog3 from '@/assets/carousel3.jpg';
import prog4 from '@/assets/carousel4.png';
import prog5 from '@/assets/prog5.jpg';
import about1 from '@/assets/about1.jpg';
import about2 from '@/assets/about2.jpg';
import about3 from '@/assets/about3.jpg';
import about4 from '@/assets/about4.jpg';


/** Press row defaults — image modules; URLs overridden via CMS `proof.pressOutlets`. */
const PRESS_OUTLETS = [
  { img: gma, name: 'GMA News TV' },
  { img: tv5, name: 'TV5' },
  { img: wsj, name: 'The Wall Street Journal' },
  { img: vice, name: 'VICE News' },
  { img: rappler, name: 'Rappler' },
  { img: reaksyon, name: 'TV5 Reaksyon' },
];

const DEFAULT_PRESS_ARTICLE_URLS = [
  'https://bridgesofhope.com.ph/index.php/news-gma7s-brigada-features-bridges-of-hope-in-episode-on-alcoholism/',
  'https://bridgesofhope.com.ph/index.php/bridges-of-hope-program-director-gimo-gomez-on-tv5-the-evening-news/',
  'https://bridgesofhope.com.ph/index.php/wall-street-journals-trefor-moss-interviews-bridges-of-hope/',
  'https://bridgesofhope.com.ph/index.php/vice-news-on-philippine-shabu-cartel/',
  'https://bridgesofhope.com.ph/index.php/rappler-goes-inside-bridges-of-hope/',
  'https://bridgesofhope.com.ph/index.php/program-director-gimo-gomez-appears-on-tv5-reaksyon/',
];

// ─── Data ────────────────────────────────────────────────────────────────────
const PROGRAM_SLIDES = [
  {
    title: 'Comprehensive Health Exams',
    text: 'A complete evaluation of your physical and mental health to understand your condition and guide a personalized path to recovery.',
    img: prog1,
    number: '01',
  },
  {
    title: 'Medically Supervised Detox',
    text: 'A safe, medically guided detox process designed to manage withdrawal symptoms and support your body\'s natural healing.',
    img: prog2,
    number: '02',
  },
  {
    title: 'Counseling and Therapy',
    text: 'Professional counseling and therapy services tailored to help you address emotional, psychological, and behavioral challenges.',
    img: prog3,
    number: '03',
  },
  {
    title: 'Personalized Treatment Plan',
    text: 'A customized recovery plan built around your unique experiences, needs, and goals for lasting change.',
    img: prog4,
    number: '04',
  },
  {
    title: 'Lifetime Aftercare & Halfway Privileges',
    text: 'Ongoing support and counseling even after your program, helping you maintain sobriety and stay connected for life.',
    img: prog5,
    number: '05',
  },
];

const HERO_ROTATE_WORDS = ['Recovery', 'Hope', 'Sobriety', 'Renewal'];
const BACK_TO_TOP_SCROLL_THRESHOLD_PX = 300;

const PROBLEM_ITEMS = [
  {
    icon: Brain,
    title: 'It hijacks your clarity',
    text: 'Cravings, shame, and secrecy make it hard to think clearly—or believe change is possible.',
  },
  {
    icon: Frown,
    title: 'Life keeps sliding',
    text: 'Work, relationships, and health suffer while the cycle repeats, even when you want to stop.',
  },
  {
    icon: ShieldAlert,
    title: 'Going it alone feels risky',
    text: 'Withdrawal and relapse are real fears without medical oversight and structured support.',
  },
  {
    icon: Route,
    title: 'You are not sure where to turn',
    text: 'You want dignity, privacy, and evidence-based care—not judgment or a one-size-fits-all program.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'What happens during the first contact?',
    a: 'We start with a confidential conversation about your situation, answer questions, and outline next steps—including assessment and admission options that fit your needs.',
  },
  {
    q: 'Is treatment medically supervised?',
    a: 'Yes. Our programs include medically supervised detox and clinical oversight where appropriate, aligned with evidence-based protocols and your safety.',
  },
  {
    q: 'Will my privacy be protected?',
    a: 'We treat your information with strict confidentiality and provide care in a private setting so you can focus on recovery without unnecessary exposure.',
  },
  {
    q: 'Do you involve family members?',
    a: 'When helpful, we involve loved ones with your consent—building understanding and support that can strengthen long-term outcomes.',
  },
  {
    q: 'What about aftercare?',
    a: 'Recovery does not end at discharge. We emphasize continued support, counseling, and community connections so you have a path forward.',
  },
];

const TESTIMONIAL_STORIES = [
  {
    id: 'tony',
    initial: 'T',
    name: 'Tony S.',
    role: 'Recovery Graduate',
    text: "Bridges of Hope helped me recognize my destructive behaviors and patterns. I don't know where I would be if my family didn't make me go. Today, I'm happy to say I'm rebuilding my life and committed to lifetime sobriety.",
  },
  {
    id: 'james-m',
    initial: 'J',
    name: 'James M.',
    role: 'Alumni',
    text: "Being a recovering addict has its challenges, but it's reassuring to have Bridges of Hope as my continued support system. Now, I look forward to finishing my studies and building a career.",
  },
  {
    id: 'james-k',
    initial: 'J',
    name: 'James K.',
    role: 'Family Member',
    text: "In 2013 I thought, 'Enough!' and called Bridges of Hope to treat my husband's addiction. It was the best decision I've ever made. My husband is now 7 years sober and has turned his life around completely.",
  },
];

const NAV_ITEMS = [
  { id: 'problem', label: 'Challenge' },
  { id: 'services', label: 'Services' },
  { id: 'proof', label: 'Proof' },
  { id: 'testimonials', label: 'Stories' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
];

const PROBLEM_ICON_MAP = {
  brain: Brain,
  frown: Frown,
  shield: ShieldAlert,
  route: Route,
};

/** Document Y of element top (not offsetTop — avoids offsetParent / transform bugs). */
function sectionDocumentTop(el) {
  const r = el.getBoundingClientRect();
  return r.top + window.scrollY;
}

/** Pixels between nav bottom and where section content should start (breathing room). */
const NAV_CONTENT_GAP_PX = 12;

function readScrollPaddingTopPx() {
  const raw = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 96;
}

/** Bottom edge of fixed nav shell from viewport top (px). */
function getNavShellBottomPx() {
  const shell = document.querySelector('.lp-root header.nav-shell');
  if (!shell) return readScrollPaddingTopPx();
  const b = Math.round(shell.getBoundingClientRect().bottom);
  return Number.isFinite(b) ? Math.min(180, Math.max(48, b)) : readScrollPaddingTopPx();
}

/**
 * Total offset for scroll-margin / scroll-padding / programmatic scroll:
 * nav height + gap so titles are never hidden under the fixed bar.
 */
function getNavScrollPaddingPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--lp-nav-scroll-offset').trim();
  if (raw.endsWith('px')) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 48) return Math.round(n);
  }
  return getNavShellBottomPx() + NAV_CONTENT_GAP_PX;
}

/** Sync --lp-nav-scroll-offset on :root from live nav measurements (resize-safe). */
function syncLpNavScrollOffsetVar() {
  const shell = document.querySelector('.lp-root header.nav-shell');
  if (!shell || typeof document === 'undefined') return;
  const pad = Math.round(shell.getBoundingClientRect().bottom) + NAV_CONTENT_GAP_PX;
  document.documentElement.style.setProperty('--lp-nav-scroll-offset', `${pad}px`);
}

/**
 * Top-align section under the nav: window scroll Y so element top sits at navScrollPadding from viewport top.
 */
function computeSectionScrollTargetY(el) {
  const rect = el.getBoundingClientRect();
  const elTop = rect.top + window.scrollY;
  const docEl = document.documentElement;
  const maxScroll = Math.max(0, docEl.scrollHeight - window.innerHeight);
  const pad = getNavScrollPaddingPx();
  const y = elTop - pad;
  return Math.max(0, Math.min(y, maxScroll));
}

/** Core values — swap `img` / `alt` when you have final photography (see comment in About section). */
const VALUES = [
  {
    title: 'Compassionate Care',
    desc: 'Every patient is treated with dignity and empathy throughout their journey.',
    img: about1,
    alt: 'Therapist and patient in a supportive counseling session',
  },
  {
    title: 'Clinically Proven',
    desc: 'Evidence-based methods designed by leading addiction specialists.',
    img: about2,
    alt: 'Clinical team conducting a professional health evaluation',
  },
  {
    title: 'Family-Centered',
    desc: 'We involve families to build lasting support systems for recovery.',
    img: about3,
    alt: 'Welcoming recovery environment supporting families and community',
  },
  {
    title: 'Private & Confidential',
    desc: 'Discreet programs and protected information so you can focus on healing.',
    img: about4,
    alt: 'Calm, private treatment setting with medical oversight',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
const LandingPage = () => {
  const [searchParams] = useSearchParams();
  const cmsEditMode = searchParams.get('cmsEdit') === '1';
  const bypassMaintenance =
    cmsEditMode || searchParams.get('live') === '1';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [navElevated, setNavElevated] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const navigate = useNavigate();
  const scrollSpyPauseRef = useRef(null);
  const scrollSpyRafRef = useRef(null);

  const [siteContent, setSiteContent] = useState(() => loadSiteContent());
  const [cmsMaint, setCmsMaint] = useState(() => readCmsMaintenanceMirror());

  useEffect(() => {
    if (bypassMaintenance) return undefined;

    let cancelled = false;
    const apply = (payload) => {
      if (cancelled) return;
      setCmsMaint({
        active: Boolean(payload?.active),
        message: String(payload?.message || '').trim(),
      });
    };

    const pull = async () => {
      const remote = await fetchCmsMaintenanceFromSupabase();
      const mirror = readCmsMaintenanceMirror();
      const next = remote != null ? remote : mirror;
      apply(next);
    };

    void pull();

    const onStorage = (e) => {
      if (e.key !== CMS_MAINTENANCE_STORAGE_KEY) return;
      apply(readCmsMaintenanceMirror());
    };
    const onCustom = (e) => {
      apply(e.detail || { active: false, message: '' });
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CMS_MAINTENANCE_EVENT, onCustom);
    const interval = window.setInterval(() => void pull(), 20000);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CMS_MAINTENANCE_EVENT, onCustom);
      window.clearInterval(interval);
    };
  }, [bypassMaintenance]);

  useEffect(() => {
    const sync = () => setSiteContent(loadSiteContent());
    window.addEventListener('storage', sync);
    window.addEventListener(SITE_CONTENT_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SITE_CONTENT_EVENT, sync);
    };
  }, []);

  /** Load published site content from Supabase when configured (visitors use anon read). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) return;
      const merged = await pullSiteContentFromSupabase();
      if (cancelled || !merged) return;
      saveMergedSiteContent(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const m = siteContent;
  const heroWords = m.hero?.rotateWords?.length ? m.hero.rotateWords : HERO_ROTATE_WORDS;
  const problemItems = m.problem.items.map((item, i) => ({
    icon: PROBLEM_ICON_MAP[item.iconKey] || [Brain, Frown, ShieldAlert, Route][i] || Brain,
    title: item.title,
    text: item.text,
  }));
  const programSlides = PROGRAM_SLIDES.map((slide, i) => {
    const patch = m.services.slides?.[i] || {};
    const img =
      typeof patch.imageUrl === 'string' && patch.imageUrl.trim() ? patch.imageUrl.trim() : slide.img;
    return { ...slide, ...patch, img };
  });
  const testimonialStories = m.testimonials.stories;
  const faqItems = m.faq.items;
  const valueCards = useMemo(
    () =>
      VALUES.map((v, i) => {
        const patch = m.about.values?.[i] || {};
        const customImg =
          typeof patch.imageUrl === 'string' && patch.imageUrl.trim() ? patch.imageUrl.trim() : null;
        return {
          ...v,
          title: patch.title ?? v.title,
          desc: patch.desc ?? v.desc,
          alt: patch.alt ?? v.alt,
          img: customImg || v.img,
        };
      }),
    [m.about.values],
  );

  const logoSrc =
    typeof m.branding?.logoUrl === 'string' && m.branding.logoUrl.trim() ? m.branding.logoUrl.trim() : logo;

  const headerLogoImgStyle = useMemo(() => {
    const h = parseBrandingLogoHeightPx(m.branding?.headerLogoHeightPx);
    return h ? { height: h, width: 'auto' } : undefined;
  }, [m.branding?.headerLogoHeightPx]);

  const pressOutletRows = useMemo(
    () =>
      PRESS_OUTLETS.map((outlet, i) => {
        const po = m.proof?.pressOutlets?.[i] || {};
        const href =
          typeof po.articleUrl === 'string' && po.articleUrl.trim()
            ? po.articleUrl.trim()
            : DEFAULT_PRESS_ARTICLE_URLS[i];
        const src =
          typeof po.imageUrl === 'string' && po.imageUrl.trim() ? po.imageUrl.trim() : outlet.img;
        return { name: outlet.name, src, href };
      }),
    [m.proof?.pressOutlets],
  );

  const landingSectionOrder = useMemo(() => normalizeSectionOrder(m.sectionOrder), [m.sectionOrder]);

  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    syncLpNavScrollOffsetVar();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resumeSpy = (delayMs) => {
      if (scrollSpyPauseRef.current) window.clearTimeout(scrollSpyPauseRef.current);
      scrollSpyPauseRef.current = window.setTimeout(() => {
        scrollSpyPauseRef.current = null;
        syncLpNavScrollOffsetVar();
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('scroll')));
      }, delayMs);
    };

    const applyScroll = (behavior) => {
      syncLpNavScrollOffsetVar();
      const y = computeSectionScrollTargetY(el);
      window.scrollTo({ top: y, behavior });
    };

    /** Proximity scroll-snap can nudge programmatic scrolls — disable for this jump, then restore. */
    const htmlEl = document.documentElement;
    htmlEl.style.setProperty('scroll-snap-type', 'none', 'important');
    const clearSnapOverride = () => {
      htmlEl.style.removeProperty('scroll-snap-type');
    };

    const snapExact = () => {
      syncLpNavScrollOffsetVar();
      const y = computeSectionScrollTargetY(el);
      if (Math.abs(window.scrollY - y) > 2) {
        window.scrollTo({ top: y, behavior: 'auto' });
      }
      const pad = getNavScrollPaddingPx();
      const top = el.getBoundingClientRect().top;
      if (Math.abs(top - pad) > 3) {
        const y2 = computeSectionScrollTargetY(el);
        window.scrollTo({ top: y2, behavior: 'auto' });
      }
    };

    if (reduceMotion) {
      applyScroll('auto');
      clearSnapOverride();
      snapExact();
      resumeSpy(100);
      return;
    }

    resumeSpy(950);
    applyScroll('smooth');

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearSnapOverride();
      snapExact();
    };
    document.addEventListener('scrollend', finish, { passive: true, once: true });
    window.setTimeout(finish, 900);
  }, []);

  const scrollToTop = useCallback(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setActiveSection(null);
    if (smooth) {
      if (scrollSpyPauseRef.current) window.clearTimeout(scrollSpyPauseRef.current);
      scrollSpyPauseRef.current = window.setTimeout(() => {
        scrollSpyPauseRef.current = null;
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('scroll')));
      }, 820);
    }
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const toggleFaq = useCallback((index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }, []);

  useEffect(() => {
    const updateActiveFromScroll = () => {
      if (scrollSpyPauseRef.current !== null) return;
      syncLpNavScrollOffsetVar();

      const y = window.scrollY;
      const docEl = document.documentElement;
      const viewBottom = y + window.innerHeight;
      const docHeight = docEl.scrollHeight;
      const endSlack = 16;

      /** Near document end: highlight Contact (footer) so nav does not stick on #cta-final. */
      if (viewBottom >= docHeight - endSlack) {
        setActiveSection((prev) => (prev === 'contact' ? prev : 'contact'));
        return;
      }

      /** Align spy with the same offset used for scroll targets (nav + gap). */
      const activationY = y + getNavScrollPaddingPx();
      let current = null;
      for (const item of m.navItems) {
        const sec = document.getElementById(item.id);
        if (!sec) continue;
        if (sectionDocumentTop(sec) <= activationY) current = item.id;
      }
      setActiveSection((prev) => (prev === current ? prev : current));
    };

    const onScroll = () => {
      const sy = window.scrollY;
      setShowBackToTop(sy > BACK_TO_TOP_SCROLL_THRESHOLD_PX);
      setNavElevated(sy > 20);
      if (scrollSpyRafRef.current !== null) return;
      scrollSpyRafRef.current = requestAnimationFrame(() => {
        scrollSpyRafRef.current = null;
        updateActiveFromScroll();
      });
    };

    syncLpNavScrollOffsetVar();
    requestAnimationFrame(() => syncLpNavScrollOffsetVar());

    let resizeObserver;
    const shell = document.querySelector('.lp-root header.nav-shell');
    if (shell && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => syncLpNavScrollOffsetVar());
      resizeObserver.observe(shell);
    }

    const onResizeSync = () => {
      syncLpNavScrollOffsetVar();
    };
    window.addEventListener('resize', onResizeSync, { passive: true });
    window.addEventListener('orientationchange', onResizeSync, { passive: true });

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('resize', onResizeSync);
      window.removeEventListener('orientationchange', onResizeSync);
      if (resizeObserver) resizeObserver.disconnect();
      if (scrollSpyRafRef.current !== null) cancelAnimationFrame(scrollSpyRafRef.current);
      if (scrollSpyPauseRef.current) window.clearTimeout(scrollSpyPauseRef.current);
    };
  }, [m.navItems]);

  useEffect(() => {
    const n = heroWords.length || 1;
    const id = setInterval(() => setHeroWordIndex((i) => (i + 1) % n), 2800);
    return () => clearInterval(id);
  }, [heroWords.length]);

  const onNavSectionClick = (e, id) => {
    e.preventDefault();
    setIsMenuOpen(false);
    setActiveSection(id);
    scrollToSection(id);
  };

  const showMaintenance = !bypassMaintenance && cmsMaint.active;

  return (
    <div className="lp-root" style={getLandingThemeStyles(m.theme)}>
      {showMaintenance && (
        <div
          className="lp-maintenance-overlay"
          role="alertdialog"
          aria-live="polite"
          aria-busy="true"
          aria-label="Site maintenance"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1.25rem, 4vw, 2.5rem)',
            background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.97) 0%, rgba(30, 41, 59, 0.96) 100%)',
            color: '#f8fafc',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <img
            src={logo}
            alt="Bridges of Hope"
            style={{
              width: 'clamp(140px, 28vw, 200px)',
              height: 'auto',
              marginBottom: '1.75rem',
              filter: 'brightness(1.05)',
            }}
          />
          <h1
            style={{
              fontSize: 'clamp(1.35rem, 3.5vw, 1.85rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '0.75rem',
              lineHeight: 1.2,
            }}
          >
            Under maintenance
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.2vw, 1.05rem)',
              lineHeight: 1.55,
              maxWidth: 420,
              color: 'rgba(248, 250, 252, 0.88)',
              marginBottom: '1.5rem',
            }}
          >
            {cmsMaint.message || DEFAULT_CMS_MAINTENANCE_MESSAGE}
          </p>
          <a
            href="/login"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fda4af',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Staff login
          </a>
        </div>
      )}
      <style>{`
        /* Inter only (weights in index.css) — one typeface across the landing page. */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        /* Inter for all copy and headings */
        html, body, #root {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        html {
          /* Fallback until JS measures the fixed nav; then --lp-nav-scroll-offset is set on :root */
          --lp-nav-scroll-offset: max(88px, calc(env(safe-area-inset-top, 0px) + 72px));
          scroll-behavior: smooth;
          scroll-snap-type: y proximity;
          scroll-padding-top: var(--lp-nav-scroll-offset);
        }
        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
            scroll-snap-type: none;
          }
          .value-photo-card,
          .value-photo-card:hover,
          .value-photo-card:focus-within {
            transform: none;
            transition: none;
          }
          .value-photo-media img,
          .value-photo-card:hover .value-photo-media img,
          .value-photo-card:focus-within .value-photo-media img {
            transform: scale(1.02);
            transition: none;
            filter: grayscale(0.35) contrast(1.03);
          }
          .value-photo-copy {
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-end !important;
            align-items: stretch !important;
            padding: clamp(1rem, 2.2vw, 1.5rem) !important;
            transform: none !important;
            opacity: 1 !important;
            transition: none;
          }
          .value-photo-copy-inner {
            transform: none !important;
          }
          .value-photo-title,
          .value-photo-desc {
            position: relative !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
            transition: none;
            max-height: none !important;
          }
          .value-photo-desc {
            margin-top: 0.65rem !important;
          }
          .value-photo-title {
            margin: 0 !important;
          }
          .programs-swiper .swiper-wrapper {
            transition-duration: 0.35s !important;
            transition-timing-function: ease-out !important;
          }
        }
        html, body { width: 100%; overflow-x: hidden; }
        /* Minimal pill scrollbar — warm greige thumb on cream track (matches page palette) */
        html {
          scrollbar-width: thin;
          scrollbar-color: #a8988c #ebe4dc;
        }
        html::-webkit-scrollbar {
          width: 10px;
        }
        html::-webkit-scrollbar-track {
          background: linear-gradient(180deg, #f2ece6 0%, #e8e2da 100%);
          border-radius: 999px;
          margin: 4px 0;
        }
        html::-webkit-scrollbar-thumb {
          background: #b8aea4;
          border-radius: 999px;
          border: 2px solid #ebe4dc;
          box-shadow: 0 1px 2px rgba(42, 36, 32, 0.06);
        }
        html::-webkit-scrollbar-thumb:hover {
          background: #9d9186;
        }
        html::-webkit-scrollbar-thumb:active {
          background: #8b7f74;
        }
        img, svg, video, canvas { max-width: 100%; }

        #hero, #problem, #services, #proof, #testimonials, #about, #custom-cms, #faq, #cta-final, #contact {
          scroll-margin-top: var(--lp-nav-scroll-offset);
        }

        .snap-page {
          scroll-snap-align: start;
          scroll-snap-stop: normal;
          min-height: 100svh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }
        .snap-page:not(.hero-section) {
          padding-block: clamp(3.5rem, 7vw, 5.5rem);
        }
        .hero-section.snap-page {
          padding-block: 0;
          min-height: 100svh;
          min-height: 100dvh;
          justify-content: flex-start;
        }
        .problem-section.snap-page,
        .programs-section.snap-page,
        .proof-section.snap-page,
        .testimonials-section.snap-page,
        .about-section.snap-page,
        .faq-section.snap-page,
        .footer-cta-section.snap-page {
          padding-block: 0;
          padding-inline: 0;
          justify-content: flex-start;
        }
        /*
          Single-child .container snap sections: do not stretch to 100% width.
          Default align-items: stretch was overriding width: min(92%, 1200px) + margin: auto,
          so content blocks sat full-bleed and felt off-center on the page.
        */
        .problem-section.snap-page,
        .programs-section.snap-page,
        .testimonials-section.snap-page,
        .about-section.snap-page,
        .lp-cms-dynamic.snap-page,
        .faq-section.snap-page,
        .footer-cta-section.snap-page {
          align-items: center;
        }
        .footer-info.snap-page {
          min-height: auto;
          flex-grow: 0;
          justify-content: flex-end;
          padding-block: 0;
          padding-inline: 0;
        }

        /* CMS-driven blocks: only as tall as content (not a full-screen “strip” like hero) */
        .lp-cms-dynamic.snap-page {
          min-height: auto !important;
          justify-content: flex-start;
          align-items: stretch;
          padding-block: 0 !important;
          padding-inline: 0;
          flex-grow: 0;
          width: 100%;
        }

        /* ── Tokens (8px grid, refined neutrals, warm accent) ── */
        .lp-root {
          --s-1: 8px;
          --s-2: 16px;
          --s-3: 24px;
          --s-4: 32px;
          --s-5: 40px;
          --s-6: 48px;
          --s-8: 64px;
          --s-10: 80px;
          --s-12: 96px;
          --cream:    #F7F5F1;
          --cream-2:  #EEEBE5;
          --cream-3:  #E0DAD0;
          --surface:  #FDFCFA;
          --ink:      #0C0A08;
          --ink-2:    #2A2420;
          --ink-3:    #5C534A;
          --muted:    #8A8075;
          --accent:   #D94F2A;
          --accent-h: #B83F20;
          --accent-2: #E86B4A;
          --accent-s: rgba(217,79,42,0.12);
          --accent-glow: rgba(217,79,42,0.22);
          --about-accent: #C1540A;
          --sage:     #4A6741;
          --sage-s:   rgba(74,103,65,0.10);
          --white:    #FFFFFF;
          --gradient-surface: linear-gradient(180deg, var(--surface) 0%, var(--cream) 100%);
          --gradient-hero-mesh: radial-gradient(ellipse 80% 55% at 20% 35%, rgba(217,79,42,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 85% 20%, rgba(74,103,65,0.08) 0%, transparent 50%);
          --gradient-programs: linear-gradient(165deg, #12100E 0%, #1A1612 38%, #0F0D0B 100%);
          --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
          --font-display: var(--font-sans);
          --font-nav: var(--font-sans);
          --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
          /* Soft, premium shadows — airy separation without heaviness */
          --shadow-s: 0 2px 8px rgba(12,10,8,0.045), 0 14px 36px rgba(12,10,8,0.055);
          --shadow-m: 0 6px 20px rgba(12,10,8,0.055), 0 22px 52px rgba(12,10,8,0.07);
          --shadow-l: 0 10px 28px rgba(12,10,8,0.065), 0 36px 72px rgba(12,10,8,0.09);
          --shadow-xl: 0 28px 72px rgba(12,10,8,0.11);
          --r-sm: 14px;
          --r-md: 18px;
          --r-lg: 26px;
          --r-xl: 34px;
          --r-2xl: 42px;
          --nav-h: 72px;
          /* Section blocks: generous vertical rhythm (8px grid multiples) */
          --nav-section-inset-y: clamp(2.75rem, 6.25vw, 4.25rem);
          --section-header-gap: clamp(2rem, 4.5vw, 4.5rem);
          --section-title-after-eyebrow: 0.875rem;
          --section-lead-top: 1.25rem;
          --section-inner-gap: clamp(var(--s-4), 3.5vw, var(--s-6));
          font-family: var(--font-sans);
          color: var(--ink);
          background: var(--cream);
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          position: relative;
          line-height: 1.62;
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Grain overlay ── */
        .lp-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.022;
          pointer-events: none;
          z-index: 9999;
        }

        /* ── Typography helpers ── */
        /* Decorative italic spans: same face as body, not a second font */
        .serif { font-family: var(--font-sans); }
        .eyebrow {
          display: inline-flex; align-items: center; gap: var(--s-1);
          font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--accent);
        }
        .eyebrow::before {
          content: ''; display: block;
          width: 28px; height: 2px; background: linear-gradient(90deg, var(--accent), var(--accent-2));
          border-radius: 2px;
        }
        .section-title {
          font-family: var(--font-sans);
          font-size: clamp(2.25rem, 4.8vw, 3.75rem);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.032em;
          color: var(--ink);
        }
        .section-lead {
          font-size: 1.125rem;
          line-height: 1.72;
          color: var(--ink-3);
          max-width: 40rem;
          font-weight: 400;
          letter-spacing: 0.005em;
        }
        .text-accent { color: var(--accent); }
        .italic { font-style: italic; }

        /* ── Layout ── */
        .container {
          width: min(92%, 1200px);
          margin: 0 auto;
          padding-inline: clamp(var(--s-3), 3vw, var(--s-4));
        }
        .full-bleed { width: 100%; max-width: 100%; position: relative; }

        /* ══════════════════════════════════════════
           NAV
        ══════════════════════════════════════════ */
        .nav-shell {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          padding: var(--s-2) clamp(var(--s-2), 4vw, var(--s-5)) 0;
          pointer-events: none;
          transition: padding 0.35s var(--ease-out-expo);
        }
        .nav-shell.elevated { padding-top: var(--s-1); }

        .nav {
          position: relative;
          pointer-events: auto;
          min-height: var(--nav-h);
          width: min(100%, 1200px);
          margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 18px 12px var(--s-3);
          background: rgba(253,252,250,0.78);
          backdrop-filter: blur(20px) saturate(1.5);
          -webkit-backdrop-filter: blur(20px) saturate(1.5);
          border: 1px solid rgba(224,218,208,0.65);
          border-radius: 24px;
          box-shadow: var(--shadow-s);
          transition: background 0.35s var(--ease-out-expo), box-shadow 0.35s var(--ease-out-expo), border-color 0.35s var(--ease-out-expo), transform 0.35s var(--ease-out-expo);
        }
        .nav::before {
          content: '';
          position: absolute;
          inset: -7px;
          border-radius: 30px;
          background:
            radial-gradient(120% 120% at 0% 0%, rgba(217,79,42,0.12) 0%, transparent 52%),
            radial-gradient(120% 120% at 100% 100%, rgba(74,103,65,0.09) 0%, transparent 55%);
          border: 1px solid rgba(255,255,255,0.55);
          box-shadow: 0 8px 22px rgba(12,10,8,0.08), 0 0 0 1px rgba(224,218,208,0.7);
          opacity: 0.78;
          pointer-events: none;
          z-index: -1;
          transition: opacity 0.35s var(--ease-out-expo), transform 0.35s var(--ease-out-expo), box-shadow 0.35s var(--ease-out-expo);
        }
        .nav-shell.elevated .nav {
          background: rgba(253,252,250,0.92);
          border-color: rgba(224,218,208,0.9);
          box-shadow: var(--shadow-m);
          transform: translateY(-1px);
        }
        .nav-shell.elevated .nav::before {
          opacity: 0.95;
          transform: scale(1.003);
          box-shadow: 0 14px 34px rgba(12,10,8,0.12), 0 0 0 1px rgba(224,218,208,0.9);
        }
        .nav::after {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: -1px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(217,79,42,0.25), transparent);
          opacity: 0;
          transition: opacity 0.35s var(--ease-out-expo);
        }
        .nav-shell.elevated .nav::after { opacity: 1; }
        .nav-logo {
          display: flex;
          align-items: center;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          font: inherit;
          transition: transform 0.35s var(--ease-out-expo), opacity 0.25s var(--ease-out-expo);
        }
        .nav-logo:hover { transform: scale(1.02); opacity: 0.92; }
        .nav-logo:focus,
        .nav-logo:focus-visible {
          outline: none;
          box-shadow: none;
        }
        .nav-logo img { height: 44px; width: auto; display: block; }
        .nav-links-desktop {
          display: flex; align-items: center; gap: var(--s-1);
          position: absolute; left: 50%; transform: translateX(-50%);
        }
        .nav-links-desktop a {
          font-family: var(--font-nav);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-3);
          text-decoration: none;
          letter-spacing: 0.035em;
          line-height: 1;
          text-transform: uppercase;
          transition:
            color 0.32s var(--ease-out-expo),
            letter-spacing 0.32s var(--ease-out-expo),
            transform 0.32s var(--ease-out-expo),
            box-shadow 0.32s var(--ease-out-expo);
          position: relative;
          padding: 10px 13px;
          border-radius: 999px;
          isolation: isolate;
        }
        .nav-desktop-pill {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          z-index: 0;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22);
          pointer-events: none;
        }
        .nav-link-label {
          position: relative;
          z-index: 1;
        }
        .nav-links-desktop a::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(217,79,42,0.14), rgba(232,107,74,0.08));
          opacity: 0;
          transform: scale(0.92);
          transition:
            opacity 0.32s var(--ease-out-expo),
            transform 0.32s var(--ease-out-expo),
            background 0.32s var(--ease-out-expo),
            box-shadow 0.32s var(--ease-out-expo),
            filter 0.28s var(--ease-out-expo);
          z-index: -1;
        }
        .nav-links-desktop a::after { display: none; }
        .nav-links-desktop a:hover:not(.is-active) {
          color: var(--ink);
          letter-spacing: 0.045em;
          transform: translateY(-1px);
          box-shadow: 0 8px 16px rgba(12,10,8,0.08);
        }
        .nav-links-desktop a:hover:not(.is-active)::before {
          opacity: 1;
          transform: scale(1);
        }
        .nav-links-desktop a:active:not(.is-active) {
          transform: translateY(0) scale(0.97);
          letter-spacing: 0.03em;
          transition-duration: 120ms;
        }
        .nav-links-desktop a:active:not(.is-active)::before {
          opacity: 1;
          transform: scale(0.96);
        }
        .nav-links-desktop a.is-active {
          color: #fff;
          letter-spacing: 0.045em;
          box-shadow: 0 6px 22px rgba(217,79,42,0.38), 0 2px 8px rgba(12,10,8,0.12);
        }
        .nav-links-desktop a.is-active::before {
          opacity: 0;
          transform: scale(1);
        }
        .nav-links-desktop a.is-active:hover {
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(217,79,42,0.42), 0 2px 10px rgba(12,10,8,0.14);
        }
        .nav-links-desktop a.is-active:hover::before {
          opacity: 1;
          transform: scale(1);
          filter: brightness(1.06);
        }
        .nav-links-desktop a.is-active:active {
          transform: translateY(0) scale(0.98);
          transition-duration: 120ms;
        }

        .nav-right { display: flex; align-items: center; gap: var(--s-1); }
        .nav-right .btn-primary {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          border-color: rgba(217,79,42,0.35);
          box-shadow: 0 8px 24px var(--accent-glow), 0 2px 8px rgba(12,10,8,0.08);
        }
        .nav-right .btn-primary:hover {
          background: linear-gradient(135deg, var(--accent-h) 0%, var(--accent) 100%);
          box-shadow: 0 12px 32px rgba(217,79,42,0.35);
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: var(--s-2);
          background: var(--ink); color: var(--white);
          padding: 14px 26px; border-radius: 999px; border: 1px solid rgba(12,10,8,0.08);
          font-family: var(--font-sans); font-size: 0.875rem; font-weight: 600;
          cursor: pointer; letter-spacing: 0.01em;
          box-shadow: 0 10px 24px rgba(12,10,8,0.14);
          transition: background 0.25s var(--ease-out-expo), border-color 0.25s var(--ease-out-expo), transform 0.25s var(--ease-out-expo), box-shadow 0.25s var(--ease-out-expo);
          touch-action: manipulation;
        }
        .btn-primary:hover {
          background: var(--ink-2);
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(12,10,8,0.22);
        }
        .btn-primary:focus-visible,
        .btn-hero-primary:focus-visible,
        .btn-hero-ghost:focus-visible {
          outline: 2px solid rgba(217,79,42,0.55);
          outline-offset: 2px;
        }
        .btn-accent {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%) !important;
          border-color: rgba(217,79,42,0.35) !important;
          box-shadow: 0 8px 24px var(--accent-glow), 0 2px 8px rgba(12,10,8,0.08) !important;
        }
        .btn-accent:hover {
          background: linear-gradient(135deg, var(--accent-h) 0%, var(--accent) 100%) !important;
          box-shadow: 0 12px 32px rgba(217,79,42,0.35) !important;
        }

        .hamburger-btn {
          display: none; background: none; border: none; cursor: pointer;
          color: var(--ink); padding: 10px; border-radius: var(--r-sm);
          border: 1px solid rgba(224,218,208,0.9);
          background: rgba(255,255,255,0.65);
          transition: background 0.2s var(--ease-out-expo), transform 0.2s var(--ease-out-expo), border-color 0.2s var(--ease-out-expo);
        }
        .hamburger-btn:hover {
          background: rgba(255,255,255,0.95);
          border-color: rgba(217,79,42,0.3);
          transform: translateY(-1px);
        }
        .hamburger-btn.open {
          background: rgba(217,79,42,0.12);
          border-color: rgba(217,79,42,0.3);
        }

        /* Mobile nav drawer */
        .nav-drawer {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(86%, 340px); z-index: 4000;
          background: var(--surface); border-left: 1px solid var(--cream-3);
          box-shadow: -24px 0 80px rgba(12,10,8,0.12);
          display: flex; flex-direction: column; justify-content: flex-start;
          padding: calc(1rem + env(safe-area-inset-top, 0px)) 1.35rem calc(1.35rem + env(safe-area-inset-bottom, 0px));
          transform: translateX(100%);
          transition: transform 0.38s cubic-bezier(0.16,1,0.3,1);
          overflow-y: auto;
        }
        .nav-drawer.open { transform: translateX(0); }
        .nav-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--s-2);
          padding-bottom: 14px;
          border-bottom: 1px solid var(--cream-3);
          margin-bottom: 14px;
        }
        .nav-drawer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-nav);
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-3);
        }
        .nav-drawer-brand img {
          height: 28px;
          width: auto;
        }
        .nav-drawer-links {
          display: grid;
          gap: 2px;
        }
        .nav-drawer a {
          display: block;
          font-family: var(--font-nav);
          font-size: 0.88rem;
          font-weight: 600;
          letter-spacing: 0.045em;
          text-transform: uppercase;
          color: var(--ink-2); text-decoration: none;
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0.85rem 0.75rem;
          margin-inline: -0.25rem;
          border-radius: var(--r-sm);
          border-bottom: 1px solid var(--cream-3);
          transition:
            color 0.32s var(--ease-out-expo),
            padding-left 0.32s var(--ease-out-expo),
            letter-spacing 0.32s var(--ease-out-expo),
            transform 0.24s var(--ease-out-expo),
            background 0.32s var(--ease-out-expo),
            box-shadow 0.32s var(--ease-out-expo),
            border-color 0.32s var(--ease-out-expo),
            filter 0.28s var(--ease-out-expo);
        }
        .nav-drawer a:hover:not(.is-active) {
          color: var(--accent);
          padding-left: 0.95rem;
          letter-spacing: 0.055em;
        }
        .nav-drawer a:active:not(.is-active) { transform: scale(0.985); letter-spacing: 0.04em; }
        .nav-drawer a.is-active {
          color: #fff;
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          border-bottom-color: transparent;
          box-shadow: 0 6px 20px rgba(217,79,42,0.32);
        }
        .nav-drawer a.is-active:hover {
          color: #fff;
          padding-left: 0.95rem;
          box-shadow: 0 8px 26px rgba(217,79,42,0.38);
          filter: brightness(1.05);
        }
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 3999;
          background: rgba(12,10,8,0.38); backdrop-filter: blur(6px);
          opacity: 0; pointer-events: none; transition: opacity 0.35s var(--ease-out-expo);
        }
        .drawer-overlay.open { opacity: 1; pointer-events: all; }

        /* ══════════════════════════════════════════
           HERO
        ══════════════════════════════════════════ */
        .hero-section {
          position: relative;
          min-height: clamp(600px, 92svh, 920px);
          display: flex;
          align-items: flex-start;
          overflow: hidden;
        }
        .hero-section::after {
          content: '';
          position: absolute; inset: 0; z-index: 1;
          background: var(--gradient-hero-mesh);
          pointer-events: none;
        }
        .hero-bg-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          z-index: 0;
        }
        /* Multi-layer overlay: dark bottom, warm left tint + edge vignette */
        .hero-overlay {
          position: absolute; inset: 0; z-index: 1;
          background:
            linear-gradient(105deg, rgba(8,6,5,0.82) 0%, rgba(8,6,5,0.42) 52%, rgba(8,6,5,0.12) 100%),
            linear-gradient(180deg, rgba(8,6,5,0.28) 0%, transparent 42%, rgba(8,6,5,0.65) 100%);
          box-shadow: inset 0 0 min(120px, 15vw) rgba(0,0,0,0.35);
        }
        .hero-inner {
          position: relative; z-index: 2;
          width: min(94%, 1200px); margin: 0 auto;
          padding: calc(var(--nav-h) + var(--s-4)) 0 max(var(--nav-section-inset-y), var(--s-8));
        }
        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(200px, 380px);
          gap: clamp(var(--s-6), 5vw, var(--s-8));
          align-items: center;
        }
        .hero-content {
          position: relative;
          max-width: 36rem;
          padding: 0;
          border: none;
          background: transparent;
          backdrop-filter: none;
          box-shadow: none;
        }

        .hero-headline {
          font-family: var(--font-sans);
          font-size: clamp(2.5rem, 5.2vw, 4.5rem);
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -0.038em;
          color: #FFFFFF;
          margin-bottom: var(--s-4);
          text-wrap: balance;
        }
        .hero-headline .static { display: block; }
        .hero-rotate-track {
          display: block; overflow: hidden; height: 1.05em;
        }
        .hero-rotate-word {
          display: inline-block;
          background: linear-gradient(135deg, #FF8C6B 0%, #D94F2A 60%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
        }
        .hero-suffix {
          font-size: clamp(1.08rem, 2vw, 1.55rem);
          font-weight: 500;
          font-style: italic;
          letter-spacing: -0.02em;
          opacity: 0.92;
          display: block;
          margin-top: 0.2rem;
        }

        .hero-sub {
          font-size: clamp(1.03rem, 1.2vw, 1.125rem);
          line-height: 1.72; color: rgba(255,255,255,0.9);
          max-width: 30rem; margin-bottom: var(--s-5);
          font-weight: 400;
          letter-spacing: 0.01em;
        }
        .hero-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); }
        .btn-hero-primary {
          display: inline-flex; align-items: center; gap: var(--s-2);
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          color: white;
          padding: 16px 28px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22);
          font-family: var(--font-sans); font-size: 0.9375rem; font-weight: 600;
          cursor: pointer;
          box-shadow: 0 12px 32px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.15);
          transition: transform 0.25s var(--ease-out-expo), box-shadow 0.25s var(--ease-out-expo), filter 0.25s var(--ease-out-expo);
        }
        .btn-hero-primary:hover { filter: brightness(1.05); transform: translateY(-3px); box-shadow: 0 18px 40px rgba(217,79,42,0.4); }
        .btn-hero-ghost {
          display: inline-flex; align-items: center; gap: var(--s-2);
          background: rgba(255,255,255,0.1); color: white;
          padding: 15px 26px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.32);
          font-family: var(--font-sans); font-size: 0.9375rem; font-weight: 500;
          cursor: pointer; backdrop-filter: blur(14px) saturate(1.2);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
          transition: background 0.25s var(--ease-out-expo), transform 0.25s var(--ease-out-expo), border-color 0.25s var(--ease-out-expo);
        }
        .btn-hero-ghost:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.45); transform: translateY(-3px); }
        .btn-hero-primary, .btn-hero-ghost { touch-action: manipulation; }

        .hero-aside {
          position: relative;
          min-height: 280px;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        }
        .hero-orbs {
          position: relative;
          width: min(100%, 340px);
          aspect-ratio: 1;
          border-radius: 50%;
          background:
            radial-gradient(circle at 35% 35%, rgba(217,79,42,0.38) 0%, transparent 55%),
            radial-gradient(circle at 70% 65%, rgba(74,103,65,0.22) 0%, transparent 50%);
          filter: blur(1px);
          opacity: 0.88;
          transform: translate(8%, -4%);
          pointer-events: none;
          transition: transform 1.2s var(--ease-out-expo), opacity 1.2s var(--ease-out-expo);
        }
        .hero-section:hover .hero-orbs {
          transform: translate(6%, -6%) scale(1.03);
          opacity: 0.95;
        }
        .hero-orbs::after {
          content: '';
          position: absolute;
          inset: 12%;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
          margin-top: var(--s-3);
          margin-bottom: var(--s-3);
        }
        .hero-kicker span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
        }

        /* ══════════════════════════════════════════
           PROBLEM
        ══════════════════════════════════════════ */
        .problem-section {
          background:
            radial-gradient(120% 90% at 50% 0%, rgba(217,79,42,0.08) 0%, transparent 56%),
            linear-gradient(180deg, #fcfaf7 0%, #f2ece3 100%);
          position: relative;
          border-top: 1px solid rgba(224,218,208,0.55);
          border-bottom: 1px solid rgba(224,218,208,0.55);
          overflow: hidden;
        }
        .problem-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(12, 10, 8, 0.025) 1px, transparent 1px);
          background-size: 20px 20px;
          opacity: 0.48;
          pointer-events: none;
        }
        .problem-section::after {
          content: '';
          position: absolute;
          right: min(-6vw, -32px);
          bottom: clamp(8%, 14vw, 18%);
          width: min(34vw, 320px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74, 103, 65, 0.14) 0%, rgba(74, 103, 65, 0.04) 42%, transparent 70%);
          filter: blur(2px);
          pointer-events: none;
        }
        .problem-section .container {
          position: relative; z-index: 1;
          padding-block: var(--nav-section-inset-y);
        }
        /* Centered section intros: same width, gap to content, title rhythm */
        .problem-header,
        .proof-header,
        .testi-header,
        .faq-header {
          text-align: center;
          max-width: 44rem;
          margin: 0 auto var(--section-header-gap);
        }
        .problem-header h2 {
          font-family: var(--font-sans);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.032em;
          color: var(--ink);
          margin-top: var(--section-title-after-eyebrow);
          margin-bottom: 1rem;
        }
        .problem-header h2 { font-size: clamp(2.1rem, 4.2vw, 3.35rem); }
        .proof-header .section-title,
        .testi-header .section-title,
        .faq-header .section-title,
        .programs-header .section-title {
          margin-top: var(--section-title-after-eyebrow);
          margin-bottom: 1rem;
        }
        .problem-header .section-lead,
        .proof-header .section-lead,
        .testi-header .section-lead,
        .faq-header .section-lead {
          margin: var(--section-lead-top) auto 0;
        }
        .programs-header .section-lead {
          margin-top: var(--section-lead-top);
          max-width: 40rem;
        }
        .problem-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(1rem, 2.2vw, 1.35rem);
          max-width: 1080px;
          margin: 0 auto;
        }
        .problem-card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: start;
          gap: clamp(0.85rem, 1.9vw, 1.1rem);
          padding: clamp(1.15rem, 2.2vw, 1.42rem) clamp(1.05rem, 2.1vw, 1.28rem);
          background: linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(252,250,247,0.95) 100%);
          border: 1px solid rgba(224,218,208,0.9);
          border-radius: 20px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.95) inset,
            0 2px 8px rgba(42,36,32,0.05),
            0 14px 30px rgba(62,52,42,0.08);
          transition: transform 0.35s var(--ease-out-expo), box-shadow 0.35s var(--ease-out-expo), border-color 0.35s var(--ease-out-expo);
          position: relative;
        }
        .problem-card:hover {
          transform: translateY(-4px);
          box-shadow:
            0 1px 0 rgba(255,255,255,1) inset,
            0 8px 22px rgba(42,36,32,0.08),
            0 28px 48px rgba(62,52,42,0.1);
          border-color: rgba(217,79,42,0.26);
        }
        .problem-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(130deg, rgba(217,79,42,0.24), rgba(74,103,65,0.18));
          opacity: 0.42;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          transition: opacity 0.35s var(--ease-out-expo), background 0.35s var(--ease-out-expo);
        }
        .problem-card:hover::before {
          opacity: 0.92;
          background: linear-gradient(130deg, rgba(217,79,42,0.42), rgba(74,103,65,0.32));
        }
        .problem-icon {
          width: 50px;
          height: 50px;
          flex-shrink: 0;
          border-radius: 15px;
          background: linear-gradient(145deg, rgba(217,79,42,0.15) 0%, rgba(217,79,42,0.09) 100%);
          color: #b35118;
          border: 1px solid rgba(217,79,42,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.62);
        }
        .problem-card-copy {
          min-width: 0;
        }
        .problem-card-index {
          align-self: flex-start;
          font-family: var(--font-sans);
          font-size: 0.64rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(110, 86, 60, 0.68);
          background: rgba(246, 239, 228, 0.72);
          border: 1px solid rgba(224,218,208,0.72);
          border-radius: 999px;
          padding: 0.22rem 0.42rem;
          margin-top: 3px;
          line-height: 1;
        }
        .problem-card h3 {
          font-size: clamp(1.02rem, 1.55vw, 1.12rem);
          font-weight: 750;
          color: var(--ink);
          margin-bottom: 0.32rem;
          line-height: 1.34;
          letter-spacing: -0.015em;
        }
        .problem-card p {
          font-size: 0.95rem;
          line-height: 1.58;
          color: var(--ink-3);
          max-width: 38ch;
        }

        /* ══════════════════════════════════════════
           PROOF & PRESS
        ══════════════════════════════════════════ */
        .proof-section {
          position: relative;
          overflow: hidden;
          border-top: 1px solid rgba(224, 218, 208, 0.78);
          border-bottom: 1px solid rgba(224, 218, 208, 0.72);
          padding: clamp(1.25rem, 3vw, 2rem) 0 calc(var(--nav-section-inset-y) + var(--s-2));
          background:
            linear-gradient(180deg, #fcfaf7 0%, #f4f0ea 42%, #ebe6df 100%);
          box-shadow: 0 -28px 56px rgba(12, 10, 8, 0.05);
        }
        .proof-section::before {
          content: '';
          position: absolute;
          top: -8%;
          left: 50%;
          transform: translateX(-50%);
          width: min(100%, 720px);
          height: min(48vh, 380px);
          background: radial-gradient(ellipse 72% 58% at 50% 0%, rgba(74, 103, 65, 0.09) 0%, transparent 68%);
          pointer-events: none;
        }
        .proof-section::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(12, 10, 8, 0.028) 1px, transparent 1px);
          background-size: 20px 20px;
          opacity: 0.5;
          pointer-events: none;
          mask-image: linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%);
        }
        .proof-section .container {
          position: relative;
          z-index: 1;
          max-width: min(100%, 1140px);
        }
        .proof-header {
          margin-bottom: clamp(1.75rem, 3.5vw, 2.5rem);
        }
        .proof-header .eyebrow {
          letter-spacing: 0.18em;
        }
        .proof-header .section-title {
          font-size: clamp(2.05rem, 4.1vw, 3.15rem);
          letter-spacing: -0.036em;
          line-height: 1.08;
        }
        .proof-header .section-lead {
          max-width: 36rem;
          font-size: clamp(1.02rem, 1.45vw, 1.12rem);
          line-height: 1.68;
        }
        .proof-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(1rem, 2vw, 1.35rem);
          max-width: 1040px;
          margin: 0 auto clamp(2rem, 4vw, 3rem);
          position: relative;
          z-index: 1;
        }
        .proof-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-height: 100%;
          padding: clamp(1.35rem, 2.4vw, 1.75rem) clamp(1.1rem, 2vw, 1.35rem);
          border-radius: clamp(18px, 2vw, 24px);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.98) 0%, rgba(253, 252, 250, 0.94) 100%);
          border: 1px solid rgba(224, 218, 208, 0.92);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.95) inset,
            0 2px 6px rgba(42, 36, 32, 0.04),
            0 20px 44px rgba(62, 52, 42, 0.07);
          transition:
            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.35s ease;
          position: relative;
        }
        .proof-stat::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 42%;
          height: 3px;
          border-radius: 0 0 999px 999px;
          background: linear-gradient(90deg, transparent, rgba(74, 103, 65, 0.35), rgba(217, 79, 42, 0.45), transparent);
          opacity: 0.85;
          transition: opacity 0.35s ease;
        }
        .proof-stat:hover {
          transform: translateY(-6px);
          border-color: rgba(217, 79, 42, 0.2);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 1) inset,
            0 18px 40px rgba(217, 79, 42, 0.1),
            0 28px 56px rgba(42, 36, 32, 0.09);
        }
        .proof-stat:hover::before {
          opacity: 1;
        }
        .proof-stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(74, 103, 65, 0.14) 0%, rgba(217, 79, 42, 0.1) 100%);
          color: var(--sage);
          border: 1px solid rgba(74, 103, 65, 0.2);
          box-shadow: 0 4px 14px rgba(74, 103, 65, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }
        .proof-stat-icon svg {
          color: var(--sage);
        }
        .proof-stat-icon img {
          width: 22px;
          height: 22px;
          object-fit: contain;
          display: block;
        }
        .proof-stat-icon.proof-stat-icon--photo {
          width: auto;
          height: auto;
          border-radius: 0;
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
        }
        .proof-stat-icon.proof-stat-icon--photo img {
          width: 62px;
          height: 62px;
        }
        .proof-stat strong {
          font-family: var(--font-sans);
          font-size: clamp(1.5rem, 2.5vw, 1.85rem);
          font-weight: 800;
          color: var(--ink);
          line-height: 1.15;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .proof-stat span {
          font-size: 0.875rem;
          color: var(--ink-3);
          margin-top: 0.5rem;
          line-height: 1.62;
          max-width: 16rem;
        }

        .partners-inner {
          max-width: min(100%, 1120px);
          margin: 0 auto;
          padding: clamp(2.1rem, 3.8vw, 2.85rem) clamp(var(--s-5), 4.5vw, var(--s-8));
          background: linear-gradient(168deg, #ffffff 0%, #fdfcfa 40%, #f8f5f0 100%);
          border: 1px solid rgba(224, 218, 208, 0.72);
          border-radius: clamp(28px, 4vw, 40px);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.98) inset,
            0 32px 64px rgba(12, 10, 8, 0.08),
            0 12px 28px rgba(12, 10, 8, 0.04);
          position: relative;
          z-index: 1;
          overflow: hidden;
          backdrop-filter: blur(16px) saturate(1.2);
          -webkit-backdrop-filter: blur(16px) saturate(1.2);
        }
        .partners-inner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: min(380px, 62%);
          height: 4px;
          border-radius: 0 0 999px 999px;
          background: linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent);
          opacity: 0.92;
          pointer-events: none;
        }
        .partners-inner::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 90% 50% at 50% -15%, rgba(217, 79, 42, 0.07) 0%, transparent 58%);
          pointer-events: none;
        }
        .partners-label {
          position: relative;
          z-index: 1;
          text-align: center;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: clamp(1.4rem, 2.8vw, 1.95rem);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.9rem;
        }
        .partners-label::before,
        .partners-label::after {
          content: '';
          flex: 0 1 44px;
          max-width: 64px;
          height: 1px;
          border-radius: 1px;
        }
        .partners-label::before {
          background: linear-gradient(90deg, transparent, rgba(217, 79, 42, 0.45));
        }
        .partners-label::after {
          background: linear-gradient(90deg, rgba(217, 79, 42, 0.45), transparent);
        }
        .partners-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: clamp(0.7rem, 1.8vw, 1.1rem);
          align-items: stretch;
          width: 100%;
          margin: 0 auto;
        }
        .partners-link {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 56px;
          padding: 0.6rem 0.7rem;
          border-radius: 0;
          background: transparent;
          border: none;
          text-decoration: none;
          transition:
            transform 0.38s cubic-bezier(0.22, 1, 0.36, 1),
            filter 0.38s ease;
        }
        .partners-link:hover {
          transform: translateY(-5px);
          filter: brightness(1.03);
        }
        .partners-link:focus-visible {
          outline: 2px solid rgba(217, 79, 42, 0.45);
          outline-offset: 3px;
        }
        .partners-link img {
          height: clamp(32px, 4vw, 42px);
          width: auto;
          max-width: min(132px, 100%);
          object-fit: contain;
          object-position: center;
          filter: grayscale(1) contrast(1.08);
          opacity: 0.48;
          transition:
            filter 0.4s var(--ease-out-expo),
            opacity 0.4s var(--ease-out-expo),
            transform 0.4s var(--ease-out-expo);
        }
        .partners-link:hover img,
        .partners-link:focus-visible img {
          filter: grayscale(0) contrast(1);
          opacity: 1;
          transform: scale(1.06);
        }

        /* ══════════════════════════════════════════
           ABOUT
        ══════════════════════════════════════════ */
        .about-section {
          background: var(--gradient-surface);
          padding-top: var(--nav-section-inset-y);
          padding-bottom: calc(var(--nav-section-inset-y) + var(--s-2));
          position: relative;
        }
        .about-section::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 55% at 0% 20%, rgba(193, 84, 10, 0.07) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 100% 0%, rgba(217, 79, 42, 0.05) 0%, transparent 55%);
          pointer-events: none;
        }
        .about-section .container { position: relative; z-index: 1; }
        .about-values-row {
          display: block;
          width: 100%;
          max-width: 100%;
          margin-top: clamp(var(--s-8), 5.5vw, calc(var(--s-10) + 8px));
          margin-left: 0;
          margin-right: 0;
          box-sizing: border-box;
        }
        .about-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: clamp(calc(var(--s-8) + 12px), 8vw, calc(var(--s-12) + 16px));
          align-items: center;
        }
        .about-visual-wrap {
          position: relative;
          max-width: min(100%, 420px);
          margin-inline: 0 auto;
          padding-bottom: var(--s-3);
        }
        .about-visual-wrap::before {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -46%);
          width: min(112%, 480px);
          aspect-ratio: 1;
          background:
            radial-gradient(circle at 38% 30%, rgba(255, 205, 160, 0.5) 0%, transparent 45%),
            radial-gradient(circle at 62% 70%, rgba(193, 84, 10, 0.2) 0%, transparent 52%),
            radial-gradient(circle at 50% 50%, rgba(217, 79, 42, 0.1) 0%, transparent 62%);
          border-radius: 50%;
          filter: blur(36px);
          z-index: 0;
          pointer-events: none;
        }
        .about-visual-wrap::after {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -46%);
          width: min(100%, 440px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.35) 0%, transparent 55%);
          opacity: 0.45;
          z-index: 0;
          pointer-events: none;
        }
        .about-img-frame {
          position: relative;
          z-index: 1;
          margin-inline: auto;
          border-radius: 50%;
          overflow: hidden;
          aspect-ratio: 1;
          max-width: min(100%, 400px);
          border: 3px solid rgba(255, 255, 255, 0.98);
          box-shadow:
            0 2px 4px rgba(12, 10, 8, 0.04),
            0 20px 48px rgba(12, 10, 8, 0.1),
            0 48px 88px rgba(193, 84, 10, 0.14),
            inset 0 0 0 1px rgba(255, 255, 255, 0.35);
        }
        .about-img-frame::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(12, 10, 8, 0.06);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.14) 0%, transparent 42%, rgba(12, 10, 8, 0.08) 100%);
        }
        .about-img-frame img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .about-img-frame:hover img { transform: scale(1.035); }

        .about-photo-caption {
          margin-top: var(--s-5);
          text-align: center;
          font-size: 0.71875rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--about-accent);
          max-width: 22rem;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.5;
          opacity: 0.95;
        }

        .about-copy {
          padding-left: clamp(0.25rem, 2.5vw, 1.75rem);
          padding-top: clamp(0, 1vw, var(--s-2));
          max-width: 38.5rem;
        }
        .about-copy .eyebrow {
          margin-bottom: 0.25rem;
        }
        .about-copy h2 {
          font-family: var(--font-sans);
          font-size: clamp(2.55rem, 4.85vw, 3.95rem);
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -0.038em;
          color: var(--ink);
          margin: clamp(1rem, 2.5vw, 1.35rem) 0 clamp(1.35rem, 3vw, 1.85rem);
          text-wrap: balance;
        }
        .about-copy h2 em.text-accent {
          color: var(--about-accent);
          font-style: normal;
        }
        .about-body {
          font-size: 1.09375rem;
          line-height: 1.82;
          color: var(--ink-2);
          max-width: 36rem;
          margin-bottom: clamp(1.85rem, 4vw, 2.5rem);
          letter-spacing: 0.008em;
          font-weight: 400;
        }

        .about-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          max-width: 42rem;
          padding: var(--s-2);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(253, 252, 250, 0.88) 100%);
          border: 1px solid rgba(224, 218, 208, 0.95);
          border-radius: var(--r-lg);
          box-shadow:
            var(--shadow-s),
            0 1px 0 rgba(255, 255, 255, 0.9) inset;
        }
        .about-stat {
          min-width: 0;
          padding: var(--s-4) var(--s-3);
          text-align: center;
          position: relative;
        }
        .about-stat:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 22%;
          right: 0;
          bottom: 22%;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(224, 218, 208, 1) 20%, rgba(224, 218, 208, 1) 80%, transparent);
        }
        .about-stat strong {
          display: block;
          font-size: clamp(1.35rem, 2.5vw, 1.72rem);
          font-weight: 800;
          letter-spacing: -0.035em;
          color: var(--ink);
          line-height: 1.08;
          font-variant-numeric: tabular-nums;
        }
        .about-stat span {
          display: block;
          margin-top: 10px;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--about-accent);
          line-height: 1.35;
          opacity: 0.92;
        }

        /* About — core values: editorial photo cards (reference-style row) */
        .about-values-inner {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: clamp(var(--s-7), 5.5vw, var(--s-11));
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding-top: clamp(var(--s-5), 3vw, var(--s-7));
          border-top: 1px solid rgba(224, 218, 208, 0.82);
          position: relative;
          text-align: center;
          box-sizing: border-box;
        }
        /* Isolate intro copy so it is visually centered on the page (not tied to the 2-col grid above). */
        .values-intro-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding-inline: clamp(0px, 2vw, var(--s-3));
        }
        .about-values-inner::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: min(100%, 120px);
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, var(--about-accent) 20%, var(--about-accent) 80%, transparent);
        }
        .values-section-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 0 1 auto;
          width: min(100%, 46rem);
          max-width: 46rem;
          margin: 0;
          padding-top: var(--s-3);
          padding-left: var(--s-2);
          padding-right: var(--s-2);
          box-sizing: border-box;
        }
        .values-section-header .values-eyebrow {
          color: var(--about-accent);
          letter-spacing: 0.22em;
          justify-content: center;
          text-align: center;
          align-self: center;
          margin-left: auto;
          margin-right: auto;
        }
        .values-section-header .eyebrow::before {
          background: linear-gradient(90deg, var(--about-accent), rgba(217, 79, 42, 0.78));
        }
        .values-section-title {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.08em;
          font-family: var(--font-sans);
          font-size: clamp(2rem, 4.25vw, 3.1rem);
          font-weight: 800;
          letter-spacing: -0.038em;
          line-height: 1.05;
          color: var(--ink);
          margin: var(--s-4) auto var(--s-3);
          text-align: center;
          width: 100%;
          max-width: 34rem;
        }
        .values-head-prefix {
          color: var(--ink);
          font-weight: 800;
          display: block;
        }
        .values-title-gradient {
          display: block;
          background: linear-gradient(100deg, #c1540a 0%, #e87828 45%, #f09848 85%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .values-section-lead {
          font-size: clamp(1rem, 1.35vw, 1.125rem);
          line-height: 1.68;
          color: var(--ink-3);
          letter-spacing: 0.01em;
          text-align: center;
          width: 100%;
          max-width: 36rem;
          margin: 0;
          margin-bottom: clamp(10px, 1.5vw, 14px);
          padding: 0;
          box-sizing: border-box;
        }
        /* Core values — 4-column row (screenshot-style); 3:4 cards; copy & gradient anchored to bottom */
        .values-photo-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(20px, 2.2vw, 28px);
          align-items: stretch;
          min-height: 0;
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
        }
        .value-photo-card {
          position: relative;
          width: 100%;
          min-width: 0;
          aspect-ratio: 3 / 4;
          height: auto;
          min-height: 0;
          margin: 0;
          border-radius: clamp(36px, 4vw, 48px);
          overflow: hidden;
          cursor: pointer;
          box-shadow:
            0 2px 12px rgba(42, 20, 10, 0.08),
            0 20px 44px rgba(62, 28, 12, 0.11);
          transition: box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .value-photo-card:focus {
          outline: none;
        }
        .value-photo-card:focus-visible {
          outline: 3px solid rgba(193, 84, 10, 0.92);
          outline-offset: 4px;
        }
        .value-photo-card:hover,
        .value-photo-card:focus-within {
          box-shadow:
            0 10px 28px rgba(90, 40, 16, 0.16),
            0 28px 52px rgba(120, 52, 20, 0.14);
        }
        .value-photo-media {
          position: absolute;
          inset: 0;
        }
        .value-photo-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          transform: scale(1.01);
          filter: grayscale(1) contrast(1.05) brightness(0.98);
          transition:
            transform 0.7s cubic-bezier(0.22, 1, 0.36, 1),
            filter 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .value-photo-card:hover .value-photo-media img,
        .value-photo-card:focus-within .value-photo-media img {
          transform: scale(1.055);
          filter: grayscale(0) contrast(1) brightness(1);
        }
        .value-photo-scrim {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: linear-gradient(
            to top,
            rgba(22, 12, 6, 0.94) 0%,
            rgba(52, 26, 10, 0.55) 28%,
            rgba(120, 58, 22, 0.18) 55%,
            transparent 78%
          );
          transition: background 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .value-photo-card:hover .value-photo-scrim,
        .value-photo-card:focus-within .value-photo-scrim {
          background: linear-gradient(
            to top,
            rgba(18, 8, 4, 0.97) 0%,
            rgba(48, 22, 8, 0.72) 32%,
            rgba(150, 72, 28, 0.28) 58%,
            transparent 82%
          );
        }
        .value-photo-scrim::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(118deg, rgba(193, 84, 10, 0.2) 0%, transparent 52%);
          mix-blend-mode: multiply;
          opacity: 0.88;
          transition: opacity 0.4s ease;
        }
        .value-photo-card:hover .value-photo-scrim::after,
        .value-photo-card:focus-within .value-photo-scrim::after {
          opacity: 0.98;
        }
        .value-photo-copy {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: stretch;
          padding: clamp(1rem, 2.2vw, 1.5rem);
          color: #fff;
          text-align: left;
          pointer-events: none;
        }
        .value-photo-copy-inner {
          width: 100%;
          transform: translateY(0);
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .value-photo-card:hover .value-photo-copy-inner,
        .value-photo-card:focus-within .value-photo-copy-inner {
          transform: translateY(-4px);
        }
        .value-photo-title {
          position: static;
          margin: 0;
          font-family: var(--font-sans);
          font-size: clamp(1.05rem, 1.55vw, 1.3rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.22;
          text-shadow: 0 2px 28px rgba(0, 0, 0, 0.55);
        }
        .value-photo-desc {
          position: static;
          margin: 0;
          margin-top: 0;
          padding-top: 0;
          font-size: clamp(0.76rem, 1.05vw, 0.88rem);
          line-height: 1.62;
          max-width: none;
          color: rgba(255, 255, 255, 0.96);
          font-weight: 500;
          letter-spacing: 0.02em;
          text-shadow: 0 1px 18px rgba(0, 0, 0, 0.55);
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transform: translateY(10px);
          transition:
            opacity 0.38s cubic-bezier(0.22, 1, 0.36, 1),
            max-height 0.48s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            margin-top 0.35s ease,
            padding-top 0.35s ease;
        }
        .value-photo-card:hover .value-photo-desc,
        .value-photo-card:focus-within .value-photo-desc {
          margin-top: 0.65rem;
          padding-top: 0.02em;
          max-height: 9.5rem;
          opacity: 1;
          transform: translateY(0);
        }
        /* No fine hover (touch): show title + description together, bottom-aligned */
        @media (hover: none) {
          .value-photo-copy {
            justify-content: flex-end;
            padding: clamp(1rem, 2.2vw, 1.5rem);
          }
          .value-photo-copy-inner {
            transform: none;
          }
          .value-photo-desc {
            max-height: none;
            opacity: 1;
            transform: none;
            margin-top: 0.65rem;
            padding-top: 0.02em;
          }
        }

        /* ══════════════════════════════════════════
           PROGRAMS
        ══════════════════════════════════════════ */
        .programs-section {
          background: var(--gradient-programs);
          padding: clamp(1.65rem, 3.5vw, 2.75rem) 0 calc(var(--nav-section-inset-y) + var(--s-2));
          position: relative; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 40px 72px rgba(0, 0, 0, 0.35);
        }
        .programs-section::after {
          content: '';
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%);
          pointer-events: none;
          opacity: 0.35;
        }
        /* Decorative orb */
        .programs-section::before {
          content: '';
          position: absolute; top: -20%; right: -10%;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(217,79,42,0.18) 0%, transparent 65%);
          pointer-events: none;
        }
        .programs-section .container { position: relative; z-index: 2; }
        .programs-header {
          position: relative; z-index: 1;
          margin-bottom: clamp(0.65rem, 1.35vw, 1.1rem);
          max-width: 44rem;
        }
        .programs-header .eyebrow { color: rgba(217,79,42,0.85); }
        .programs-header .eyebrow::before { background: rgba(217,79,42,0.85); }
        .programs-header .section-title { color: var(--white); }
        .programs-header .section-lead { color: rgba(255,255,255,0.64); }

        /* Swiper — programs carousel */
        .programs-swiper-shell { position: relative; z-index: 3; width: 100%; }
        .programs-swiper-outer {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 52px;
          position: relative;
        }
        .programs-swiper {
          --swiper-pagination-bullet-inactive-color: rgba(255, 255, 255, 0.28);
          padding: 0 clamp(52px, 5vw, 64px) 50px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .programs-swiper .swiper-wrapper {
          transition-timing-function: cubic-bezier(0.33, 1, 0.53, 1) !important;
        }
        .programs-swiper .swiper-slide {
          height: auto;
          will-change: transform;
        }
        .programs-swiper .swiper-pagination {
          bottom: 10px !important;
          display: flex !important;
          justify-content: center;
          align-items: center;
          gap: 10px;
        }
        .programs-swiper .swiper-pagination-bullet {
          width: 8px;
          height: 8px;
          margin: 0 !important;
          background: rgba(255, 255, 255, 0.2);
          opacity: 1;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
          transition:
            width 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            background 0.35s var(--ease-out-expo),
            transform 0.35s var(--ease-out-expo),
            border-color 0.35s var(--ease-out-expo),
            box-shadow 0.35s var(--ease-out-expo);
        }
        .programs-swiper .swiper-pagination-bullet:hover {
          background: rgba(255, 255, 255, 0.42);
          transform: scale(1.12);
        }
        .programs-swiper .swiper-pagination-bullet-active {
          width: 36px;
          background: linear-gradient(90deg, var(--accent) 0%, #f4a078 100%) !important;
          border-color: rgba(255, 255, 255, 0.35);
          box-shadow: 0 2px 16px rgba(217, 79, 42, 0.55);
          transform: scale(1);
        }
        /* Custom program nav (Lucide icons) — outside swiper */
        .prog-swiper-nav {
          position: absolute;
          top: 50%;
          z-index: 8;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          padding: 0;
          color: rgba(255, 255, 255, 0.95);
          cursor: pointer;
          border-radius: 16px;
          background: linear-gradient(155deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            0 4px 4px rgba(0, 0, 0, 0.12),
            0 24px 40px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(16px) saturate(1.25);
          -webkit-backdrop-filter: blur(16px) saturate(1.25);
          transition:
            background 0.3s var(--ease-out-expo),
            border-color 0.3s var(--ease-out-expo),
            color 0.3s ease,
            transform 0.3s var(--ease-out-expo),
            box-shadow 0.3s var(--ease-out-expo);
        }
        .prog-swiper-nav--prev {
          left: 0;
        }
        .prog-swiper-nav--next {
          right: 0;
        }
        .prog-swiper-nav:hover {
          background: linear-gradient(155deg, rgba(217, 79, 42, 0.45) 0%, rgba(217, 79, 42, 0.2) 100%);
          border-color: rgba(255, 180, 150, 0.45);
          color: #fff;
          transform: translateY(-50%) scale(1.04);
          box-shadow:
            0 8px 24px rgba(217, 79, 42, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .prog-swiper-nav:active {
          transform: translateY(-50%) scale(0.98);
        }
        .prog-swiper-nav:focus {
          outline: none;
        }
        .prog-swiper-nav:focus-visible {
          outline: 3px solid rgba(217, 79, 42, 0.85);
          outline-offset: 3px;
        }
        .prog-swiper-nav.swiper-button-disabled {
          opacity: 0.28;
          pointer-events: none;
          transform: translateY(-50%);
        }

        .prog-card {
          background: linear-gradient(155deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 42%, rgba(12, 10, 8, 0.15) 100%);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: var(--r-xl);
          overflow: hidden;
          display: flex;
          align-items: stretch;
          min-height: clamp(300px, 46vw, 380px);
          backdrop-filter: blur(20px) saturate(1.25);
          -webkit-backdrop-filter: blur(20px) saturate(1.25);
          transition:
            border-color 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          margin: var(--s-1) var(--s-1);
          box-shadow:
            0 4px 4px rgba(0, 0, 0, 0.12),
            0 24px 56px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
        }
        .prog-card:hover {
          border-color: rgba(217, 79, 42, 0.48);
          transform: translateY(-4px);
          box-shadow:
            0 8px 16px rgba(0, 0, 0, 0.18),
            0 36px 72px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(217, 79, 42, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }
        .prog-card-img {
          flex: 0 0 clamp(220px, 36vw, 400px);
          min-height: 280px;
          overflow: hidden;
          position: relative;
          align-self: stretch;
        }
        .prog-card-img::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(12, 10, 8, 0.12) 0%, transparent 42%, transparent 100%);
          pointer-events: none;
        }
        .prog-card-img img {
          width: 100%; height: 100%;
          min-height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .prog-card:hover .prog-card-img img { transform: scale(1.04); }
        .prog-card-body {
          flex: 1;
          min-width: 0;
          padding: clamp(2rem, 4vw, 3rem) clamp(1.75rem, 4vw, 3.25rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          gap: 0;
        }
        .prog-number {
          font-family: var(--font-sans);
          font-size: clamp(3.5rem, 8vw, 5rem);
          font-weight: 800;
          line-height: 1;
          color: rgba(255, 255, 255, 0.05);
          position: absolute;
          top: clamp(0.75rem, 2vw, 1.25rem);
          right: clamp(1rem, 3vw, 2rem);
          pointer-events: none;
          user-select: none;
          letter-spacing: -0.04em;
        }
        .prog-card-body h3 {
          font-family: var(--font-sans);
          font-size: clamp(1.55rem, 2.75vw, 2.2rem);
          font-weight: 800;
          color: #fff;
          line-height: 1.15;
          letter-spacing: -0.035em;
          margin: 0 0 1rem;
          text-wrap: balance;
        }
        .prog-card-desc {
          margin: 0;
          font-size: clamp(1rem, 1.35vw, 1.125rem);
          line-height: 1.78;
          color: rgba(255, 255, 255, 0.62);
          letter-spacing: 0.012em;
          font-weight: 400;
          max-width: 36rem;
        }
        .prog-tag {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          margin-bottom: 1rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 190, 165, 0.98);
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(217, 79, 42, 0.45);
          background: linear-gradient(135deg, rgba(217, 79, 42, 0.22) 0%, rgba(217, 79, 42, 0.08) 100%);
          box-shadow: 0 2px 12px rgba(217, 79, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        /* ══════════════════════════════════════════
           TESTIMONIALS (Stories)
        ══════════════════════════════════════════ */
        .testimonials-section {
          position: relative;
          border-top: 1px solid rgba(224, 218, 208, 0.78);
          background:
            linear-gradient(180deg, #f3f0ea 0%, var(--cream-2) 38%, #ebe4dc 100%);
          overflow: hidden;
        }
        .testimonials-section::before {
          content: '';
          position: absolute;
          top: -12%;
          left: 50%;
          transform: translateX(-50%);
          width: min(110%, 900px);
          height: min(55vh, 420px);
          background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(217, 79, 42, 0.11) 0%, transparent 72%);
          pointer-events: none;
        }
        .testimonials-section::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(12, 10, 8, 0.035) 1px, transparent 1px);
          background-size: 22px 22px;
          opacity: 0.45;
          pointer-events: none;
          mask-image: linear-gradient(180deg, transparent 0%, black 14%, black 88%, transparent 100%);
        }
        .testimonials-section .container {
          position: relative;
          z-index: 1;
          padding-top: clamp(1.25rem, 3vw, 2rem);
          padding-bottom: clamp(0.7rem, 2.4vw, 1.25rem);
          max-width: min(100%, 1180px);
        }
        .testimonials-section.snap-page {
          min-height: auto;
        }
        .testi-header {
          margin-bottom: clamp(2rem, 4.5vw, 3rem);
        }
        .testi-header .eyebrow {
          letter-spacing: 0.2em;
        }
        .testi-header .section-title {
          font-size: clamp(2.15rem, 4.5vw, 3.15rem);
          letter-spacing: -0.038em;
          line-height: 1.05;
        }
        .testi-header .section-lead {
          max-width: 38rem;
          font-size: clamp(1.02rem, 1.5vw, 1.14rem);
          line-height: 1.68;
          color: var(--ink-3);
        }
        .testi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(1.15rem, 2.2vw, 1.5rem);
          align-items: stretch;
          margin-top: 0;
        }
        .testi-grid > * {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .testi-card {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          padding: clamp(1.35rem, 2.2vw, 1.65rem);
          border-radius: clamp(20px, 2.2vw, 26px);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.98) 0%, rgba(253, 252, 250, 0.92) 55%, rgba(250, 248, 244, 0.98) 100%);
          border: 1px solid rgba(224, 218, 208, 0.95);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.9) inset,
            0 2px 4px rgba(42, 36, 32, 0.04),
            0 28px 56px rgba(62, 48, 38, 0.08);
          overflow: hidden;
          transition:
            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.35s ease;
        }
        .testi-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent) 0%, rgba(217, 79, 42, 0.35) 42%, rgba(217, 79, 42, 0.08) 100%);
          opacity: 0.85;
          transition: opacity 0.35s ease;
        }
        .testi-card:hover {
          transform: translateY(-8px);
          border-color: rgba(217, 79, 42, 0.22);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.95) inset,
            0 16px 40px rgba(217, 79, 42, 0.12),
            0 24px 64px rgba(42, 36, 32, 0.1);
        }
        .testi-card:hover::before {
          opacity: 1;
        }
        .testi-stars-row {
          display: flex;
          align-items: center;
          margin-bottom: 1.1rem;
        }
        .testi-stars {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(217, 79, 42, 0.07);
          border: 1px solid rgba(217, 79, 42, 0.12);
        }
        .testi-stars svg {
          fill: #e8962e;
          color: #e8962e;
          filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.5));
        }
        .testi-quote {
          font-family: var(--font-sans);
          font-size: clamp(0.94rem, 1.35vw, 1.02rem);
          font-weight: 400;
          font-style: italic;
          line-height: 1.72;
          color: var(--ink-2);
          flex: 1 1 auto;
          margin: 0 0 1.25rem;
          padding: 0;
          letter-spacing: 0.01em;
          min-height: 0;
          position: relative;
          quotes: none;
        }
        .testi-quote::before {
          content: '';
          display: block;
          width: 36px;
          height: 3px;
          border-radius: 999px;
          margin-bottom: 0.85rem;
          background: linear-gradient(90deg, rgba(217, 79, 42, 0.55), rgba(217, 79, 42, 0.08));
        }
        .testi-footer {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin-top: auto;
          padding-top: 1.1rem;
          flex-shrink: 0;
          border-top: 1px solid rgba(224, 218, 208, 0.85);
        }
        .testi-avatar {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          flex-shrink: 0;
          background: linear-gradient(145deg, var(--accent) 0%, #9a3010 100%);
          color: white;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 2px 6px rgba(217, 79, 42, 0.35),
            0 0 0 2px rgba(255, 255, 255, 0.95);
        }
        .testi-name {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--ink);
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .testi-role {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 3px;
        }

        /* ══════════════════════════════════════════
           FAQ
        ══════════════════════════════════════════ */
        .faq-section {
          background: var(--surface);
          border-top: 1px solid rgba(224, 218, 208, 0.65);
          position: relative;
        }
        .faq-section .container {
          position: relative;
          z-index: 1;
          padding-top: var(--nav-section-inset-y);
          padding-bottom: var(--nav-section-inset-y);
        }
        /* Inset “orb” panel: orange gradient + grain (reference-style), large space radius */
        .faq-orbit {
          position: relative;
          border-radius: clamp(36px, 5.5vw, 56px);
          padding: clamp(2.35rem, 5.5vw, 3.85rem) clamp(1.15rem, 3.8vw, 2.35rem);
          overflow: hidden;
          isolation: isolate;
          background: linear-gradient(
            128deg,
            #6e2a04 0%,
            #8f3a0a 18%,
            #b7490e 38%,
            #d46218 58%,
            #e8802e 78%,
            #f0a050 100%
          );
          box-shadow:
            0 4px 26px rgba(62, 24, 6, 0.14),
            0 32px 72px rgba(100, 40, 10, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
        }
        .faq-orbit::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 85% 60% at 14% 16%, rgba(255, 224, 196, 0.28) 0%, transparent 52%),
            radial-gradient(ellipse 65% 48% at 92% 88%, rgba(90, 36, 8, 0.45) 0%, transparent 55%);
        }
        .faq-orbit::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: 0;
          opacity: 0.2;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .faq-orbit > * {
          position: relative;
          z-index: 1;
        }
        .faq-orbit .eyebrow {
          color: rgba(255, 250, 245, 0.92);
        }
        .faq-orbit .eyebrow::before {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.55), rgba(255, 220, 190, 0.35));
        }
        .faq-orbit .section-title {
          color: #fff;
          text-shadow: 0 2px 28px rgba(40, 14, 0, 0.25);
        }
        .faq-orbit .section-title em,
        .faq-orbit .text-accent {
          color: #ffe8d4;
          font-style: normal;
        }
        .faq-orbit .section-lead {
          color: rgba(255, 248, 242, 0.86);
        }
        .faq-list {
          max-width: 752px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--s-4);
        }
        .faq-item {
          background: var(--white);
          border: 1px solid rgba(224,218,208,0.92);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-s);
          overflow: hidden;
          transition: border-color 0.28s var(--ease-out-expo), box-shadow 0.28s var(--ease-out-expo);
        }
        .faq-item.is-open {
          border-color: rgba(217,79,42,0.28);
          box-shadow: var(--shadow-m);
        }
        .faq-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--s-3);
          padding: var(--s-4) var(--s-4);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 600;
          color: var(--ink);
          text-align: left;
          appearance: none;
          -webkit-appearance: none;
          transition: color 0.2s var(--ease-out-expo), background 0.2s var(--ease-out-expo);
        }
        .faq-trigger::-moz-focus-inner {
          border: 0;
        }
        .faq-trigger:hover { background: rgba(12,10,8,0.02); }
        /* Avoid outline + overflow:hidden on .faq-item clipping into a full-width “divider” after click. */
        .faq-trigger:focus {
          outline: none;
        }
        .faq-trigger:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px rgba(217,79,42,0.42);
          border-radius: var(--r-sm);
        }
        .faq-chevron {
          flex-shrink: 0;
          color: var(--muted);
          transition: transform 0.35s var(--ease-out-expo), color 0.2s;
        }
        .faq-item.is-open .faq-chevron {
          transform: rotate(180deg);
          color: var(--accent);
        }
        .faq-panel {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.38s var(--ease-out-expo);
        }
        .faq-item.is-open .faq-panel { grid-template-rows: 1fr; }
        .faq-panel-inner {
          overflow: hidden;
          border-top: none;
        }
        .faq-item.is-open .faq-trigger {
          border-bottom: none;
        }
        .faq-panel-inner p {
          padding: 0 var(--s-4) var(--s-5);
          font-size: 1rem;
          line-height: 1.72;
          color: var(--ink-3);
          letter-spacing: 0.01em;
        }

        /* ══════════════════════════════════════════
           FOOTER CTA
        ══════════════════════════════════════════ */
        .footer-cta-section {
          background: var(--gradient-surface);
          border-top: 1px solid rgba(224,218,208,0.75);
          padding-top: var(--nav-section-inset-y);
          padding-bottom: var(--nav-section-inset-y);
          overflow: hidden; position: relative;
        }
        .footer-cta-section::before {
          content: '';
          position: absolute; left: 50%; top: 40%;
          transform: translate(-50%, -50%);
          width: min(900px, 120vw); height: min(480px, 70vw);
          background: radial-gradient(ellipse, rgba(217,79,42,0.1) 0%, transparent 68%);
          pointer-events: none;
        }
        .footer-cta-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
          gap: clamp(var(--s-6), 5vw, var(--s-10));
          align-items: start;
          text-align: left;
          position: relative; z-index: 1;
        }
        .footer-cta-copy { max-width: 38rem; }
        .footer-cta-eyebrow { margin-bottom: var(--s-4); }
        .footer-cta-section h2 {
          font-family: var(--font-sans);
          font-size: clamp(2.35rem, 4.5vw, 3.75rem); font-weight: 800;
          letter-spacing: -0.032em; line-height: 1.1;
          color: var(--ink); margin-bottom: var(--s-4);
          text-wrap: balance;
        }
        .footer-cta-section .lead {
          font-size: 1.125rem; color: var(--ink-3); max-width: 36rem;
          margin: 0; line-height: 1.75;
          letter-spacing: 0.008em;
        }
        .cta-contact-grid {
          display: grid; grid-template-columns: 1fr;
          gap: var(--s-4);
          max-width: none;
          margin: var(--s-5) 0 0;
        }
        .cta-phone-mockup-wrap {
          display: grid;
          place-items: end center;
          width: 100%;
          margin-top: var(--s-2);
        }
        .cta-phone-mockup {
          display: block;
          width: min(100%, 680px);
          height: auto;
          object-fit: contain;
          background: transparent;
          filter: drop-shadow(0 24px 44px rgba(12, 10, 8, 0.16));
        }
        .footer-cta-section .btn-primary.btn-accent {
          padding: 1rem 1.875rem;
          font-size: 0.9375rem;
        }
        .cta-contact-box {
          display: flex; align-items: center; gap: var(--s-3);
          padding: var(--s-4) var(--s-4);
          background: var(--white);
          border: 1px solid rgba(224,218,208,0.95);
          border-radius: var(--r-md); cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.9rem; font-weight: 600; color: var(--ink);
          box-shadow: var(--shadow-s);
          transition: transform 0.28s var(--ease-out-expo), box-shadow 0.28s var(--ease-out-expo), border-color 0.28s var(--ease-out-expo), background 0.28s var(--ease-out-expo);
        }
        .cta-contact-box:hover {
          transform: translateY(-4px); box-shadow: var(--shadow-m);
          border-color: rgba(217,79,42,0.45);
          background: var(--surface);
        }
        .cta-contact-box svg { color: var(--accent); flex-shrink: 0; }
        .cta-contact-box-text { text-align: left; flex: 1; min-width: 0; }
        .cta-contact-box-label { font-size: 0.9rem; font-weight: 600; color: var(--ink); }
        .cta-contact-box-detail { font-size: 0.875rem; color: var(--ink-3); font-weight: 400; margin-top: 6px; line-height: 1.55; }

        /* ══════════════════════════════════════════
           FOOTER INFO — reads as site footer, not a content section
        ══════════════════════════════════════════ */
        .footer-info {
          position: relative;
          margin-top: auto;
          background: linear-gradient(180deg, #0D0B09 0%, #080706 48%, #050403 100%);
          color: rgba(255,255,255,0.72);
          padding: 0;
          box-shadow:
            0 -1px 0 rgba(255,255,255,0.06),
            0 -32px 64px rgba(0,0,0,0.45);
        }
        .footer-accent-bar {
          height: 4px;
          width: 100%;
          background: linear-gradient(90deg, transparent 0%, var(--accent) 22%, var(--accent-2) 50%, var(--accent) 78%, transparent 100%);
          opacity: 0.95;
        }
        .footer-info-main {
          padding: var(--nav-section-inset-y) 0 max(var(--s-6), calc(var(--nav-section-inset-y) * 0.98));
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr 1fr 1fr;
          gap: clamp(2rem, 5vw, 3.5rem);
        }
        .footer-brand img { height: 40px; width: auto; margin-bottom: 1.1rem; opacity: 0.98; }
        .footer-brand p {
          font-size: 0.9375rem;
          line-height: 1.72;
          max-width: 22rem;
          color: rgba(255,255,255,0.5);
        }
        .footer-col-head {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.38);
          margin-bottom: 1.15rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .footer-contact-item {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 0.9rem;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.62);
        }
        .footer-contact-item svg { color: var(--accent); flex-shrink: 0; }
        .footer-contact-item a { color: inherit; text-decoration: none; transition: color 0.28s var(--ease-out-expo); }
        .footer-contact-item a:hover { color: #fff; }
        .footer-legal-link {
          display: block;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.48);
          text-decoration: none;
          padding: 0.32rem 0;
          margin-bottom: 0.15rem;
          border-radius: 4px;
          transition: color 0.25s var(--ease-out-expo), transform 0.25s var(--ease-out-expo), padding-left 0.25s var(--ease-out-expo);
        }
        .footer-legal-link:hover {
          color: #fff;
          padding-left: 6px;
          transform: translateX(0);
        }
        .footer-bottom-strip {
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.35);
          padding: var(--s-4) 0 calc(var(--s-4) + env(safe-area-inset-bottom, 0px));
        }
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem 1.5rem;
        }
        .footer-copy {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.34);
          letter-spacing: 0.02em;
        }
        .footer-brand-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        /* ══════════════════════════════════════════
           BACK TO TOP
        ══════════════════════════════════════════ */
        .back-top {
          position: fixed; bottom: 28px; right: 24px; z-index: 2100;
          display: flex; align-items: center; gap: 7px;
          padding: 10px 16px;
          background: var(--ink); color: white; border: none;
          border-radius: 999px; font-family: var(--font-sans);
          font-size: 0.8125rem; font-weight: 600; cursor: pointer;
          box-shadow: var(--shadow-l);
          opacity: 0; visibility: hidden; pointer-events: none;
          transform: translateY(12px);
          transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease, background 0.2s ease;
        }
        .back-top:hover { background: #1a1510; transform: translateY(-2px); }
        .back-top.visible { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0); }
        .back-top.visible:hover { transform: translateY(-3px); }

        /* ══════════════════════════════════════════
           RESPONSIVE
        ══════════════════════════════════════════ */
        @media (max-width: 1024px) {
          html { scroll-snap-type: y proximity; }
          .container { width: min(94%, 1168px); }
          .nav-shell { padding: var(--s-1) var(--s-2) 0; }
          .nav {
            min-height: 66px;
            padding-inline: var(--s-2);
            border-radius: var(--r-lg);
          }
          .nav-links-desktop { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .nav-right .btn-primary { padding: 10px 16px; font-size: 0.76rem; }
          .hero-section { min-height: 80svh; }
          .hero-section.snap-page { min-height: 100svh; min-height: 100dvh; }
          .hero-inner { padding: calc(var(--nav-h) + var(--s-3)) 0 max(var(--nav-section-inset-y), var(--s-6)); }
          .hero-grid { grid-template-columns: 1fr; gap: var(--s-5); }
          .hero-aside { display: none; }
          .hero-content { max-width: 100%; }
          .footer-cta-layout {
            grid-template-columns: 1fr;
            text-align: center;
            gap: var(--s-6);
          }
          .footer-cta-copy { max-width: none; margin-inline: auto; }
          .footer-cta-section .lead { margin-inline: auto; }
          .cta-contact-grid { max-width: 420px; margin: var(--s-5) auto 0; }
          .cta-contact-box-text { text-align: center; }
          .cta-phone-mockup-wrap {
            place-items: center;
            margin-top: var(--s-3);
          }
          .cta-phone-mockup {
            width: min(100%, 520px);
          }
          .about-grid { grid-template-columns: 1fr; align-items: start; }
          .about-visual-wrap { max-width: none; margin-inline: auto; }
          .about-img-frame { aspect-ratio: 1; max-width: min(100%, 380px); }
          .about-copy { padding-left: 0; max-width: none; padding-top: var(--s-4); }
          .values-photo-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: clamp(16px, 2.5vw, 22px);
          }
          .value-photo-card {
            aspect-ratio: 3 / 4;
          }
          .about-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0;
            max-width: none;
          }
          .about-stat { padding: var(--s-3) var(--s-2); }
          .testi-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr 1fr; }
          .prog-card {
            flex-direction: column;
            min-height: 0;
            margin: var(--s-2) var(--s-1);
          }
          .prog-card-img {
            flex: none;
            width: 100%;
            min-height: 240px;
            height: min(48vw, 300px);
          }
          .prog-card-body {
            padding: var(--s-5) var(--s-4) var(--s-6);
          }
          .prog-swiper-nav {
            width: 46px;
            height: 46px;
            border-radius: 14px;
          }
          .prog-swiper-nav:hover {
            transform: translateY(-50%) scale(1.04);
          }
          .prog-swiper-nav.swiper-button-disabled {
            transform: translateY(-50%);
          }
          .problem-grid { grid-template-columns: 1fr; }
          .problem-card {
            grid-template-columns: auto 1fr;
            gap: var(--s-3);
          }
          .problem-card-index {
            grid-column: 2;
            justify-self: start;
            margin-top: 0.15rem;
          }
          .proof-stats { grid-template-columns: 1fr; max-width: 420px; }
          .partners-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 1025px) and (max-width: 1320px) {
          .nav-links-desktop a {
            font-size: 0.68rem;
            letter-spacing: 0.04em;
            padding: 9px 8px;
          }
          .nav-right .btn-primary {
            padding: 10px 16px;
            font-size: 0.75rem;
          }
        }
        @media (min-width: 1440px) {
          .container { width: min(90%, 1280px); }
          .nav {
            width: min(100%, 1280px);
            min-height: 76px;
            padding: 10px 20px 10px 24px;
          }
          .nav-logo img { height: 48px; }
          .nav-links-desktop a {
            font-size: 0.8rem;
            padding: 11px 14px;
          }
          .nav-right .btn-primary {
            padding: 12px 22px;
            font-size: 0.83rem;
          }
          .problem-card p,
          .value-photo-desc,
          .cta-contact-box-detail { font-size: 0.93rem; }
          .testi-quote { font-size: 1.02rem; }
        }
        @media (min-width: 1920px) {
          .container { width: min(86%, 1360px); }
          .section-title { font-size: clamp(2.5rem, 3.2vw, 4.35rem); }
          .section-lead { font-size: 1.125rem; }
          .problem-grid { gap: var(--s-4); }
          .testi-grid { gap: var(--s-4); }
        }
        /* Core values: single column on small phones */
        @media (max-width: 640px) {
          .lp-root {
            --nav-section-inset-y: clamp(2.25rem, 6vw, 3.25rem);
            --section-header-gap: clamp(1.75rem, 5vw, 2.75rem);
          }
          html { scroll-snap-type: y proximity; }
          .container { width: min(96%, 1200px); padding-inline: clamp(12px, 4vw, var(--s-3)); }
          .snap-page:not(.hero-section) { padding-block: clamp(2.75rem, 7vw, 4rem); }
          .partners-inner { padding: var(--s-4) var(--s-3); border-radius: var(--r-lg); }
          .partners-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
          .partners-link { min-height: 48px; padding: 0.5rem 0.45rem; }
          .partners-label::before,
          .partners-label::after { flex-basis: 22px; max-width: 32px; }
          .nav-shell { padding-inline: 10px; }
          .nav {
            min-height: 60px;
            padding: 6px 10px;
            border-radius: 18px;
          }
          .nav::before {
            inset: -5px;
            border-radius: 22px;
          }
          .nav-logo img { height: 36px; }
          .nav-right { gap: 6px; }
          .nav-right .btn-primary {
            padding: 8px 12px;
            font-size: 0.72rem;
            gap: 6px;
          }
          .hamburger-btn { padding: 9px; }
          .hero-section { min-height: 76svh; }
          .hero-section.snap-page { min-height: 100svh; min-height: 100dvh; }
          .hero-content { padding: 0; border-radius: 0; }
          .hero-inner { padding: calc(var(--nav-h) + var(--s-2)) 0 max(var(--nav-section-inset-y), var(--s-5)); }
          .hero-headline { font-size: clamp(2.1rem, 9vw, 2.85rem); }
          .hero-sub { max-width: 100%; font-size: 0.98rem; }
          .hero-actions { width: 100%; }
          .btn-hero-primary, .btn-hero-ghost { width: 100%; justify-content: center; }
          .btn-hero-primary, .btn-hero-ghost { min-height: 46px; }
          .problem-card, .cta-contact-box { padding: var(--s-4); }
          .problem-card {
            grid-template-columns: auto 1fr;
            gap: var(--s-3);
          }
          .problem-card-index {
            font-size: 0.66rem;
            padding: 0.2rem 0.4rem;
          }
          .testi-card {
            padding: clamp(1.15rem, 4vw, 1.4rem);
            transform: none;
          }
          .testi-card:hover { transform: none; box-shadow: var(--shadow-s); }
          .proof-stat:hover {
            transform: none;
            box-shadow:
              0 1px 0 rgba(255, 255, 255, 0.95) inset,
              0 2px 6px rgba(42, 36, 32, 0.04),
              0 20px 44px rgba(62, 52, 42, 0.07);
          }
          .values-photo-grid {
            grid-template-columns: 1fr;
            max-width: 320px;
            margin-inline: auto;
          }
          .value-photo-card {
            max-width: 100%;
            aspect-ratio: 4 / 5;
            min-height: 0;
          }
          .value-photo-copy {
            padding: clamp(0.875rem, 4vw, 1.15rem);
          }
          .about-stats {
            gap: 0;
            padding: var(--s-1);
            grid-template-columns: 1fr;
          }
          .about-stat {
            padding: var(--s-3) var(--s-4);
          }
          .about-stat:not(:last-child)::after {
            display: none;
          }
          .about-stat:not(:last-child) {
            border-bottom: 1px solid rgba(224, 218, 208, 0.95);
          }
          .about-stat strong { font-size: clamp(1.08rem, 4.5vw, 1.32rem); }
          .about-stat span { font-size: 0.6rem; letter-spacing: 0.1em; }
          .programs-swiper {
            padding: 0 var(--s-2) 40px;
          }
          .programs-swiper-outer {
            padding-bottom: 44px;
          }
          .prog-swiper-nav {
            display: none;
          }
          .prog-card-body {
            padding: var(--s-5) var(--s-4) var(--s-6);
          }
          .prog-card-body h3 { font-size: clamp(1.35rem, 7vw, 1.65rem); }
          .prog-card-desc { font-size: 0.98rem; }
          .faq-trigger { min-height: 48px; padding: var(--s-3) var(--s-3); }
          .faq-panel-inner p { padding: 0 var(--s-3) var(--s-4); }
          .faq-orbit {
            border-radius: clamp(24px, 6vw, 40px);
            padding: clamp(1.65rem, 6vw, 2.65rem) clamp(0.75rem, 4vw, 1.15rem);
          }
          .testi-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr; }
          .footer-info-main {
            padding: var(--nav-section-inset-y) 0 max(var(--s-4), calc(var(--nav-section-inset-y) * 0.85));
          }
          .footer-bottom { flex-direction: column; text-align: center; justify-content: center; }
          .footer-brand-name { justify-content: center; }
          .footer-cta-section h2 { font-size: clamp(1.9rem, 9vw, 2.35rem); }
          .footer-copy { font-size: 0.75rem; }
          .back-top { right: 16px; bottom: 20px; }
        }
        @media (max-width: 420px) {
          .nav-right .btn-primary { min-width: 88px; justify-content: center; }
          .nav-right .btn-primary svg { display: none; }
          .nav-drawer { width: 100%; }
          .hero-headline { font-size: clamp(1.95rem, 10vw, 2.45rem); }
          .section-title { font-size: clamp(1.85rem, 8.8vw, 2.35rem); }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .testi-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* ── Overlay for mobile drawer ── */}
      <div
        className={`drawer-overlay${isMenuOpen ? ' open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden
      />

      {/* ── Mobile nav drawer ── */}
      <nav className={`nav-drawer${isMenuOpen ? ' open' : ''}`}>
        <div className="nav-drawer-head">
          <div className="nav-drawer-brand">
            <img src={logoSrc} alt="" aria-hidden style={headerLogoImgStyle} />
            Menu
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>
        <div className="nav-drawer-links">
          {m.navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? 'is-active' : ''}
              onClick={(e) => onNavSectionClick(e, item.id)}
            >
              {item.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary btn-accent"
          onClick={() => { setIsMenuOpen(false); navigate('/login'); }}
          style={{ marginTop: '1.5rem', justifyContent: 'center', fontSize: '1rem', padding: '0.85rem 1.5rem' }}
        >
          Login
        </button>
      </nav>

      {/* ══════ NAV ══════ */}
      <header className={`nav-shell${navElevated ? ' elevated' : ''}`}>
        <div className="nav">
          <button type="button" className="nav-logo" onClick={scrollToTop} aria-label="Bridges of Hope — Home">
            <img src={logoSrc} alt="Bridges of Hope" style={headerLogoImgStyle} />
          </button>
          <LayoutGroup id="nav-desktop-pills">
            <nav className="nav-links-desktop" aria-label="Primary">
              {m.navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={activeSection === item.id ? 'is-active' : ''}
                  onClick={(e) => onNavSectionClick(e, item.id)}
                >
                  {activeSection === item.id ? (
                    <motion.span
                      layoutId="nav-desktop-pill"
                      className="nav-desktop-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 1 }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="nav-link-label">{item.label}</span>
                </a>
              ))}
            </nav>
          </LayoutGroup>
          <div className="nav-right">
            <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
              Login <ArrowRight size={15} />
            </button>
            <button type="button" className={`hamburger-btn${isMenuOpen ? ' open' : ''}`} onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Open menu">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      <LandingPageBodySections
        order={landingSectionOrder}
        m={m}
        cmsEditMode={cmsEditMode}
        heroWords={heroWords}
        heroWordIndex={heroWordIndex}
        problemItems={problemItems}
        programSlides={programSlides}
        testimonialStories={testimonialStories}
        faqItems={faqItems}
        valueCards={valueCards}
        navigate={navigate}
        onNavSectionClick={onNavSectionClick}
        scrollToSection={scrollToSection}
        openFaqIndex={openFaqIndex}
        toggleFaq={toggleFaq}
        pressOutletRows={pressOutletRows}
      />

      {/* ── Back to top ── */}
      <button type="button" className={`back-top${showBackToTop ? ' visible' : ''}`} onClick={scrollToTop} aria-label="Back to top">
        <ChevronUp size={18} strokeWidth={2.5} />
        Back to top
      </button>
    </div>
  );
};

export default LandingPage;