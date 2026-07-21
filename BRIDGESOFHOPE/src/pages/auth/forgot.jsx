import React, { useEffect, useState } from 'react';
import { Mail, KeyRound, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { startGoogleOAuthWeb } from '@/lib/oauthWeb';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

const emailLooksValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

const Forgot = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    rememberMe: false
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bh_remembered_email');
    if (saved) {
      setFormData((prev) => ({ ...prev, email: saved, rememberMe: true }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
  };

  const handleGoogle = async () => {
    setError('');
    if (!isSupabaseConfigured()) {
      setError(
        'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.'
      );
      return;
    }
    setSending(true);
    try {
      await startGoogleOAuthWeb();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSupabaseConfigured()) {
      setError('Password reset is unavailable: Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (!emailLooksValid(formData.email)) {
      setError('Enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        setError(otpErr.message || 'Could not send email code.');
        return;
      }
      localStorage.setItem('bh_recovery_channel', 'email');
      localStorage.setItem('bh_recovery_email', email);
      localStorage.removeItem('bh_recovery_phone');
      if (formData.rememberMe) {
        localStorage.setItem('bh_remembered_email', email);
      } else {
        localStorage.removeItem('bh_remembered_email');
      }
      navigate('/verify', { state: { from: 'forgot', channel: 'email', email } });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-container">
      <AuthPageBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        @keyframes forgotFocusRing {
          from { box-shadow: 0 0 0 0 rgba(245, 78, 37, 0.2); }
          to { box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.14), inset 0 1px 2px rgba(26, 43, 74, 0.04); }
        }

        .forgot-card {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          padding: clamp(28px, 4vw, 40px);
          border-radius: var(--auth-radius-card);
          box-shadow: var(--auth-shadow-card);
          width: 100%;
          max-width: var(--auth-form-col);
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-sizing: border-box;
          animation: loginFadeIn 0.65s ease-out 0.1s both;
          transition: box-shadow 0.35s var(--bh-ease, ease), transform 0.35s var(--bh-ease, ease);
        }

        .forgot-card:hover {
          box-shadow: var(--auth-shadow-card-hover);
          transform: translateY(-2px);
        }

        .forgot-back-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--bh-text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 10px 6px 6px;
          margin: 0 0 14px -6px;
          border-radius: 999px;
          font-family: inherit;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .forgot-back-link:hover {
          color: var(--brand-navy);
          background: var(--bh-slate-100);
        }

        .forgot-card-icon {
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

        .forgot-card-title {
          font-size: clamp(1.45rem, 2.5vw, 1.75rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 8px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .forgot-card-subtitle {
          font-size: 0.9rem;
          color: var(--bh-text-muted);
          line-height: 1.55;
          margin: 0 0 24px;
          font-weight: 400;
        }

        .form-group {
          margin-bottom: 16px;
          text-align: left;
        }

        .form-group label {
          display: block;
          font-size: 0.75rem;
          color: var(--bh-text-muted);
          margin-bottom: 6px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          line-height: 1.3;
          transition: color 0.2s ease;
        }

        .form-group:focus-within label {
          color: var(--brand-navy);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper input {
          width: 100%;
          height: var(--auth-input-h);
          padding: 0 16px 0 48px;
          border: 1.5px solid var(--auth-field-border);
          border-radius: var(--auth-radius-field);
          font-size: 1rem;
          font-weight: 500;
          color: var(--brand-navy);
          outline: none;
          background-color: var(--auth-field-bg);
          box-sizing: border-box;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
          font-family: inherit;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, transform 0.2s ease;
        }

        .input-wrapper input::placeholder {
          color: var(--bh-text-subtle);
        }

        .input-wrapper input:hover {
          border-color: var(--bh-slate-300);
          background-color: var(--bh-surface);
        }

        .input-wrapper input:focus {
          border-color: var(--brand-orange);
          background-color: var(--bh-surface);
          animation: forgotFocusRing 0.3s ease forwards;
          transform: translateY(-1px);
        }

        .input-icon {
          position: absolute;
          left: 16px;
          color: var(--bh-text-subtle);
          transition: color 0.2s ease;
          pointer-events: none;
        }

        .input-wrapper:focus-within .input-icon {
          color: var(--brand-orange);
        }

        .status-msg {
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 16px;
          text-align: left;
          line-height: 1.4;
        }

        .error-msg {
          background-color: var(--bh-danger-bg);
          color: var(--bh-danger);
          border: 1px solid var(--bh-danger-border);
        }

        .form-extras {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 2px 0 22px;
          font-size: 0.875rem;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--bh-text-muted);
          font-weight: 500;
          cursor: pointer;
          position: relative;
          user-select: none;
          transition: color 0.2s ease;
        }

        .remember-me:hover {
          color: var(--brand-navy);
        }

        .remember-me input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .checkmark {
          height: 18px;
          width: 18px;
          background-color: var(--bh-surface);
          border: 1.5px solid var(--auth-field-border);
          border-radius: 5px;
          display: inline-block;
          position: relative;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .remember-me input:checked ~ .checkmark {
          background-color: var(--brand-orange);
          border-color: var(--brand-orange);
        }

        .checkmark:after {
          content: "";
          position: absolute;
          display: none;
          left: 50%;
          top: 45%;
          width: 4px;
          height: 9px;
          border: solid white;
          border-width: 0 2.5px 2.5px 0;
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .remember-me input:checked ~ .checkmark:after {
          display: block;
        }

        .btn-primary {
          width: 100%;
          height: var(--auth-input-h);
          background: var(--bh-brand-gradient);
          color: var(--bh-brand-contrast);
          padding: 0 24px;
          border: none;
          border-radius: var(--auth-radius-field);
          font-size: 1.05rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
          box-shadow: var(--bh-shadow-brand);
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: var(--bh-shadow-brand-hover);
          transform: translateY(-2px) scale(1.01);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          box-shadow: var(--bh-shadow-brand-active);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          box-shadow: none;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 22px 0;
          gap: var(--space-2);
        }

        .or-divider::before,
        .or-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--bh-slate-200), transparent);
        }

        .or-divider span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--bh-text-subtle);
          letter-spacing: var(--bh-tracking-wide);
          text-transform: uppercase;
          background: var(--bh-slate-50);
          border-radius: 50%;
          border: 1.5px solid #e8edf3;
          flex-shrink: 0;
          line-height: 1;
        }

        .btn-google {
          width: 100%;
          height: 52px;
          background: var(--bh-surface);
          border: 1.5px solid var(--auth-field-border);
          padding: 0 20px;
          border-radius: var(--auth-radius-field);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 500;
          font-size: 0.975rem;
          font-family: inherit;
          color: var(--brand-navy);
          cursor: pointer;
          margin-top: 22px;
          box-sizing: border-box;
          transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }

        .btn-google:hover:not(:disabled) {
          background: var(--bh-slate-50);
          border-color: var(--bh-slate-300);
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
          transform: translateY(-1px);
        }

        .btn-google:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-google:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .forgot-footer-prompt {
          font-size: 0.9rem;
          color: var(--bh-text-muted);
          text-align: center;
          margin: 20px 0 0;
          line-height: 1.5;
        }

        .forgot-footer-prompt button {
          background: none;
          border: none;
          color: var(--brand-orange);
          font-weight: 700;
          cursor: pointer;
          margin-left: 4px;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          transition: color 0.2s ease;
        }

        .forgot-footer-prompt button:hover {
          color: var(--bh-brand-hover);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @media (max-width: 900px) {
          .forgot-card {
            padding: 24px;
          }
        }
      `}</style>

      <div className="login-content-wrapper">
        <AuthBrandPanel variant="recovery" />

        <div className="form-side">
          <div className="forgot-card" role="main">
            <button
              type="button"
              className="forgot-back-link"
              onClick={() => navigate('/login')}
            >
              <ChevronLeft size={15} />
              Back to Log In
            </button>

            <div className="forgot-card-icon" aria-hidden="true">
              <KeyRound size={26} strokeWidth={2.25} />
            </div>

            <h1 className="forgot-card-title">Forgot Password?</h1>
            <p className="forgot-card-subtitle">
              Enter your email and we&apos;ll send a verification code to reset your password.
            </p>

            {error ? <div className="status-msg error-msg">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    name="email"
                    type="text"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-extras">
                <label className="remember-me">
                  <input
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <span className="checkmark"></span>
                  Remember email
                </label>
              </div>

              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send Verification'}
              </button>
            </form>

            <div className="or-divider">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={handleGoogle}
              disabled={sending}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <p className="forgot-footer-prompt">
              Don&apos;t have an account?
              <button type="button" onClick={() => navigate('/get-the-app')}>Sign Up</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forgot;
