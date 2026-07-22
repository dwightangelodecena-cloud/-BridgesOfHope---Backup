import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Shield, UserPlus, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatAuthError } from '@/lib/authErrors';
import { appendActivityFeed } from '@/lib/activityFeed';
import { resolveAccountRole, getAccountTypeFromUser } from '@/components/RoleGuard';
import { takeOAuthExpectedRole, startGoogleOAuthWeb } from '@/lib/oauthWeb';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

const Login = () => {
  const REMEMBER_LOGIN_KEY = 'bh_remembered_login_identifier';
  const LEGACY_REMEMBER_EMAIL_KEY = 'bh_remembered_email';
  const REMEMBER_LOGIN_PAYLOAD_KEY = 'bh_remembered_login_payload';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [signupNotice, setSignupNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const touchPresence = async (userId) => {
    if (!userId) return;
    try {
      const now = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({
          last_active_at: now,
          last_login_at: now,
          updated_at: now,
        })
        .eq('id', userId);
    } catch {
      // Presence sync should not block login.
    }
  };

  useEffect(() => {
    const rawPayload = localStorage.getItem(REMEMBER_LOGIN_PAYLOAD_KEY);
    if (rawPayload) {
      try {
        const parsed = JSON.parse(rawPayload);
        const identifier = String(parsed?.identifier || '').trim();
        const password = String(parsed?.password || '');
        if (identifier) {
          setFormData((prev) => ({
            ...prev,
            identifier,
            password,
            rememberMe: true,
          }));
          return;
        }
      } catch {
        // Fall back to legacy remember keys if payload parsing fails.
      }
    }

    const savedIdentifier =
      localStorage.getItem(REMEMBER_LOGIN_KEY) ||
      localStorage.getItem(LEGACY_REMEMBER_EMAIL_KEY) ||
      '';
    if (savedIdentifier) {
      setFormData((prev) => ({
        ...prev,
        identifier: savedIdentifier,
        rememberMe: true,
      }));
    }
  }, []);

  useEffect(() => {
    const v = sessionStorage.getItem('bh_post_signup');
    if (!v) return;
    if (v === 'check_email') {
      setSignupNotice('Check your email and confirm your account, then sign in below.');
    } else if (v === 'welcome') {
      setSignupNotice('Account created. You can sign in now.');
    }
    sessionStorage.removeItem('bh_post_signup');
  }, []);

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (!oauthError) return;
    takeOAuthExpectedRole();
    const id = window.setTimeout(() => {
      if (oauthError === 'callback' || oauthError === 'no_session') {
        setError('Google sign-in could not be completed. Try again.');
      } else {
        setError(decodeURIComponent(oauthError));
      }
      const next = new URLSearchParams(searchParams);
      next.delete('oauth_error');
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchParams, setSearchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
    if (success) setSuccess(false);
    if (signupNotice) setSignupNotice('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSignupNotice('');

    const identifier = formData.identifier.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const phoneOk = /^[0-9]{10,13}$/.test(identifier);
    if (!emailOk && !phoneOk) {
      setError('Enter a valid email or contact number (10-13 digits).');
      return;
    }

    const pwd = formData.password;
    if (pwd.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(pwd)) {
      setError('Password must include at least one uppercase letter.');
      return;
    }
    if (!/\d/.test(pwd)) {
      setError('Password must include at least one number.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.');
      return;
    }

    setSubmitting(true);
    let data;
    let authError;

    if (emailOk) {
      const result = await supabase.auth.signInWithPassword({
        email: identifier,
        password: formData.password
      });
      data = result.data;
      authError = result.error;
    } else {
      // Contact-number login: attempt direct phone auth first.
      const phoneAttempt = await supabase.auth.signInWithPassword({
        phone: identifier,
        password: formData.password
      });

      data = phoneAttempt.data;
      authError = phoneAttempt.error;

      // If phone auth fails, try resolving contact number -> email via profiles table.
      if (authError) {
        const profileLookup = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', identifier)
          .maybeSingle();

        if (!profileLookup.error && profileLookup.data?.email) {
          const emailAttempt = await supabase.auth.signInWithPassword({
            email: profileLookup.data.email,
            password: formData.password
          });
          data = emailAttempt.data;
          authError = emailAttempt.error;
        }
      }
    }
    setSubmitting(false);

    if (authError) {
      setError(formatAuthError(authError));
      return;
    }

    const accountRole = await resolveAccountRole(data.user);

    const jwtRole = getAccountTypeFromUser(data.user);
    if (accountRole && accountRole !== jwtRole && (accountRole === 'admin' || accountRole === 'nurse')) {
      try {
        await supabase.auth.updateUser({ data: { account_type: accountRole } });
      } catch {
        // JWT sync should not block login; staff RLS also checks profiles.account_type.
      }
    }

    await touchPresence(data.user?.id);
    await appendActivityFeed('Logged in from web app.', {
      familyId: data.user?.id ?? null,
      title: 'Account Login',
      iconName: 'login',
    });

    if (formData.rememberMe) {
      localStorage.setItem(
        REMEMBER_LOGIN_PAYLOAD_KEY,
        JSON.stringify({
          identifier,
          password: formData.password,
        })
      );
      localStorage.setItem(REMEMBER_LOGIN_KEY, identifier);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        localStorage.setItem(LEGACY_REMEMBER_EMAIL_KEY, identifier);
      }
    } else {
      localStorage.removeItem(REMEMBER_LOGIN_PAYLOAD_KEY);
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
      localStorage.removeItem(LEGACY_REMEMBER_EMAIL_KEY);
    }

    setSuccess(true);

    if (accountRole === 'nurse') {
      navigate('/nurse-dashboard');
    } else if (accountRole === 'admin') {
      navigate('/admin-dashboard');
    } else if (accountRole === 'program') {
      navigate('/program');
    } else {
      // Family portal is mobile-only now — there is no web dashboard to send them to.
      navigate('/get-the-app');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccess(false);
    if (!isSupabaseConfigured()) {
      setError(
        'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await startGoogleOAuthWeb();
    } catch (e) {
      takeOAuthExpectedRole();
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        /* ──────────────────────────────────────────────────────────────
           Auth card — mirrors the mobile login sheet.
           Source of truth: CapstoneMobile/app/login.tsx +
           CapstoneMobile/components/auth/LoginField.tsx
           Mobile palette: navy #1A2B4A · muted #64748B · placeholder #94A3B8
           border #E2E8F0 · field bg #F8FAFC · orange #F54E25 / #FF6A3D / #E8441A
           ────────────────────────────────────────────────────────────── */

        .login-card {
          /* Shared glass-card system: same radius/elevation as every other auth
             page (var(--auth-radius-card) / var(--auth-shadow-card)), so login,
             signup, forgot, verify, and reset-password read as one experience. */
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          /* mobile sheet padding 24 — scales up gently on desktop */
          padding: clamp(24px, 2.4vw, 34px);
          border-radius: var(--auth-radius-card);
          box-shadow: var(--auth-shadow-card);
          width: 100%;
          max-width: var(--auth-form-col);
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-sizing: border-box;
          animation: loginFadeIn 0.7s ease-out 0.12s both;
          transition: box-shadow 0.35s var(--bh-ease, ease), transform 0.35s var(--bh-ease, ease);
        }

        .login-card:hover {
          box-shadow: var(--auth-shadow-card-hover);
          transform: translateY(-2px);
        }

        /* mobile: formTitle mb 4, formSubtitle mb 22 */
        .login-header { margin-bottom: 22px; }

        .login-heading {
          font-size: clamp(1.625rem, 2.1vw, 1.875rem);   /* 26 → 30 */
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 4px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 0.875rem;          /* 14 */
          color: #64748b;
          line-height: 1.43;            /* 20/14 */
          margin: 0;
          font-weight: 400;
        }

        .form-group { margin-bottom: 16px; }

        /* mobile LoginField label: 12 / 600 / uppercase / ls .3 / muted→navy */
        .form-group label {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 6px;
          font-weight: 600;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          line-height: 1.3;
          transition: color 0.2s ease;
        }

        .form-group:focus-within label { color: var(--brand-navy); }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        /* mobile row: border 1.5 / radius 16 / minHeight 54 / iconBox 44+4 */
        .input-wrapper input {
          width: 100%;
          min-height: 54px;
          padding: 14px 46px 14px 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          font-size: 1rem;              /* 16 */
          font-weight: 500;
          color: var(--brand-navy);
          background-color: #f8fafc;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }

        .input-wrapper input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .input-wrapper input:hover { border-color: #cbd5e1; }

        .input-wrapper input:focus,
        .input-wrapper input:focus-visible {
          border-color: var(--brand-orange);
          background-color: #ffffff;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.10);
          transform: translateY(-1px);
        }

        .input-icon {
          position: absolute;
          left: 4px;
          width: 44px;                  /* mobile iconBox */
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          transition: color 0.2s ease;
          pointer-events: none;
        }

        .input-wrapper:focus-within .input-icon { color: var(--brand-orange); }

        .eye-icon {
          position: absolute;
          right: 14px;
          color: #64748b;
          cursor: pointer;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 8px;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .eye-icon:hover {
          color: var(--brand-navy);
          background-color: #f1f5f9;
        }

        .eye-icon:focus-visible {
          outline: 2px solid var(--brand-orange);
          outline-offset: 2px;
        }

        /* mobile banner: padding 12 / radius 12 / border 1 / mb 16 / 13-600 */
        .status-msg {
          padding: 12px;
          border-radius: 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 16px;
          text-align: left;
          line-height: 1.38;
        }

        .error-msg {
          background-color: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .success-msg {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .info-msg {
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        /* mobile extrasRow: mt -4 / mb 20 */
        .form-extras {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: -4px 0 20px;
          font-size: 0.875rem;
          gap: 12px;
          flex-wrap: wrap;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-weight: 500;
          cursor: pointer;
          position: relative;
          user-select: none;
          transition: color 0.2s ease;
        }

        .remember-me:hover { color: var(--brand-navy); }

        .remember-me input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        /* mobile checkbox: 20 / radius 6 / border 1.5 */
        .checkmark {
          height: 20px;
          width: 20px;
          background-color: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 6px;
          display: inline-block;
          position: relative;
          transition: background-color 0.2s ease, border-color 0.2s ease;
          flex-shrink: 0;
        }

        .remember-me input:checked ~ .checkmark {
          background-color: var(--brand-orange);
          border-color: var(--brand-orange);
        }

        .remember-me input:focus-visible ~ .checkmark {
          outline: 2px solid var(--brand-orange);
          outline-offset: 2px;
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

        .remember-me input:checked ~ .checkmark:after { display: block; }

        /* mobile forgotLink: 14 / 700 / orange */
        .forgot-link {
          color: var(--brand-orange);
          text-decoration: none;
          font-weight: 700;
          font-size: 0.875rem;
          transition: color 0.2s ease;
        }

        .forgot-link:hover {
          color: #e8441a;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* mobile CTA: radius 14 / minHeight 54 / 16-800 / mb 18 */
        .btn-primary {
          width: 100%;
          min-height: 54px;
          background: linear-gradient(90deg, #ff6a3d 0%, #f54e25 55%, #e8441a 100%);
          color: #ffffff;
          padding: 0 24px;
          border: none;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          margin-bottom: 18px;
          box-shadow: 0 4px 10px rgba(232, 68, 26, 0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: 0 6px 16px rgba(232, 68, 26, 0.36);
          transform: translateY(-1px);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 3px 8px rgba(232, 68, 26, 0.28);
        }

        /* mobile disabled CTA fades to the grey gradient */
        .btn-primary:disabled {
          background: linear-gradient(90deg, #cbd5e1 0%, #94a3b8 100%);
          box-shadow: none;
          cursor: not-allowed;
        }

        /* mobile divider: gap 12 / mb 18 / "or" 13-500 #94A3B8 */
        .or-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 18px;
        }

        .or-divider::before,
        .or-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #e8edf3;
        }

        .or-divider span {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #94a3b8;
          text-transform: lowercase;
          letter-spacing: 0;
          line-height: 1;
          flex-shrink: 0;
        }

        /* mobile google: minHeight 52 / radius 14 / border 1.5 / 15-700 / mb 20 */
        .btn-google {
          width: 100%;
          min-height: 52px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          padding: 0 20px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 700;
          font-size: 0.9375rem;
          font-family: inherit;
          color: var(--brand-navy);
          cursor: pointer;
          margin-bottom: 20px;
          box-sizing: border-box;
          transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }

        .btn-google:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
          transform: translateY(-1px);
        }

        .btn-google:active:not(:disabled) { transform: translateY(0); }

        .btn-google:disabled { opacity: 0.65; cursor: not-allowed; }

        /* mobile signupPrompt card: radius 16 / border rgba(245,78,37,.2) /
           gradient #FFF7F4 → #FFF / pad 14 / gap 12 / mb 16 */
        .signup-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          margin-bottom: 16px;
          border-radius: 16px;
          border: 1px solid rgba(245, 78, 37, 0.2);
          background: linear-gradient(120deg, #fff7f4 0%, #ffffff 100%);
          text-decoration: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }

        .signup-cta:hover {
          border-color: rgba(245, 78, 37, 0.38);
          box-shadow: 0 6px 18px rgba(245, 78, 37, 0.12);
          transform: translateY(-1px);
        }

        .signup-cta:focus-visible {
          outline: 2px solid var(--brand-orange);
          outline-offset: 2px;
        }

        .signup-cta-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(245, 78, 37, 0.12);
          color: var(--brand-orange);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .signup-cta-copy {
          display: block;
          flex: 1;
          min-width: 0;
        }

        .signup-cta-label {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
          margin: 0 0 2px;
          line-height: 1.3;
        }

        .signup-cta-action {
          display: block;
          font-size: 0.9375rem;
          font-weight: 800;
          color: var(--brand-navy);
          letter-spacing: -0.2px;
          margin: 0;
          line-height: 1.3;
        }

        .signup-cta-arrow {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid rgba(245, 78, 37, 0.15);
          color: var(--brand-orange);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .signup-cta:hover .signup-cta-arrow { transform: translateX(2px); }

        /* mobile footerMeta: centered, 11-500 muted */
        .security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.6875rem;
          font-weight: 500;
          color: #64748b;
          line-height: 1.4;
          margin: 0;
          padding: 0;
          background: none;
          border: none;
          text-align: center;
        }

        .security-note-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .login-card {
            padding: 24px;
            border-radius: 24px;
          }

          .login-header {
            text-align: center;
            margin-bottom: 20px;
          }
        }
      `}</style>

      <AuthPageBackground />

      <div className="login-content-wrapper">
        <AuthBrandPanel />

        <div className="form-side">
          <div className="login-card">
            <div className="login-header">
              <h2 className="login-heading">Welcome Back</h2>
              <p className="login-subtitle">
                Sign in to continue to your Kalinga account.
              </p>
            </div>

            {signupNotice && <div className="status-msg info-msg">{signupNotice}</div>}
            {error && <div className="status-msg error-msg">{error}</div>}
            {success && <div className="status-msg success-msg">Login Successful!</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email or Contact Number</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    name="identifier"
                    type="text"
                    placeholder="your.email@example.com or 09xxxxxxxxx"
                    value={formData.identifier}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="eye-icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
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
                  Remember me
                </label>
                <Link to="/forgot" className="forgot-link">Forgot Password?</Link>
              </div>

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="or-divider">
                <span>OR</span>
              </div>

              <button
                type="button"
                className="btn-google"
                onClick={handleGoogle}
                disabled={submitting}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <Link to="/get-the-app" className="signup-cta">
                <span className="signup-cta-icon">
                  <UserPlus size={20} />
                </span>
                <span className="signup-cta-copy">
                  <span className="signup-cta-label">Don&apos;t have an account?</span>
                  <span className="signup-cta-action">Create your free account</span>
                </span>
                <span className="signup-cta-arrow">
                  <ChevronRight size={18} />
                </span>
              </Link>

              <div className="security-note">
                <span className="security-note-icon">
                  <Shield size={13} />
                </span>
                <span>Your information is securely protected and encrypted.</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
