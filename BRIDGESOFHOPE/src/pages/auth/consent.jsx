import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { INFORMED_CONSENT, SIGNUP_CONSENT_STORAGE_KEY } from '@/lib/legalDocuments';
import LegalDocumentModal from '@/components/auth/LegalDocumentModal';

const SignupConsent = () => {
  const navigate = useNavigate();
  const [hasReadConsent, setHasReadConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!hasReadConsent) {
      setError('Please open and read the Informed Consent Form to the end.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Informed Consent Form to continue.');
      return;
    }
    sessionStorage.setItem(SIGNUP_CONSENT_STORAGE_KEY, new Date().toISOString());
    navigate('/signup');
  };

  return (
    <div className="consent-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .consent-page {
          min-height: 100vh;
          background: #fff;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }
        .consent-shell {
          width: min(520px, 100%);
          background: #fff;
          border: 1px solid #f1f5f9;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.08);
          padding: 32px 28px 36px;
          position: relative;
        }
        .consent-back {
          position: absolute;
          left: 20px;
          top: 20px;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #1B2559;
        }
        .consent-logo { width: 120px; display: block; margin: 8px auto 20px; }
        .consent-title { text-align: center; font-size: 1.35rem; font-weight: 800; color: #1B2559; margin: 0 0 8px; }
        .consent-sub { text-align: center; color: #64748b; font-size: 0.9rem; line-height: 1.5; margin-bottom: 24px; }
        .consent-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .consent-link {
          color: #F54E25;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .consent-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.9rem;
          color: #475569;
          margin-bottom: 16px;
        }
        .consent-check input { margin-top: 3px; width: 18px; height: 18px; accent-color: #F54E25; }
        .consent-error { color: #dc2626; font-size: 0.8rem; font-weight: 600; margin-bottom: 12px; text-align: center; }
        .consent-btn {
          width: 100%;
          background: #F54E25;
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 15px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
        }
        .consent-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .consent-login { text-align: center; margin-top: 18px; color: #64748b; font-size: 0.95rem; }
        .consent-login a { color: #F54E25; font-weight: 700; text-decoration: none; }
      `}</style>

      <div className="consent-shell">
        <button type="button" className="consent-back" aria-label="Back to login" onClick={() => navigate('/login')}>
          <ArrowLeft size={20} />
        </button>
        <img src={logo} alt="Kalinga" className="consent-logo" />
        <h1 className="consent-title">Consent Required</h1>
        <p className="consent-sub">
          Before creating a family account, please read and agree to our Informed Consent Form.
        </p>

        <div className="consent-box">
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.55 }}>
            The consent form explains how Bridges of Hope collects and uses your information for admission
            processing, meetings, visitations, and family portal notifications.
          </p>
          <p style={{ margin: '12px 0 0', fontSize: '0.88rem' }}>
            <span
              className="consent-link"
              role="button"
              tabIndex={0}
              onClick={() => setModalOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
            >
              Open Informed Consent Form
            </span>
            {!hasReadConsent ? ' (scroll to the end to enable agreement)' : ''}
          </p>
        </div>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={agreed}
            disabled={!hasReadConsent}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (error) setError('');
            }}
          />
          <span>
            I have read and agree to the{' '}
            <span className="consent-link" role="button" tabIndex={0} onClick={() => setModalOpen(true)}>
              Informed Consent Form
            </span>
            .
          </span>
        </label>

        {error && <div className="consent-error">{error}</div>}

        <button type="button" className="consent-btn" disabled={!hasReadConsent || !agreed} onClick={handleContinue}>
          I Agree and Continue to Sign Up
        </button>

        <p className="consent-login">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>

      <LegalDocumentModal
        open={modalOpen}
        document={INFORMED_CONSENT}
        onClose={() => setModalOpen(false)}
        onConfirmRead={() => {
          setHasReadConsent(true);
          setAgreed(true);
        }}
        confirmLabel="I have read the Informed Consent Form"
      />
    </div>
  );
};

export default SignupConsent;
