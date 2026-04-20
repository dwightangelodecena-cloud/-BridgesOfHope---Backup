import React, { Fragment } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Star,
  Award,
  Newspaper,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

import heroImg from '@/assets/landingpage.png';
import containerImg from '@/assets/Container.png';
import iphoneMockup from '@/assets/iphone.png';
import dohBadge from '@/assets/doh.png';
import hopeLogo from '@/assets/hoperecoverylogo.png';

import { ScrollReveal } from '@/components/landing/ScrollReveal';
import DynamicLandingSections from '@/components/DynamicLandingSections';
import CmsSectionEditChip from '@/components/landing/CmsSectionEditChip';
import { parseBrandingLogoHeightPx } from '@/lib/siteContentStore';

/**
 * Renders main landing sections in CMS-controlled order.
 */
export function LandingPageBodySections({
  order,
  m,
  cmsEditMode = false,
  heroWords,
  heroWordIndex,
  problemItems,
  programSlides,
  testimonialStories,
  faqItems,
  valueCards,
  navigate,
  onNavSectionClick,
  scrollToSection,
  openFaqIndex,
  toggleFaq,
  /** @type {{ name: string, src: string, href: string }[]} */
  pressOutletRows,
}) {
  const footerLogoMainStyle = (() => {
    const h = parseBrandingLogoHeightPx(m.branding?.footerLogoHeightPx);
    return h ? { height: h, width: 'auto' } : undefined;
  })();
  const footerLogoStripStyle = (() => {
    const h = parseBrandingLogoHeightPx(m.branding?.footerLogoStripHeightPx, 120);
    return { height: h ?? 20, opacity: 0.45 };
  })();

  return order.map((sectionId) => {
    switch (sectionId) {
      case 'hero': {
        const heroFit = m.hero?.backgroundObjectFit === 'contain' ? 'contain' : 'cover';
        const heroPos =
          typeof m.hero?.backgroundObjectPositionCustom === 'string' && m.hero.backgroundObjectPositionCustom.trim()
            ? m.hero.backgroundObjectPositionCustom.trim()
            : typeof m.hero?.backgroundObjectPosition === 'string' && m.hero.backgroundObjectPosition.trim()
              ? m.hero.backgroundObjectPosition.trim()
              : 'center';
        let heroOverlayPct = m.hero?.backgroundOverlayOpacity;
        if (typeof heroOverlayPct !== 'number' || Number.isNaN(heroOverlayPct)) heroOverlayPct = 100;
        heroOverlayPct = Math.min(100, Math.max(0, heroOverlayPct));
        let heroBright = m.hero?.backgroundImageBrightness;
        if (typeof heroBright !== 'number' || Number.isNaN(heroBright)) heroBright = 100;
        heroBright = Math.min(150, Math.max(50, heroBright));
        const heroImgStyle = {
          objectFit: heroFit,
          objectPosition: heroPos,
          filter: heroBright !== 100 ? `brightness(${heroBright}%)` : undefined,
        };
        return (
          <Fragment key={sectionId}>
            <section className="hero-section full-bleed snap-page" id="hero" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="hero" label="Hero" />
              <motion.img
                src={
                  typeof m.hero?.backgroundImageUrl === 'string' && m.hero.backgroundImageUrl.trim()
                    ? m.hero.backgroundImageUrl.trim()
                    : heroImg
                }
                className="hero-bg-img"
                alt=""
                aria-hidden
                style={heroImgStyle}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              />
              <div className="hero-overlay" aria-hidden style={{ opacity: heroOverlayPct / 100 }} />
              <motion.div
                className="hero-inner"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } }, hidden: {} }}
              >
                <div className="hero-grid">
                  <div className="hero-content">
                    <motion.div className="hero-kicker" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
                      <span aria-hidden />
                      {m.hero.kicker}
                    </motion.div>
                    <motion.h1
                      className="hero-headline"
                      variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } } }}
                    >
                      <span className="static">{m.hero.line1}</span>
                      <span className="static">{m.hero.line2}</span>
                      <span className="hero-rotate-track" aria-live="polite">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={heroWords[heroWordIndex % heroWords.length]}
                            className="hero-rotate-word"
                            initial={{ opacity: 0, y: 32 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -24 }}
                            transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                          >
                            {heroWords[heroWordIndex % heroWords.length]}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span className="hero-suffix">{m.hero.suffix}</span>
                    </motion.h1>

                    <motion.p
                      className="hero-sub"
                      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}
                    >
                      {m.hero.sub}
                    </motion.p>

                    <motion.div
                      className="hero-actions"
                      variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}
                    >
                      <motion.button type="button" className="btn-hero-primary" onClick={() => navigate('/login')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {m.hero.primaryCta} <ArrowRight size={17} strokeWidth={2.5} />
                      </motion.button>
                      <motion.button type="button" className="btn-hero-ghost" onClick={(e) => onNavSectionClick(e, 'services')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {m.hero.secondaryCta}
                      </motion.button>
                    </motion.div>
                  </div>
                  <div className="hero-aside" aria-hidden>
                    <div className="hero-orbs" />
                  </div>
                </div>
              </motion.div>
            </section>
          </Fragment>
        );
      }

      case 'problem':
        return (
          <Fragment key={sectionId}>
            <section id="problem" className="problem-section full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="problem" label="Challenge" />
              <div className="container">
                <ScrollReveal className="problem-header">
                  <span className="eyebrow">{m.problem.eyebrow}</span>
                  <h2>
                    {m.problem.titleStart}
                    <em className="text-accent">{m.problem.titleEmphasis}</em>
                    {m.problem.titleMid}
                    <span className="serif" style={{ fontStyle: 'italic', fontWeight: 500 }}>
                      {m.problem.titleEnd}
                    </span>
                  </h2>
                  <p className="section-lead">{m.problem.lead}</p>
                </ScrollReveal>
                <div className="problem-grid">
                  {problemItems.map(({ icon: Icon, title, text }, i) => (
                    <ScrollReveal key={title} delay={0.06 * i} y={28}>
                      <div className="problem-card">
                        <div className="problem-icon" aria-hidden>
                          <Icon size={22} strokeWidth={1.85} />
                        </div>
                        <div className="problem-card-copy">
                          <h3>{title}</h3>
                          <p>{text}</p>
                        </div>
                        <span className="problem-card-index" aria-hidden>
                          0{i + 1}
                        </span>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </section>
          </Fragment>
        );

      case 'services':
        return (
          <Fragment key={sectionId}>
            <section id="services" className="programs-section full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="services" label="Services" />
              <div className="container">
                <ScrollReveal className="programs-header">
                  <span className="eyebrow">{m.services.eyebrow}</span>
                  <h2 className="section-title">
                    {m.services.titleBefore}
                    <em className="text-accent">{m.services.titleEm}</em>
                    {m.services.titleAfter}
                  </h2>
                  <p className="section-lead">{m.services.lead}</p>
                </ScrollReveal>

                <ScrollReveal y={18} delay={0.06}>
                  <div id="programs-swiper-shell" className="programs-swiper-shell programs-swiper-outer">
                    <button type="button" className="prog-swiper-nav prog-swiper-nav--prev" aria-label="Previous program">
                      <ChevronLeft size={22} strokeWidth={2.35} aria-hidden />
                    </button>
                    <Swiper
                      modules={[Pagination, Autoplay, Navigation]}
                      className="programs-swiper"
                      slidesPerView={1}
                      spaceBetween={0}
                      loop
                      loopAdditionalSlides={2}
                      speed={580}
                      grabCursor
                      autoplay={{ delay: 4200, disableOnInteraction: false, pauseOnMouseEnter: true }}
                      navigation={{
                        prevEl: '#programs-swiper-shell .prog-swiper-nav--prev',
                        nextEl: '#programs-swiper-shell .prog-swiper-nav--next',
                      }}
                      pagination={{ clickable: true, dynamicBullets: false }}
                    >
                      {programSlides.map((prog) => (
                        <SwiperSlide key={prog.number}>
                          <div className="prog-card">
                            <div className="prog-card-img">
                              <img src={prog.img} alt={prog.title} />
                            </div>
                            <div className="prog-card-body">
                              <span className="prog-number" aria-hidden>
                                {prog.number}
                              </span>
                              <span className="prog-tag">Program {prog.number}</span>
                              <h3>{prog.title}</h3>
                              <p className="prog-card-desc">{prog.text}</p>
                            </div>
                          </div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                    <button type="button" className="prog-swiper-nav prog-swiper-nav--next" aria-label="Next program">
                      <ChevronRight size={22} strokeWidth={2.35} aria-hidden />
                    </button>
                  </div>
                </ScrollReveal>
              </div>
            </section>
          </Fragment>
        );

      case 'proof':
        return (
          <Fragment key={sectionId}>
            <section id="proof" className="proof-section full-bleed snap-page" aria-label="Credibility and press coverage" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="proof" label="Proof" />
              <div className="container">
                <ScrollReveal className="proof-header">
                  <span className="eyebrow">{m.proof.eyebrow}</span>
                  <h2 className="section-title">
                    {m.proof.titleBefore}
                    <em className="text-accent">{m.proof.titleEm}</em>
                    {m.proof.titleAfter}
                  </h2>
                  <p className="section-lead">{m.proof.lead}</p>
                </ScrollReveal>
                <div className="proof-stats">
                  <ScrollReveal delay={0.05} y={20}>
                    <div className="proof-stat">
                      <div className="proof-stat-icon" aria-hidden>
                        <Award size={22} strokeWidth={1.75} />
                      </div>
                      <strong>{m.proof.stats[0]?.strong}</strong>
                      <span>{m.proof.stats[0]?.text}</span>
                    </div>
                  </ScrollReveal>
                  <ScrollReveal delay={0.1} y={20}>
                    <div className="proof-stat">
                      <div className="proof-stat-icon proof-stat-icon--photo" aria-hidden>
                        <img
                          src={
                            typeof m.proof?.dohBadgeImageUrl === 'string' && m.proof.dohBadgeImageUrl.trim()
                              ? m.proof.dohBadgeImageUrl.trim()
                              : dohBadge
                          }
                          alt=""
                        />
                      </div>
                      <strong>{m.proof.stats[1]?.strong}</strong>
                      <span>{m.proof.stats[1]?.text}</span>
                    </div>
                  </ScrollReveal>
                  <ScrollReveal delay={0.15} y={20}>
                    <div className="proof-stat">
                      <div className="proof-stat-icon" aria-hidden>
                        <Newspaper size={22} strokeWidth={1.75} />
                      </div>
                      <strong>{m.proof.stats[2]?.strong}</strong>
                      <span>{m.proof.stats[2]?.text}</span>
                    </div>
                  </ScrollReveal>
                </div>
              </div>
              <motion.div
                className="partners-inner"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="partners-label">{m.proof.partnersLabel}</p>
                <motion.div
                  className="partners-row"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } } }}
                >
                  {(pressOutletRows || []).map(({ src, name, href }) => (
                    <motion.a
                      key={name}
                      className="partners-link"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${name}: read press coverage (opens in new tab)`}
                      variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } } }}
                    >
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    </motion.a>
                  ))}
                </motion.div>
              </motion.div>
            </section>
          </Fragment>
        );

      case 'testimonials':
        return (
          <Fragment key={sectionId}>
            <section id="testimonials" className="testimonials-section full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="testimonials" label="Stories" />
              <div className="container">
                <ScrollReveal className="testi-header">
                  <span className="eyebrow">{m.testimonials.eyebrow}</span>
                  <h2 className="section-title">
                    {m.testimonials.titleBefore}
                    <em className="text-accent">{m.testimonials.titleEm}</em>
                  </h2>
                  <p className="section-lead">{m.testimonials.lead}</p>
                </ScrollReveal>

                <div className="testi-grid">
                  {testimonialStories.map((story, i) => (
                    <ScrollReveal key={story.id} delay={0.08 + i * 0.12} y={36}>
                      <article className="testi-card">
                        <div className="testi-stars-row">
                          <div className="testi-stars" role="img" aria-label="5 out of 5 stars">
                            {[...Array(5)].map((_, j) => (
                              <Star key={j} size={15} strokeWidth={0} aria-hidden />
                            ))}
                          </div>
                        </div>
                        <blockquote className="testi-quote" cite="Bridges of Hope">
                          {story.text}
                        </blockquote>
                        <footer className="testi-footer">
                          <div className="testi-avatar" aria-hidden>
                            {story.initial}
                          </div>
                          <div>
                            <div className="testi-name">{story.name}</div>
                            <div className="testi-role">{story.role}</div>
                          </div>
                        </footer>
                      </article>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </section>
          </Fragment>
        );

      case 'about':
        return (
          <Fragment key={sectionId}>
            <section id="about" className="about-section full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="about" label="About" />
              <div className="container">
                <div className="about-grid">
                  <ScrollReveal className="about-visual-wrap" y={24}>
                    <div className="about-img-frame">
                      <img
                        src={
                          typeof m.about?.mainImageUrl === 'string' && m.about.mainImageUrl.trim()
                            ? m.about.mainImageUrl.trim()
                            : containerImg
                        }
                        alt="Bridges of Hope facility"
                      />
                    </div>
                    <p className="about-photo-caption">{m.about.caption}</p>
                  </ScrollReveal>

                  <ScrollReveal className="about-copy" delay={0.14} y={30}>
                    <span className="eyebrow">{m.about.eyebrow}</span>
                    <h2>
                      {m.about.titleBefore}
                      <em className="text-accent">{m.about.titleEm1}</em>
                      {m.about.titleBetween}
                      <em className="text-accent">{m.about.titleEm2}</em>
                      {m.about.titleAfter}
                    </h2>
                    <p className="about-body">{m.about.body}</p>
                    <div className="about-stats">
                      <div className="about-stat">
                        <strong>{m.about.stats[0]?.strong}</strong>
                        <span>{m.about.stats[0]?.label}</span>
                      </div>
                      <div className="about-stat">
                        <strong>{m.about.stats[1]?.strong}</strong>
                        <span>{m.about.stats[1]?.label}</span>
                      </div>
                      <div className="about-stat">
                        <strong>{m.about.stats[2]?.strong}</strong>
                        <span>{m.about.stats[2]?.label}</span>
                      </div>
                    </div>
                  </ScrollReveal>
                </div>

                <ScrollReveal className="about-values-row" y={28} delay={0.08}>
                  <div className="about-values-inner">
                    <div className="values-intro-wrap">
                      <header className="values-section-header">
                        <span className="eyebrow values-eyebrow">{m.about.valuesEyebrow}</span>
                        <h3 className="values-section-title">
                          <span className="values-head-prefix">{m.about.valuesHeadPrefix}</span>
                          <span className="values-title-gradient">{m.about.valuesHeadGradient}</span>
                        </h3>
                        <p className="values-section-lead">{m.about.valuesLead}</p>
                      </header>
                    </div>
                    <div className="values-photo-grid" role="list">
                      {valueCards.map(({ title, desc, img, alt }) => (
                        <article className="value-photo-card" key={title} role="listitem" tabIndex={0}>
                          <div className="value-photo-media">
                            <img src={img} alt={alt} loading="lazy" decoding="async" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                          </div>
                          <div className="value-photo-scrim" aria-hidden />
                          <div className="value-photo-copy">
                            <div className="value-photo-copy-inner">
                              <h4 className="value-photo-title">{title}</h4>
                              <p className="value-photo-desc">{desc}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </section>
          </Fragment>
        );

      case 'custom':
        return (
          <div key={sectionId} style={cmsEditMode ? { position: 'relative' } : undefined}>
            <CmsSectionEditChip sectionId="custom" label="Page elements" />
            <DynamicLandingSections sections={m.customSections} />
          </div>
        );

      case 'faq':
        return (
          <Fragment key={sectionId}>
            <section id="faq" className="faq-section full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="faq" label="FAQ" />
              <div className="container">
                <div className="faq-orbit">
                  <ScrollReveal className="faq-header">
                    <span className="eyebrow">{m.faq.eyebrow}</span>
                    <h2 className="section-title">
                      {m.faq.titleBefore}
                      <em className="text-accent">{m.faq.titleEm}</em>
                    </h2>
                    <p className="section-lead">{m.faq.lead}</p>
                  </ScrollReveal>
                  <div className="faq-list" role="list">
                    {faqItems.map((item, i) => (
                      <div key={`faq-${i}`} className={`faq-item${openFaqIndex === i ? ' is-open' : ''}`} role="listitem">
                        <button
                          type="button"
                          className="faq-trigger"
                          aria-expanded={openFaqIndex === i}
                          aria-controls={`faq-panel-${i}`}
                          id={`faq-trigger-${i}`}
                          onClick={() => toggleFaq(i)}
                        >
                          <span>{item.q}</span>
                          <ChevronDown className="faq-chevron" size={20} strokeWidth={2} aria-hidden />
                        </button>
                        <div className="faq-panel" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`}>
                          <div className="faq-panel-inner">
                            <p>{item.a}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </Fragment>
        );

      case 'cta':
        return (
          <Fragment key={sectionId}>
            <motion.section
              id="cta-final"
              className="footer-cta-section full-bleed snap-page"
              style={cmsEditMode ? { position: 'relative' } : undefined}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <CmsSectionEditChip sectionId="cta" label="CTA" />
              <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                <ScrollReveal>
                  <div className="footer-cta-layout">
                    <div className="footer-cta-copy">
                      <div className="footer-cta-eyebrow">
                        <span className="eyebrow">{m.cta.eyebrow}</span>
                      </div>
                      <h2>
                        {m.cta.titleLine1}
                        <br />
                        <em className="text-accent">{m.cta.titleLine2}</em>
                      </h2>
                      <p className="lead">{m.cta.lead}</p>
                      <motion.div style={{ marginTop: '1.35rem' }} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }}>
                        <motion.button type="button" className="btn-primary btn-accent" onClick={() => navigate('/login')} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                          {m.cta.button} <ArrowRight size={17} />
                        </motion.button>
                      </motion.div>
                    </div>
                    <div className="cta-contact-grid">
                      <motion.div
                        className="cta-phone-mockup-wrap"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <img
                          src={
                            typeof m.cta?.phoneMockupImageUrl === 'string' && m.cta.phoneMockupImageUrl.trim()
                              ? m.cta.phoneMockupImageUrl.trim()
                              : iphoneMockup
                          }
                          alt="Bridges of Hope iPhone app mockup"
                          className="cta-phone-mockup"
                        />
                      </motion.div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </motion.section>
          </Fragment>
        );

      case 'footer':
        return (
          <Fragment key={sectionId}>
            <footer id="contact" className="footer-info full-bleed snap-page" style={cmsEditMode ? { position: 'relative' } : undefined}>
              <CmsSectionEditChip sectionId="footer" label="Footer" />
              <div className="footer-accent-bar" aria-hidden />
              <div className="container footer-info-main">
                <ScrollReveal y={24}>
                  <div className="footer-grid">
                    <div className="footer-brand">
                      <img
                        src={
                          typeof m.branding?.footerLogoUrl === 'string' && m.branding.footerLogoUrl.trim()
                            ? m.branding.footerLogoUrl.trim()
                            : hopeLogo
                        }
                        alt="Hope Recovery logo"
                        style={footerLogoMainStyle}
                      />
                      <p>{m.footer.brandTagline}</p>
                    </div>
                    <div>
                      <h4 className="footer-col-head">{m.footer.exploreTitle}</h4>
                      <a href="#problem" className="footer-legal-link" onClick={(e) => { e.preventDefault(); scrollToSection('problem'); }}>
                        {m.navItems.find((x) => x.id === 'problem')?.label ?? 'Challenge'}
                      </a>
                      <a href="#services" className="footer-legal-link" onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}>
                        {m.navItems.find((x) => x.id === 'services')?.label ?? 'Services'}
                      </a>
                      <a href="#proof" className="footer-legal-link" onClick={(e) => { e.preventDefault(); scrollToSection('proof'); }}>
                        {m.navItems.find((x) => x.id === 'proof')?.label ?? 'Proof'}
                      </a>
                      <a href="#testimonials" className="footer-legal-link" onClick={(e) => { e.preventDefault(); scrollToSection('testimonials'); }}>
                        {m.navItems.find((x) => x.id === 'testimonials')?.label ?? 'Stories'}
                      </a>
                      <a href="#faq" className="footer-legal-link" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>
                        {m.navItems.find((x) => x.id === 'faq')?.label ?? 'FAQ'}
                      </a>
                    </div>
                    <div>
                      <h4 className="footer-col-head">{m.footer.contactTitle}</h4>
                      <div className="footer-contact-item">
                        <Phone size={16} />
                        <a href={`tel:${m.footer.phoneTel}`}>{m.footer.phone}</a>
                      </div>
                      <div className="footer-contact-item">
                        <Mail size={16} />
                        <a href={`mailto:${m.footer.email}`}>{m.footer.email}</a>
                      </div>
                      <div className="footer-contact-item" style={{ alignItems: 'flex-start' }}>
                        <MapPin size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>
                          {m.footer.addressLine1}
                          <br />
                          {m.footer.addressLine2}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="footer-col-head">{m.footer.legalTitle}</h4>
                      <a href="#" className="footer-legal-link">
                        Terms of Service
                      </a>
                      <a href="#" className="footer-legal-link">
                        Privacy Policy
                      </a>
                      <a href="#" className="footer-legal-link">
                        Cookie Policy
                      </a>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
              <div className="footer-bottom-strip full-bleed">
                <div className="container">
                  <div className="footer-bottom">
                    <span className="footer-copy">
                      © {new Date().getFullYear()} {m.footer.copyrightOrg}. All rights reserved.
                    </span>
                    <div className="footer-brand-name">
                      <img
                        src={
                          typeof m.branding?.footerLogoUrl === 'string' && m.branding.footerLogoUrl.trim()
                            ? m.branding.footerLogoUrl.trim()
                            : hopeLogo
                        }
                        alt=""
                        style={footerLogoStripStyle}
                      />
                      <span>{m.footer.brandSubtitle}</span>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </Fragment>
        );

      default:
        return null;
    }
  });
}
