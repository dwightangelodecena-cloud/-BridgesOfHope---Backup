import React, { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Layers } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import ConsentDocumentReader from '@/components/auth/ConsentDocumentReader';
import {
  estimateConsentReadingMinutes,
  INFORMED_CONSENT,
  SIGNUP_CONSENT_STORAGE_KEY,
} from '@/lib/legalDocuments';

function sectionDomId(section, index) {
  return section.id || `consent-section-${index}`;
}

function sectionNavLabel(title) {
  return String(title || '').replace(/^\d+\.\s*/, '');
}

const NAV_SECTIONS = INFORMED_CONSENT.sections.map((section, index) => ({
  sectionId: sectionDomId(section, index),
  label: sectionNavLabel(section.title),
  highlight: Boolean(section.highlight),
}));

function ConsentActions({
  agreed,
  hasReadConsent,
  error,
  onAgreeChange,
  onContinue,
  className = '',
  compact = false,
}) {
  return (
    <div className={`consent-actions ${compact ? 'consent-actions--compact' : ''} ${className}`.trim()}>
      {hasReadConsent ? (
        <div className="consent-actions__success" role="status">
          <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden />
          <span>You have reached the end of the document.</span>
        </div>
      ) : (
        <p className="consent-actions__waiting">
          Read through all sections to enable agreement.
        </p>
      )}

      <label className={`consent-check${!hasReadConsent ? ' consent-check--disabled' : ''}`}>
        <input
          type="checkbox"
          checked={agreed}
          disabled={!hasReadConsent}
          onChange={(e) => onAgreeChange(e.target.checked)}
        />
        <span>
          I have read and agree to the Informed Consent Form.
          {!hasReadConsent ? (
            <span className="consent-check__hint">
              Available after you reach the end of the document.
            </span>
          ) : null}
        </span>
      </label>

      {error ? <div className="consent-error">{error}</div> : null}

      <button
        type="button"
        className="consent-btn"
        disabled={!hasReadConsent || !agreed}
        onClick={onContinue}
      >
        Agree and Continue
      </button>

      {!compact ? (
        <p className="consent-login">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      ) : null}
    </div>
  );
}

const SignupConsent = () => {
  const navigate = useNavigate();
  const readerRef = useRef(null);
  const [hasReadConsent, setHasReadConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState(NAV_SECTIONS[0]?.sectionId || '');
  const [sectionsCompleted, setSectionsCompleted] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const readingMinutes = estimateConsentReadingMinutes(INFORMED_CONSENT);
  const totalSections = INFORMED_CONSENT.sections.length;

  const handleAgreeChange = (checked) => {
    setAgreed(checked);
    if (error) setError('');
  };

  const handleContinue = () => {
    if (!hasReadConsent) {
      setError('Please scroll through the entire consent document before agreeing.');
      return;
    }
    if (!agreed) {
      setError('Please check the box to confirm you have read and agree to the consent form.');
      return;
    }
    setError('');
    setShowSuccess(true);
    sessionStorage.setItem(SIGNUP_CONSENT_STORAGE_KEY, new Date().toISOString());
    window.setTimeout(() => navigate('/signup'), 1400);
  };

  const scrollToTopic = (sectionId) => {
    readerRef.current?.scrollToSection(sectionId);
  };

  return (
    <div className="consent-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

        .consent-page {
          --brand-navy: #1B2559;
          --brand-orange: #F54E25;
          --brand-orange-soft: rgba(245, 78, 37, 0.12);
          --surface: #ffffff;
          --muted: #64748b;
          --radius-lg: 24px;
          --radius-md: 16px;
          --shadow-soft: 0 20px 50px rgba(27, 37, 89, 0.08);
          --shadow-card: 0 4px 20px rgba(27, 37, 89, 0.06);

          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(245, 78, 37, 0.06), transparent 55%),
            radial-gradient(ellipse 60% 40% at 95% 100%, rgba(27, 37, 89, 0.05), transparent 50%),
            #F6F8FB;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
          padding: 28px 24px 36px;
          box-sizing: border-box;
          position: relative;
          overflow-x: hidden;
        }

        .consent-page__shape {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        .consent-page__shape--1 {
          width: 420px;
          height: 420px;
          top: -120px;
          right: -80px;
          background: radial-gradient(circle, rgba(245, 78, 37, 0.07) 0%, transparent 70%);
        }

        .consent-page__shape--2 {
          width: 320px;
          height: 320px;
          bottom: 8%;
          left: -100px;
          background: radial-gradient(circle, rgba(27, 37, 89, 0.06) 0%, transparent 70%);
        }

        .consent-page__shape--3 {
          width: 180px;
          height: 180px;
          top: 42%;
          right: 6%;
          border: 1px solid rgba(245, 78, 37, 0.08);
          background: rgba(255, 255, 255, 0.35);
        }

        .consent-shell {
          max-width: 1320px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .consent-panel {
          background: var(--surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.85);
        }

        .consent-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px 32px 22px;
          border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }

        .consent-back {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid #e8edf3;
          background: #F6F8FB;
          color: var(--brand-navy);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
          transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
        }

        .consent-back:hover {
          background: #eef2f7;
          color: var(--brand-orange);
          border-color: #dde4ed;
        }

        .consent-header__text h1 {
          margin: 0 0 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--brand-navy);
          letter-spacing: -0.02em;
        }

        .consent-header__text p {
          margin: 0;
          font-size: 0.95rem;
          color: var(--muted);
          line-height: 1.6;
          max-width: 680px;
        }

        .consent-body {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 0;
          min-height: 620px;
        }

        .consent-sidebar {
          border-right: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 24px;
          align-self: start;
          max-height: calc(100vh - 48px);
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }

        .consent-sidebar__main {
          flex: 1;
          overflow-y: auto;
          padding: 28px 24px 20px;
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }

        .consent-sidebar__main::-webkit-scrollbar { width: 5px; }
        .consent-sidebar__main::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 6px;
        }

        .consent-sidebar__logo {
          width: 104px;
          height: auto;
          object-fit: contain;
          margin-bottom: 20px;
        }

        .consent-sidebar__title {
          margin: 0 0 8px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--brand-navy);
          letter-spacing: -0.02em;
        }

        .consent-sidebar__intro {
          margin: 0 0 18px;
          font-size: 0.88rem;
          color: var(--muted);
          line-height: 1.55;
        }

        .consent-sidebar__step {
          display: inline-flex;
          align-items: center;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--brand-orange);
          background: var(--brand-orange-soft);
          padding: 6px 10px;
          border-radius: 999px;
          margin: 0 0 20px;
        }

        .consent-sidebar__stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 22px;
        }

        .consent-sidebar__stat {
          background: #fff;
          border: 1px solid #eef2f7;
          border-radius: var(--radius-md);
          padding: 12px 14px;
          box-shadow: 0 2px 8px rgba(27, 37, 89, 0.03);
        }

        .consent-sidebar__stat-icon {
          color: var(--brand-orange);
          margin-bottom: 6px;
        }

        .consent-sidebar__stat strong {
          display: block;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--brand-navy);
          line-height: 1.2;
        }

        .consent-sidebar__stat span {
          font-size: 0.76rem;
          color: #94a3b8;
        }

        .consent-sidebar__completion {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          background: #f8fafc;
          border: 1px solid #eef2f7;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
        }

        .consent-sidebar__completion.is-done {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #166534;
        }

        .consent-sidebar__label {
          margin: 0 0 10px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .consent-sidebar__topics {
          list-style: none;
          margin: 0 0 24px;
          padding: 0;
          display: grid;
          gap: 4px;
        }

        .consent-sidebar__topic {
          width: 100%;
          text-align: left;
          border: 1px solid transparent;
          background: transparent;
          padding: 10px 12px;
          font-size: 0.86rem;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
        }

        .consent-sidebar__topic-index {
          width: 22px;
          height: 22px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.2s, color 0.2s;
        }

        .consent-sidebar__topic-label {
          flex: 1;
          line-height: 1.35;
        }

        .consent-sidebar__topic-badge {
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--brand-orange);
          background: var(--brand-orange-soft);
          padding: 2px 6px;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .consent-sidebar__topic:hover {
          background: #f8fafc;
          color: var(--brand-navy);
          border-color: #eef2f7;
        }

        .consent-sidebar__topic.is-active {
          background: #fff7f4;
          border-color: rgba(245, 78, 37, 0.22);
          color: var(--brand-navy);
          font-weight: 600;
          box-shadow: 0 2px 10px rgba(245, 78, 37, 0.08);
        }

        .consent-sidebar__topic.is-active .consent-sidebar__topic-index {
          background: var(--brand-orange);
          color: #fff;
        }

        .consent-sidebar__topic.is-complete .consent-sidebar__topic-index {
          background: #dcfce7;
          color: #166534;
        }

        .consent-sidebar__progress-block {
          background: #fff;
          border: 1px solid #eef2f7;
          border-radius: var(--radius-md);
          padding: 16px;
          box-shadow: 0 2px 10px rgba(27, 37, 89, 0.04);
        }

        .consent-sidebar__progress-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }

        .consent-sidebar__progress-head span:first-child {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }

        .consent-sidebar__progress-pct {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--brand-orange);
          line-height: 1;
          transition: color 0.3s;
        }

        .consent-sidebar__progress-track {
          height: 12px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .consent-sidebar__progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #F54E25 0%, #ff7a50 100%);
          border-radius: 999px;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 12px rgba(245, 78, 37, 0.35);
        }

        .consent-sidebar__progress-sub {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: #475569;
        }

        .consent-sidebar__footer {
          flex-shrink: 0;
          padding: 18px 24px 24px;
          border-top: 1px solid #f1f5f9;
          background: #ffffff;
          box-shadow: 0 -8px 24px rgba(27, 37, 89, 0.04);
        }

        .consent-document {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background:
            linear-gradient(180deg, #fafbfc 0%, #f8fafc 100%);
          position: relative;
        }

        .consent-reader {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .consent-reader__progress-sticky {
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 18px 36px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .consent-reader__progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--muted);
        }

        .consent-reader__progress-pct {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1rem;
          font-weight: 800;
          color: var(--brand-orange);
        }

        .consent-reader__progress-track {
          height: 8px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
        }

        .consent-reader__progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #F54E25, #ff7a50);
          border-radius: 999px;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .consent-reader__scroll {
          flex: 1;
          overflow-y: auto;
          padding: 32px 40px 48px;
          max-height: calc(100vh - 200px);
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .consent-reader__scroll::-webkit-scrollbar { width: 7px; }
        .consent-reader__scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
        }

        .consent-reader__doc-header {
          margin-bottom: 32px;
          max-width: 860px;
        }

        .consent-reader__doc-header h2 {
          margin: 0 0 8px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.65rem;
          font-weight: 800;
          color: var(--brand-navy);
          letter-spacing: -0.03em;
        }

        .consent-reader__doc-header p {
          margin: 0;
          font-size: 1rem;
          color: var(--muted);
          line-height: 1.6;
        }

        .consent-reader__section {
          max-width: 860px;
          margin-bottom: 24px;
          padding: 24px 28px;
          border-radius: var(--radius-md);
          background: #ffffff;
          border: 1px solid #eef2f7;
          box-shadow: var(--shadow-card);
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
        }

        .consent-reader__section.is-active {
          border-color: rgba(245, 78, 37, 0.28);
          box-shadow: 0 8px 28px rgba(245, 78, 37, 0.1);
        }

        .consent-reader__section.is-highlight {
          background: linear-gradient(135deg, #fff9f7 0%, #ffffff 72%);
          border-left: 4px solid var(--brand-orange);
          padding-left: 24px;
        }

        .consent-reader__section-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .consent-reader__section-num {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1;
          color: rgba(245, 78, 37, 0.22);
          flex-shrink: 0;
          min-width: 36px;
        }

        .consent-reader__section h3 {
          margin: 4px 0 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--brand-navy);
          letter-spacing: -0.01em;
        }

        .consent-reader__section p {
          margin: 0;
          font-size: 1.02rem;
          line-height: 1.85;
          color: #334155;
        }

        .consent-reader__footer-note {
          max-width: 860px;
          margin: 12px 0 0;
          padding: 18px 22px;
          border-radius: var(--radius-md);
          background: #f8fafc;
          border: 1px solid #eef2f7;
          font-size: 0.94rem;
          font-weight: 600;
          color: #475569;
          line-height: 1.65;
        }

        .consent-reader__hint,
        .consent-reader__done {
          max-width: 860px;
          margin: 28px 0 0;
          padding: 14px 18px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          font-weight: 600;
          text-align: center;
        }

        .consent-reader__hint {
          color: var(--brand-orange);
          background: var(--brand-orange-soft);
          border: 1px solid rgba(245, 78, 37, 0.15);
        }

        .consent-reader__done {
          color: #166534;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
        }

        .consent-reader__top {
          position: absolute;
          right: 28px;
          bottom: 28px;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: none;
          background: var(--brand-navy);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(27, 37, 89, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          transition: background 0.2s, transform 0.15s;
        }

        .consent-reader__top:hover {
          background: #2d3a6e;
          transform: translateY(-2px);
        }

        .consent-fade-in {
          animation: consentFadeIn 0.5s ease both;
        }

        @keyframes consentFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .consent-actions__waiting {
          margin: 0 0 12px;
          font-size: 0.8rem;
          color: #94a3b8;
          line-height: 1.45;
        }

        .consent-actions__success {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #166534;
          font-size: 0.84rem;
          font-weight: 600;
          line-height: 1.45;
        }

        .consent-actions__success svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .consent-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.88rem;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 14px;
          cursor: pointer;
        }

        .consent-check--disabled {
          opacity: 0.85;
        }

        .consent-check input[type="checkbox"] {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid #e2e8f0;
          border-radius: 5px;
          background: #fff;
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
          margin-top: 2px;
          transition: border-color 0.2s, background 0.2s;
        }

        .consent-check input[type="checkbox"]:checked {
          background: var(--brand-orange);
          border-color: var(--brand-orange);
        }

        .consent-check input[type="checkbox"]:checked::after {
          content: '✔';
          position: absolute;
          color: #fff;
          font-size: 12px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .consent-check input[type="checkbox"]:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .consent-check__hint {
          display: block;
          margin-top: 4px;
          font-size: 0.76rem;
          color: #94a3b8;
        }

        .consent-error {
          font-size: 0.82rem;
          font-weight: 600;
          color: #dc2626;
          background: #fef2f2;
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 12px;
        }

        .consent-btn {
          width: 100%;
          background: linear-gradient(135deg, #F54E25 0%, #e0441f 100%);
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 15px 20px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: filter 0.2s, transform 0.12s, box-shadow 0.2s;
          box-shadow: 0 6px 20px rgba(245, 78, 37, 0.28);
        }

        .consent-btn:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: 0 8px 24px rgba(245, 78, 37, 0.34);
        }

        .consent-btn:active:not(:disabled) { transform: scale(0.98); }
        .consent-btn:disabled {
          opacity: 0.48;
          cursor: not-allowed;
          box-shadow: none;
        }

        .consent-login {
          margin: 14px 0 0;
          font-size: 0.85rem;
          color: var(--muted);
          text-align: center;
        }

        .consent-login a {
          color: var(--brand-orange);
          font-weight: 700;
          text-decoration: none;
        }

        .consent-mobile-bar {
          display: none;
        }

        .consent-success-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .consent-success-card {
          background: #fff;
          border-radius: var(--radius-lg);
          padding: 40px 48px;
          text-align: center;
          box-shadow: 0 28px 64px rgba(0, 0, 0, 0.16);
          animation: consentPop 0.45s ease;
        }

        .consent-success-card svg { color: #16a34a; margin-bottom: 12px; }
        .consent-success-card h2 {
          margin: 0 0 8px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.2rem;
          color: var(--brand-navy);
        }
        .consent-success-card p {
          margin: 0;
          color: var(--muted);
          font-size: 0.94rem;
        }

        @keyframes consentPop {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 960px) {
          .consent-page {
            padding: 16px 12px 0;
          }

          .consent-body {
            grid-template-columns: 1fr;
          }

          .consent-sidebar {
            position: static;
            max-height: none;
            border-right: none;
            border-bottom: 1px solid #f1f5f9;
          }

          .consent-sidebar__footer {
            display: none;
          }

          .consent-sidebar__logo {
            width: 80px;
            margin-bottom: 14px;
          }

          .consent-reader__scroll {
            max-height: none;
            padding: 24px 20px 32px;
          }

          .consent-reader__progress-sticky {
            padding: 14px 20px 12px;
          }

          .consent-mobile-bar {
            display: block;
            position: sticky;
            bottom: 0;
            z-index: 40;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
            box-shadow: 0 -10px 36px rgba(27, 37, 89, 0.1);
            border-top: 1px solid #f1f5f9;
          }

          .consent-page {
            padding-bottom: 8px;
          }
        }
      `}</style>

      <div className="consent-page__shape consent-page__shape--1" aria-hidden />
      <div className="consent-page__shape consent-page__shape--2" aria-hidden />
      <div className="consent-page__shape consent-page__shape--3" aria-hidden />

      <div className="consent-shell">
        <div className="consent-panel">
          <header className="consent-header">
            <button
              type="button"
              className="consent-back"
              aria-label="Back to login"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="consent-header__text">
              <h1>Consent Required</h1>
              <p>
                Before creating a family account, please read and agree to our Informed Consent
                Form for the Kalinga Family Portal.
              </p>
            </div>
          </header>

          <div className="consent-body">
            <aside className="consent-sidebar" aria-label="Consent overview and agreement">
              <div className="consent-sidebar__main">
                <img src={logo} alt="Bridges of Hope Kalinga" className="consent-sidebar__logo" />
                <h2 className="consent-sidebar__title">Informed Consent</h2>
                <p className="consent-sidebar__intro">
                  Please review the document before continuing.
                </p>
                <p className="consent-sidebar__step">Step 1 of 2 · Registration</p>

                <div className="consent-sidebar__stats">
                  <div className="consent-sidebar__stat">
                    <Clock className="consent-sidebar__stat-icon" size={16} aria-hidden />
                    <strong>{readingMinutes} min</strong>
                    <span>Estimated read</span>
                  </div>
                  <div className="consent-sidebar__stat">
                    <Layers className="consent-sidebar__stat-icon" size={16} aria-hidden />
                    <strong>{totalSections}</strong>
                    <span>Total sections</span>
                  </div>
                </div>

                <div
                  className={`consent-sidebar__completion${hasReadConsent ? ' is-done' : ''}`}
                >
                  <span>
                    {hasReadConsent ? 'Document completed' : 'Completion status'}
                  </span>
                  <span>
                    {hasReadConsent ? (
                      <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden />
                    ) : (
                      'In progress'
                    )}
                  </span>
                </div>

                <p className="consent-sidebar__label">Sections</p>
                <ul className="consent-sidebar__topics">
                  {NAV_SECTIONS.map((item, index) => {
                    const isActive = activeSectionId === item.sectionId;
                    const isComplete = index < sectionsCompleted;
                    return (
                      <li key={item.sectionId}>
                        <button
                          type="button"
                          className={[
                            'consent-sidebar__topic',
                            isActive ? 'is-active' : '',
                            isComplete ? 'is-complete' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => scrollToTopic(item.sectionId)}
                        >
                          <span className="consent-sidebar__topic-index">{index + 1}</span>
                          <span className="consent-sidebar__topic-label">{item.label}</span>
                          {item.highlight ? (
                            <span className="consent-sidebar__topic-badge">Key</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <p className="consent-sidebar__label">Reading progress</p>
                <div className="consent-sidebar__progress-block">
                  <div className="consent-sidebar__progress-head">
                    <span>Document</span>
                    <span className="consent-sidebar__progress-pct">{scrollProgress}%</span>
                  </div>
                  <div className="consent-sidebar__progress-track" aria-hidden>
                    <div
                      className="consent-sidebar__progress-fill"
                      style={{ width: `${scrollProgress}%` }}
                    />
                  </div>
                  <p className="consent-sidebar__progress-sub">
                    {sectionsCompleted} of {totalSections} sections completed
                  </p>
                </div>
              </div>

              <div className="consent-sidebar__footer">
                <ConsentActions
                  agreed={agreed}
                  hasReadConsent={hasReadConsent}
                  error={error}
                  onAgreeChange={handleAgreeChange}
                  onContinue={handleContinue}
                />
              </div>
            </aside>

            <div className="consent-document">
              <ConsentDocumentReader
                ref={readerRef}
                document={INFORMED_CONSENT}
                scrollProgress={scrollProgress}
                activeSectionId={activeSectionId}
                onActiveSectionChange={setActiveSectionId}
                onSectionsCompletedChange={setSectionsCompleted}
                onScrollComplete={(complete) => {
                  if (complete) setHasReadConsent(true);
                }}
                onProgressChange={setScrollProgress}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="consent-mobile-bar">
        <ConsentActions
          compact
          agreed={agreed}
          hasReadConsent={hasReadConsent}
          error={error}
          onAgreeChange={handleAgreeChange}
          onContinue={handleContinue}
        />
      </div>

      {showSuccess ? (
        <div className="consent-success-overlay" role="status" aria-live="polite">
          <div className="consent-success-card">
            <CheckCircle2 size={48} strokeWidth={1.75} />
            <h2>Consent recorded</h2>
            <p>Taking you to sign up…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SignupConsent;
