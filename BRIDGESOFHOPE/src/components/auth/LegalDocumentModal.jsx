import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const SCROLL_END_THRESHOLD_PX = 32;

export default function LegalDocumentModal({
  open,
  document,
  onClose,
  onConfirmRead,
  confirmLabel,
}) {
  const scrollRef = useRef(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  useEffect(() => {
    if (open) setScrolledToEnd(false);
  }, [open, document?.title]);

  const checkScrollEnd = useCallback((el) => {
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_THRESHOLD_PX;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  const handleScroll = (e) => {
    checkScrollEnd(e.currentTarget);
  };

  const handleContentRef = (el) => {
    scrollRef.current = el;
    if (el && el.scrollHeight <= el.clientHeight + SCROLL_END_THRESHOLD_PX) {
      setScrolledToEnd(true);
    }
  };

  if (!open || !document) return null;

  const handleClose = () => {
    setScrolledToEnd(false);
    onClose();
  };

  const handleConfirm = () => {
    if (!scrolledToEnd) return;
    onConfirmRead();
    setScrolledToEnd(false);
    onClose();
  };

  return (
    <div className="legal-modal-overlay" onClick={handleClose} role="presentation">
      <div className="legal-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="legal-modal-close" onClick={handleClose} aria-label="Close">
          <X size={28} />
        </button>
        <div className="legal-modal-header">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
        <div className="legal-modal-body" ref={handleContentRef} onScroll={handleScroll}>
          {document.sections.map((section) => (
            <div key={section.title} className="legal-modal-section">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
          {document.footer ? (
            <p className="legal-modal-footer-text">{document.footer}</p>
          ) : null}
          {!scrolledToEnd ? (
            <p className="legal-modal-scroll-hint">Scroll to the bottom to continue.</p>
          ) : null}
        </div>
        <div className="legal-modal-actions">
          <button
            type="button"
            className="legal-modal-confirm"
            disabled={!scrolledToEnd}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
