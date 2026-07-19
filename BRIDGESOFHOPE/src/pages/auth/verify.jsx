/**
 * GUIDE: verify.jsx
 * System Part: Authentication Module
 *
 * This file supports the Authentication Module of the Bridges of Hope system.
 */
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { startGoogleOAuthWeb } from '@/lib/oauthWeb';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

const VerifyStep2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || 'forgot';
  const recoveryEmail = location.state?.email || localStorage.getItem('bh_recovery_email') || '';
  const otpLength = 6;

  const [otp, setOtp] = useState(() => Array.from({ length: otpLength }, () => ''));
  const [verifyError, setVerifyError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);

  const inputRefs = Array.from({ length: otpLength }, () => useRef());

  const handleChange = (index, value) => {
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalCode = otp.join('');
    setVerifyError('');
    if (finalCode.length !== otpLength) {
      setVerifyError(`Enter all ${otpLength} digits.`);
      return;
    }

    if (!recoveryEmail) {
      setVerifyError('Missing email context. Go back and request a new verification code.');
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: recoveryEmail,
      token: finalCode,
      type: 'email',
    });

    if (error) {
      setVerifyError(error.message || 'Invalid or expired verification code.');
      return;
    }

    navigate('/newpass', { state: { from } });
  };

  const handleGoogle = async () => {
    setVerifyError('');
    if (!isSupabaseConfigured()) {
      setVerifyError(
        'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.'
      );
      return;
    }
    setGoogleBusy(true);
    try {
      await startGoogleOAuthWeb();
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Google sign-in failed.'
      );
      setGoogleBusy(false);
    }
  };

  const maskedEmail = recoveryEmail
    ? recoveryEmail.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, mid, domain) => {
        const hidden = mid.length > 0 ? '*'.repeat(Math.min(mid.length, 4)) : '';
        return `${a}${hidden}${domain}`;
      })
    : '';

  return (
    <div className="login-container">
      <AuthPageBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        @keyframes verifyFocusRing {
          from { box-shadow: 0 0 0 0 rgba(245, 78, 37, 0.22); }
          to { box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.14), inset 0 1px 2px rgba(26, 43, 74, 0.04); }
        }

        @keyframes verifyDigitIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes verifySpin {
          to { transform: rotate(360deg); }
        }

        .verify-card {
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          padding: clamp(28px, 4vw, 40px);
          border-radius: 24px;
          box-shadow:
            0 1px 2px rgba(26, 43, 74, 0.03),
            0 8px 24px rgba(26, 43, 74, 0.06),
            0 28px 56px rgba(26, 43, 74, 0.09);
          width: 100%;
          max-width: var(--auth-form-col);
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.92);
          box-sizing: border-box;
          animation: loginFadeIn 0.65s ease-out 0.1s both;
          transition: box-shadow 0.25s ease;
        }

        .verify-card:hover {
          box-shadow:
            0 1px 2px rgba(26, 43, 74, 0.03),
            0 12px 32px rgba(26, 43, 74, 0.07),
            0 32px 64px rgba(26, 43, 74, 0.1);
        }

        .verify-card-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 20px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #fff1ec 0%, #fde0d5 100%);
          box-shadow: 0 4px 16px rgba(245, 78, 37, 0.12);
          color: var(--brand-orange);
        }

        .verify-card-title {
          font-size: clamp(1.45rem, 2.5vw, 1.75rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 10px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .verify-card-subtitle {
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.6;
          margin: 0 0 8px;
          font-weight: 400;
        }

        .verify-card-hint {
          font-size: 0.8rem;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0 0 24px;
        }

        .verify-card-hint strong {
          color: #64748b;
          font-weight: 600;
        }

        .verify-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #dc2626;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 16px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          line-height: 1.45;
        }

        .otp-wrapper {
          display: flex;
          justify-content: center;
          gap: clamp(8px, 2vw, 14px);
          margin-bottom: 24px;
        }

        .otp-input {
          width: clamp(44px, 11vw, 56px);
          height: clamp(52px, 13vw, 60px);
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          text-align: center;
          font-size: clamp(1.1rem, 3vw, 1.35rem);
          font-weight: 700;
          color: var(--brand-navy);
          outline: none;
          background-color: #f8fafc;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background-color 0.2s ease,
            transform 0.2s ease;
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          box-shadow: inset 0 1px 2px rgba(26, 43, 74, 0.04);
          caret-color: var(--brand-orange);
        }

        .otp-input:hover {
          border-color: #cbd5e1;
          background-color: #ffffff;
        }

        .otp-input:focus {
          border-color: var(--brand-orange);
          background-color: #ffffff;
          animation: verifyFocusRing 0.22s ease forwards;
          transform: translateY(-1px);
        }

        .otp-input--filled {
          border-color: rgba(245, 78, 37, 0.35);
          background-color: #fff7f4;
          color: var(--brand-orange);
          animation: verifyDigitIn 0.18s ease;
        }

        .btn-primary {
          width: 100%;
          height: 54px;
          background: linear-gradient(135deg, #FF6A3D 0%, #FF4D1F 100%);
          color: white;
          padding: 0 24px;
          border: none;
          border-radius: 999px;
          font-size: 1.05rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease, opacity 0.22s ease;
          box-shadow: 0 4px 16px rgba(255, 77, 31, 0.32);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: 0 8px 28px rgba(255, 77, 31, 0.38);
          transform: translateY(-2px);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 3px 12px rgba(255, 77, 31, 0.28);
        }

        .btn-primary:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .verify-spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: verifySpin 0.7s linear infinite;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          gap: var(--space-2);
        }

        .or-divider::before,
        .or-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
        }

        .or-divider span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          font-size: 0.65rem;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: #f8fafc;
          border-radius: 50%;
          border: 1.5px solid #e8edf3;
          flex-shrink: 0;
          line-height: 1;
        }

        .btn-google {
          width: 100%;
          height: 52px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          padding: 0 20px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 500;
          font-size: 0.975rem;
          font-family: inherit;
          color: var(--brand-navy);
          cursor: pointer;
          box-sizing: border-box;
          transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }

        .btn-google:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(26, 43, 74, 0.06);
          transform: translateY(-1px);
        }

        .btn-google:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-google:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .verify-footer {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .verify-footer-prompt {
          margin: 0;
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.5;
        }

        .verify-footer-prompt button,
        .verify-footer-prompt a {
          color: var(--brand-orange);
          font-weight: 700;
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
          font-size: inherit;
          padding: 0;
          text-decoration: none;
          transition: color 0.2s ease, opacity 0.2s ease;
        }

        .verify-footer-prompt button:hover,
        .verify-footer-prompt a:hover {
          color: #e8441e;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .verify-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #64748b;
          text-decoration: none;
          padding: 8px 14px;
          border-radius: 999px;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .verify-back-link:hover {
          color: var(--brand-navy);
          background: #f1f5f9;
        }

        @media (max-width: 480px) {
          .verify-card {
            border-radius: 20px;
            padding: 24px 20px;
          }

          .otp-wrapper {
            gap: 8px;
          }

          .otp-input {
            border-radius: 14px;
          }
        }
      `}</style>

      <div className="login-content-wrapper">
        <AuthBrandPanel variant="recovery" />

        <div className="form-side">
          <div className="verify-card" role="main">
            <div className="verify-card-icon" aria-hidden="true">
              <ShieldCheck size={26} strokeWidth={2.25} />
            </div>

            <h1 className="verify-card-title">Verify Your Identity</h1>
            <p className="verify-card-subtitle">
              Enter the 6-digit verification code sent to your registered email address.
            </p>
            {maskedEmail ? (
              <p className="verify-card-hint">
                Code sent to <strong>{maskedEmail}</strong>. Use the one-time code from your email — not the magic link.
              </p>
            ) : (
              <p className="verify-card-hint">
                Use the one-time code from your email. Do not use the magic link.
              </p>
            )}

            {verifyError ? (
              <div className="verify-error" role="alert">
                {verifyError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="otp-wrapper" role="group" aria-label="6-digit verification code">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength="1"
                    className={`otp-input${digit ? ' otp-input--filled' : ''}`}
                    value={digit}
                    ref={inputRefs[index]}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </div>

              <button type="submit" className="btn-primary">
                Verify
              </button>
            </form>

            <div className="or-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={handleGoogle}
              disabled={googleBusy}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <p className="verify-footer-prompt">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => navigate('/signup')}>
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyStep2;
