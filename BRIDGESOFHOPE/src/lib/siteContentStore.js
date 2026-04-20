/**
 * Public landing page content + theme. Persisted in localStorage (Wix-like CMS for this app).
 * Dispatches `bh-site-content` on save so open tabs can refresh.
 */

export const SITE_CONTENT_STORAGE_KEY = 'bh_site_content_v1';
export const SITE_CONTENT_EVENT = 'bh-site-content';

/** @param {string} hex */
export function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
  if (!m) return `rgba(217, 79, 42, ${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** @returns {import('react').CSSProperties} */
export function getLandingThemeStyles(theme) {
  if (!theme) return {};
  const a = theme.accent || '#D94F2A';
  return {
    '--accent': a,
    '--accent-h': theme.accentHover || '#B83F20',
    '--accent-2': theme.accent2 || '#E86B4A',
    '--accent-s': hexToRgba(a, 0.12),
    '--accent-glow': hexToRgba(a, 0.22),
    '--about-accent': theme.aboutAccent || '#C1540A',
    '--cream': theme.cream || '#F7F5F1',
    '--cream-2': theme.cream2 || '#EEEBE5',
    '--surface': theme.surface || '#FDFCFA',
    '--ink': theme.ink || '#0C0A08',
    '--r-sm': theme.radiusSm || '14px',
    '--r-md': theme.radiusMd || '18px',
    '--r-lg': theme.radiusLg || '26px',
    '--font-sans': theme.fontStack || "'Inter', system-ui, -apple-system, sans-serif",
    '--gradient-hero-mesh': `radial-gradient(ellipse 80% 55% at 20% 35%, ${hexToRgba(a, 0.12)} 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 85% 20%, rgba(74,103,65,0.08) 0%, transparent 50%)`,
  };
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  if (Array.isArray(patch)) return patch.slice();
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = base[k];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[k] = Array.isArray(pv) ? pv.slice() : pv;
    }
  }
  return out;
}

/** Full defaults — mirrors `landingpage.jsx` copy. */
export const DEFAULT_SITE_CONTENT = {
  version: 1,
  /** Header / footer logos (https, /path, or Supabase URL). Empty = bundled assets. */
  branding: {
    logoUrl: '',
    footerLogoUrl: '',
    /** 0 = use built-in CSS heights (responsive). Otherwise image height in px (width auto). */
    headerLogoHeightPx: 0,
    footerLogoHeightPx: 0,
    /** Bottom strip mark; 0 = default (~20px). */
    footerLogoStripHeightPx: 0,
  },
  theme: {
    accent: '#D94F2A',
    accentHover: '#B83F20',
    accent2: '#E86B4A',
    aboutAccent: '#C1540A',
    cream: '#F7F5F1',
    cream2: '#EEEBE5',
    surface: '#FDFCFA',
    ink: '#0C0A08',
    radiusSm: '14px',
    radiusMd: '18px',
    radiusLg: '26px',
    fontStack: "'Inter', system-ui, -apple-system, sans-serif",
  },
  navItems: [
    { id: 'problem', label: 'Challenge' },
    { id: 'services', label: 'Services' },
    { id: 'proof', label: 'Proof' },
    { id: 'testimonials', label: 'Stories' },
    { id: 'about', label: 'About' },
    { id: 'faq', label: 'FAQ' },
    { id: 'contact', label: 'Contact' },
  ],
  hero: {
    /** Optional full URL (https or /path) or Supabase Storage URL — replaces default hero photo */
    backgroundImageUrl: '',
    /** CSS object-fit: cover | contain */
    backgroundObjectFit: 'cover',
    /** CSS object-position (e.g. center, top, 30% 20%) */
    backgroundObjectPosition: 'center',
    /** 0–100: opacity of the dark gradient overlay on the photo */
    backgroundOverlayOpacity: 100,
    /** 50–150: percentage; 100 = no extra filter */
    backgroundImageBrightness: 100,
    /** When set, overrides `backgroundObjectPosition` (CSS e.g. 20% 70%) */
    backgroundObjectPositionCustom: '',
    kicker: 'Private care · DOH accredited · Evidence-based',
    line1: 'Start your journey',
    line2: 'toward',
    rotateWords: ['Recovery', 'Hope', 'Sobriety', 'Renewal'],
    suffix: '& lasting healing.',
    sub:
      'Stop carrying it alone. Medically supervised care, therapy, and aftercare—personalized for you—in a discreet, judgment-free environment.',
    primaryCta: 'Begin confidential intake',
    secondaryCta: 'See how we help',
  },
  problem: {
    eyebrow: 'You are not alone',
    titleStart: 'When addiction takes hold, ',
    titleEmphasis: 'everything',
    titleMid: ' can feel heavier—',
    titleEnd: 'and harder to fix alone.',
    lead: 'Naming the struggle is the first step toward relief. These are some of the realities families tell us every day.',
    items: [
      {
        iconKey: 'brain',
        title: 'It hijacks your clarity',
        text: 'Cravings, shame, and secrecy make it hard to think clearly—or believe change is possible.',
      },
      {
        iconKey: 'frown',
        title: 'Life keeps sliding',
        text: 'Work, relationships, and health suffer while the cycle repeats, even when you want to stop.',
      },
      {
        iconKey: 'shield',
        title: 'Going it alone feels risky',
        text: 'Withdrawal and relapse are real fears without medical oversight and structured support.',
      },
      {
        iconKey: 'route',
        title: 'You are not sure where to turn',
        text: 'You want dignity, privacy, and evidence-based care—not judgment or a one-size-fits-all program.',
      },
    ],
  },
  services: {
    eyebrow: 'How we help',
    titleBefore: 'A full continuum of ',
    titleEm: 'care',
    titleAfter: '—built for real life',
    lead: 'From assessment and detox to therapy, aftercare, and family support—every layer works together so recovery can last.',
    slides: [
      {
        title: 'Comprehensive Health Exams',
        text:
          "A complete evaluation of your physical and mental health to understand your condition and guide a personalized path to recovery.",
        number: '01',
        imageUrl: '',
      },
      {
        title: 'Medically Supervised Detox',
        text:
          "A safe, medically guided detox process designed to manage withdrawal symptoms and support your body's natural healing.",
        number: '02',
        imageUrl: '',
      },
      {
        title: 'Counseling and Therapy',
        text:
          'Professional counseling and therapy services tailored to help you address emotional, psychological, and behavioral challenges.',
        number: '03',
        imageUrl: '',
      },
      {
        title: 'Personalized Treatment Plan',
        text:
          'A customized recovery plan built around your unique experiences, needs, and goals for lasting change.',
        number: '04',
        imageUrl: '',
      },
      {
        title: 'Lifetime Aftercare & Halfway Privileges',
        text:
          'Ongoing support and counseling even after your program, helping you maintain sobriety and stay connected for life.',
        number: '05',
        imageUrl: '',
      },
    ],
  },
  proof: {
    eyebrow: 'Proof & presence',
    titleBefore: 'Trusted by families—and ',
    titleEm: 'recognized',
    titleAfter: ' in the stories that matter.',
    lead: 'Accreditation, experience, and editorial coverage you can verify.',
    /** Second stat — replace DOH seal image */
    dohBadgeImageUrl: '',
    /**
     * Press logos (6). Order: GMA, TV5, WSJ, VICE, Rappler, Reaksyon.
     * articleUrl optional — empty uses built-in links.
     */
    pressOutlets: [
      { imageUrl: '', articleUrl: '' },
      { imageUrl: '', articleUrl: '' },
      { imageUrl: '', articleUrl: '' },
      { imageUrl: '', articleUrl: '' },
      { imageUrl: '', articleUrl: '' },
      { imageUrl: '', articleUrl: '' },
    ],
    stats: [
      { strong: '20+ yrs', text: 'Serving individuals & families with structured, compassionate care.' },
      { strong: 'DOH', text: 'Accredited facility with clinical oversight you can trust.' },
      { strong: 'Featured', text: 'Covered by leading outlets—see the reporting for yourself.' },
    ],
    partnersLabel: 'As seen in',
  },
  testimonials: {
    eyebrow: 'Stories',
    titleBefore: 'Hope & ',
    titleEm: 'recovery',
    lead: 'Real stories from people who found their path to sobriety.',
    stories: [
      {
        id: 'tony',
        initial: 'T',
        name: 'Tony S.',
        role: 'Recovery Graduate',
        text:
          "Bridges of Hope helped me recognize my destructive behaviors and patterns. I don't know where I would be if my family didn't make me go. Today, I'm happy to say I'm rebuilding my life and committed to lifetime sobriety.",
      },
      {
        id: 'james-m',
        initial: 'J',
        name: 'James M.',
        role: 'Alumni',
        text:
          "Being a recovering addict has its challenges, but it's reassuring to have Bridges of Hope as my continued support system. Now, I look forward to finishing my studies and building a career.",
      },
      {
        id: 'james-k',
        initial: 'J',
        name: 'James K.',
        role: 'Family Member',
        text:
          "In 2013 I thought, 'Enough!' and called Bridges of Hope to treat my husband's addiction. It was the best decision I've ever made. My husband is now 7 years sober and has turned his life around completely.",
      },
    ],
  },
  about: {
    /** Large image beside About copy */
    mainImageUrl: '',
    caption: 'DOH-accredited · Certified facility',
    eyebrow: 'About us',
    titleBefore: 'The ',
    titleEm1: 'largest',
    titleBetween: ' and most ',
    titleEm2: 'trusted',
    titleAfter: ' addiction treatment center',
    body:
      'Bridges of Hope provides professional, private, and compassionate treatment for people struggling with addiction—through world-class facilities and a dedicated clinical team that truly cares.',
    stats: [
      { strong: '2,000+', label: 'Patients treated' },
      { strong: '15+', label: 'Years experience' },
      { strong: '95%', label: 'Completion rate' },
    ],
    valuesEyebrow: 'Our core values',
    valuesHeadPrefix: 'A Foundation Built on',
    valuesHeadGradient: 'Complete Healing',
    valuesLead:
      'We combine expert clinical methods with a deeply personal approach to ensure you and your family feel supported at every step.',
    values: [
      {
        title: 'Compassionate Care',
        desc: 'Every patient is treated with dignity and empathy throughout their journey.',
        imageUrl: '',
        alt: 'Therapist and patient in a supportive counseling session',
      },
      {
        title: 'Clinically Proven',
        desc: 'Evidence-based methods designed by leading addiction specialists.',
        imageUrl: '',
        alt: 'Clinical team conducting a professional health evaluation',
      },
      {
        title: 'Family-Centered',
        desc: 'We involve families to build lasting support systems for recovery.',
        imageUrl: '',
        alt: 'Welcoming recovery environment supporting families and community',
      },
      {
        title: 'Private & Confidential',
        desc: 'Discreet programs and protected information so you can focus on healing.',
        imageUrl: '',
        alt: 'Calm, private treatment setting with medical oversight',
      },
    ],
  },
  faq: {
    eyebrow: 'Questions',
    titleBefore: 'Straight answers, ',
    titleEm: 'no jargon',
    lead: 'A few things people ask before they reach out—clear, honest, and designed to reduce anxiety.',
    items: [
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
    ],
  },
  cta: {
    eyebrow: 'Your next chapter',
    titleLine1: 'Book a confidential conversation—',
    titleLine2: 'today.',
    lead:
      'Recovery is possible with the right team beside you. One message or call can change the trajectory of your life.',
    button: 'Start confidential intake',
    phoneMockupImageUrl: '',
  },
  footer: {
    brandTagline: 'Transforming lives through compassionate, evidence-based addiction treatment since 2003.',
    exploreTitle: 'Explore',
    contactTitle: 'Contact',
    legalTitle: 'Legal',
    phone: '(555) 123-4567',
    phoneTel: '5551234567',
    email: 'info@hoperecovery.com',
    addressLine1: '123 Recovery Way',
    addressLine2: 'Cavite, Philippines',
    copyrightOrg: 'Bridges of Hope',
    brandSubtitle: 'Hope Recovery',
  },
  /** Blocks rendered on the public site (after About). */
  customSections: [],

  /**
   * Order of major landing sections (Wix-like reorder). IDs must match `LandingPageBodySections` switch.
   */
  sectionOrder: ['hero', 'problem', 'services', 'proof', 'testimonials', 'about', 'custom', 'faq', 'cta', 'footer'],
};

/** Canonical list — one of each id in `sectionOrder`. */
export const LANDING_PAGE_SECTION_IDS = [
  'hero',
  'problem',
  'services',
  'proof',
  'testimonials',
  'about',
  'custom',
  'faq',
  'cta',
  'footer',
];

export const LANDING_SECTION_LABELS = {
  hero: 'Hero',
  problem: 'Challenge',
  services: 'Services / programs',
  proof: 'Proof & press',
  testimonials: 'Testimonials',
  about: 'About',
  custom: 'Page elements',
  faq: 'FAQ',
  cta: 'Call-to-action banner',
  footer: 'Footer (contact & legal)',
};

/** Merge saved order with defaults; drop unknown ids; append any missing sections. */
export function normalizeSectionOrder(order) {
  const allowed = [...LANDING_PAGE_SECTION_IDS];
  const allowedSet = new Set(allowed);
  const seen = new Set();
  const out = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (allowedSet.has(id) && !seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
  }
  for (const id of allowed) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/** @returns {typeof DEFAULT_SITE_CONTENT} */
export function loadSiteContent() {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) return mergeSiteContent({});
    const o = JSON.parse(raw);
    return mergeSiteContent(typeof o === 'object' && o ? o : {});
  } catch {
    return mergeSiteContent({});
  }
}

/** Persists the full merged site content (from the admin editor). */
export function saveMergedSiteContent(merged) {
  const next = mergeSiteContent(merged);
  try {
    localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[siteContent] save failed', e);
    throw e;
  }
  window.dispatchEvent(new CustomEvent(SITE_CONTENT_EVENT));
}

export function resetSiteContent() {
  try {
    localStorage.removeItem(SITE_CONTENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SITE_CONTENT_EVENT));
}

export function mergeSiteContent(overrides) {
  return deepMerge(DEFAULT_SITE_CONTENT, overrides || {});
}

/**
 * @param {unknown} raw — from CMS `branding.*LogoHeightPx` (0 = use CSS default)
 * @param {number} [maxPx=240]
 * @returns {number | null} clamped px for inline height, or null to omit and use CSS
 */
export function parseBrandingLogoHeightPx(raw, maxPx = 240) {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(maxPx, Math.max(12, Math.round(n)));
}

/** Problem section icons — keys match `problem.items[].iconKey` */
export const PROBLEM_ICON_KEYS = ['brain', 'frown', 'shield', 'route'];
