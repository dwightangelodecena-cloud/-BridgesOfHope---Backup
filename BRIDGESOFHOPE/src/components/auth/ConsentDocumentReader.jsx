import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SCROLL_END_THRESHOLD_PX = 48;

function sectionDomId(section, index) {
  return section.id || `consent-section-${index}`;
}

function parseSectionNumber(title) {
  const match = String(title || '').match(/^(\d+)\./);
  return match ? match[1] : null;
}

function parseSectionLabel(title) {
  return String(title || '').replace(/^\d+\.\s*/, '');
}

const ConsentDocumentReader = forwardRef(function ConsentDocumentReader(
  {
    document,
    onScrollComplete,
    onProgressChange,
    onActiveSectionChange,
    onSectionsCompletedChange,
    scrollProgress,
    activeSectionId,
  },
  ref
) {
  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sections = document?.sections || [];

  const updateSectionState = useCallback(
    (el) => {
      if (!el || !sections.length) return;

      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = Math.max(scrollHeight - clientHeight, 1);
      const progress = Math.min(100, Math.round((scrollTop / maxScroll) * 100));
      const atEnd = scrollTop + clientHeight >= scrollHeight - SCROLL_END_THRESHOLD_PX;
      const shortDoc = scrollHeight <= clientHeight + SCROLL_END_THRESHOLD_PX;

      let activeId = sectionDomId(sections[0], 0);
      const completedIds = new Set();

      sections.forEach((section, index) => {
        const id = sectionDomId(section, index);
        const node = sectionRefs.current[id];
        if (!node) return;

        const top = node.offsetTop;
        const bottom = top + node.offsetHeight;
        const viewLine = scrollTop + Math.min(clientHeight * 0.35, 140);

        if (top <= viewLine) {
          activeId = id;
        }
        if (bottom <= scrollTop + 96) {
          completedIds.add(id);
        }
      });

      if (atEnd || shortDoc) {
        sections.forEach((section, index) => {
          completedIds.add(sectionDomId(section, index));
        });
      }

      setShowBackToTop(scrollTop > 240);
      onProgressChange?.(progress);
      onActiveSectionChange?.(activeId);
      onSectionsCompletedChange?.(completedIds.size);

      if (atEnd || shortDoc) {
        if (!scrolledToEnd) {
          setScrolledToEnd(true);
          onScrollComplete?.(true);
        }
      }
    },
    [onProgressChange, onScrollComplete, onActiveSectionChange, onSectionsCompletedChange, scrolledToEnd, sections]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const raf = requestAnimationFrame(() => updateSectionState(el));
    return () => cancelAnimationFrame(raf);
  }, [document, updateSectionState]);

  const scrollToSection = useCallback((id) => {
    const target = sectionRefs.current[id];
    const container = scrollRef.current;
    if (!target || !container) return;
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 20), behavior: 'smooth' });
  }, []);

  useImperativeHandle(ref, () => ({ scrollToSection }), [scrollToSection]);

  const handleScroll = (e) => {
    updateSectionState(e.currentTarget);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!document) return null;

  const progress = scrollProgress ?? 0;

  return (
    <div className="consent-reader">
      <div className="consent-reader__progress-sticky">
        <div className="consent-reader__progress-meta">
          <span>Informed Consent Form</span>
          <span className="consent-reader__progress-pct">{progress}%</span>
        </div>
        <div
          className="consent-reader__progress-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div
            className="consent-reader__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        className="consent-reader__scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Informed consent document"
      >
        <header className="consent-reader__doc-header consent-fade-in">
          <h2>{document.title}</h2>
          <p>{document.subtitle}</p>
        </header>

        {sections.map((section, index) => {
          const id = sectionDomId(section, index);
          const num = parseSectionNumber(section.title);
          const label = parseSectionLabel(section.title);
          const isActive = activeSectionId === id;

          return (
            <section
              key={id}
              id={id}
              ref={(node) => {
                sectionRefs.current[id] = node;
              }}
              className={[
                'consent-reader__section',
                'consent-fade-in',
                section.highlight ? 'is-highlight' : '',
                isActive ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
            >
              <div className="consent-reader__section-head">
                {num ? <span className="consent-reader__section-num" aria-hidden>{num}</span> : null}
                <h3>{label}</h3>
              </div>
              <p>{section.body}</p>
            </section>
          );
        })}

        {document.footer ? (
          <p className="consent-reader__footer-note consent-fade-in">{document.footer}</p>
        ) : null}

        {!scrolledToEnd ? (
          <p className="consent-reader__hint consent-fade-in">
            Scroll to the bottom to enable agreement.
          </p>
        ) : (
          <p className="consent-reader__done consent-fade-in">
            You have reached the end of the document.
          </p>
        )}
      </div>

      {showBackToTop ? (
        <button
          type="button"
          className="consent-reader__top"
          onClick={scrollToTop}
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      ) : null}
    </div>
  );
});

export default ConsentDocumentReader;
