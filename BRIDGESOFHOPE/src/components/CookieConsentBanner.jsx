import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { WARM_THEME_VARS } from '@/styles/warmTheme';

const CONSENT_STORAGE_KEY = 'bh_cookie_consent_v1';

/**
 * Simple essential-cookies notice (no third-party trackers exist to gate,
 * so this is an acknowledgment banner, not a granular accept/reject picker).
 * Dismissal persists in localStorage so it only shows once per browser.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_STORAGE_KEY)) {
        const t = window.setTimeout(() => setVisible(true), 900);
        return () => window.clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — just skip the banner.
    }
    return undefined;
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, '1');
    } catch {
      // ignore — banner still hides for this session even if it can't persist.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <style>{`
        .cookie-banner {
          ${WARM_THEME_VARS}
          position: fixed;
          left: 20px;
          bottom: 20px;
          z-index: 3000;
          max-width: 380px;
          width: calc(100% - 40px);
          background: var(--surface);
          border: 1px solid rgba(224, 218, 208, 0.9);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-m);
          padding: 1.25rem 1.35rem;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          animation: cookieSlideIn 0.5s var(--ease-out-expo) both;
        }
        @keyframes cookieSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cookie-banner-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--accent-s);
          color: var(--accent-h);
          margin-bottom: 0.75rem;
        }
        .cookie-banner p {
          margin: 0 0 1rem;
          font-size: 0.87rem;
          line-height: 1.6;
          color: var(--ink-2);
        }
        .cookie-banner a { color: var(--accent-h); font-weight: 600; text-decoration: none; }
        .cookie-banner a:hover { text-decoration: underline; }
        .cookie-banner-accept {
          width: 100%;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(217,79,42,0.28);
          transition: transform 0.2s var(--ease-out-expo), box-shadow 0.2s var(--ease-out-expo);
        }
        .cookie-banner-accept:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(217,79,42,0.34); }
        .cookie-banner-accept:active { transform: translateY(0) scale(0.98); }
        @media (max-width: 480px) {
          .cookie-banner { left: 12px; right: 12px; bottom: 12px; width: auto; max-width: none; }
        }
      `}</style>
      <div className="cookie-banner-icon">
        <Cookie size={18} />
      </div>
      <p>
        We use essential cookies to keep you signed in and remember your preferences — no third-party ad
        tracking. Read our <Link to="/cookies">Cookie Policy</Link>.
      </p>
      <button type="button" className="cookie-banner-accept" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
