import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatAuthError } from '@/lib/authErrors';
import { appendActivityFeed } from '@/lib/activityFeed';
import { resolveAccountRole } from '@/components/RoleGuard';
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
      navigate('/home');
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

        @keyframes loginFocusRing {
          from { box-shadow: 0 0 0 0 rgba(245, 78, 37, 0.2); }
          to { box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.14), inset 0 1px 2px rgba(26, 43, 74, 0.04); }
        }

        .login-card {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(12px);
          padding: var(--space-4);
          border-radius: 26px;
          box-shadow:
            0 1px 2px rgba(26, 43, 74, 0.03),
            0 8px 24px rgba(26, 43, 74, 0.06),
            0 28px 56px rgba(26, 43, 74, 0.09);
          width: 100%;
          max-width: var(--auth-form-col);
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-sizing: border-box;
          animation: loginFadeIn 0.7s ease-out 0.12s both;
          transition: box-shadow 0.35s ease, transform 0.35s ease;
        }

        .login-card:hover {
          box-shadow:
            0 1px 2px rgba(26, 43, 74, 0.03),
            0 12px 32px rgba(26, 43, 74, 0.07),
            0 32px 64px rgba(26, 43, 74, 0.1);
        }

        .login-header {
          margin-bottom: var(--space-3);
        }

        .login-heading {
          font-size: clamp(1.5rem, 2.5vw, 1.75rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 var(--space-1);
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .login-subtitle {
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.55;
          margin: 0;
          font-weight: 400;
        }

        .form-group {
          margin-bottom: var(--space-2);
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: var(--brand-navy);
          margin-bottom: var(--space-1);
          font-weight: 600;
          line-height: 1.4;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper input {
          width: 100%;
          height: 54px;
          padding: 0 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          color: var(--brand-navy);
          outline: none;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, transform 0.2s ease;
          background-color: #f8fafc;
          box-sizing: border-box;
          box-shadow: inset 0 1px 2px rgba(26, 43, 74, 0.04);
          font-family: inherit;
        }

        .input-wrapper input::placeholder {
          color: #94a3b8;
        }

        .input-wrapper input:hover {
          border-color: #cbd5e1;
          background-color: #ffffff;
        }

        .input-wrapper input:focus {
          border-color: var(--brand-orange);
          background-color: #ffffff;
          animation: loginFocusRing 0.3s ease forwards;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          color: #94a3b8;
          transition: color 0.2s ease;
          pointer-events: none;
        }

        .input-wrapper:focus-within .input-icon {
          color: var(--brand-orange);
        }

        .eye-icon {
          position: absolute;
          right: 14px;
          color: #94a3b8;
          cursor: pointer;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .eye-icon:hover {
          color: var(--brand-navy);
          background-color: #f1f5f9;
        }

        .status-msg {
          padding: var(--space-2);
          border-radius: 12px;
          font-size: 0.875rem;
          margin-bottom: var(--space-2);
          text-align: center;
          line-height: 1.5;
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

        .form-extras {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: var(--space-1) 0 var(--space-3);
          font-size: 0.875rem;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #64748b;
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
          background-color: #ffffff;
          border: 1.5px solid #e2e8f0;
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

        .forgot-link {
          color: var(--brand-navy);
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .forgot-link:hover {
          color: var(--brand-orange);
        }

        .btn-primary {
          width: 100%;
          height: 54px;
          background: linear-gradient(135deg, #FF6A3D 0%, #FF4D1F 100%);
          color: white;
          padding: 0 24px;
          border: none;
          border-radius: 14px;
          font-size: 1.05rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
          box-shadow: 0 4px 16px rgba(255, 77, 31, 0.32);
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: 0 8px 28px rgba(255, 77, 31, 0.38);
          transform: translateY(-2px) scale(1.01);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 3px 12px rgba(255, 77, 31, 0.28);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          box-shadow: none;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: var(--space-2) 0;
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
          margin-bottom: var(--space-2);
          box-sizing: border-box;
          transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
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

        .security-note {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.78rem;
          color: #64748b;
          margin: var(--space-2) auto var(--space-2);
          padding: var(--space-2);
          max-width: 92%;
          width: 100%;
          background: linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(255, 247, 244, 0.6) 100%);
          border-radius: 12px;
          border: 1px solid rgba(245, 78, 37, 0.08);
          line-height: 1.5;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
          box-sizing: border-box;
        }

        .security-note:hover {
          border-color: rgba(245, 78, 37, 0.14);
          box-shadow: 0 2px 12px rgba(245, 78, 37, 0.06);
        }

        .security-note-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(245, 78, 37, 0.09);
          color: var(--brand-orange);
          flex-shrink: 0;
        }

        .signup-prompt {
          font-size: 0.9rem;
          color: #64748b;
          text-align: center;
          margin: var(--space-1) 0 0;
          line-height: 1.5;
        }

        .signup-prompt span {
          color: var(--brand-orange);
          font-weight: 700;
          cursor: pointer;
          margin-left: 4px;
          transition: color 0.2s ease;
        }

        .signup-prompt span:hover {
          color: #e0441f;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @media (max-width: 900px) {
          .login-card {
            padding: var(--space-3);
          }

          .login-header {
            text-align: center;
            margin-bottom: var(--space-3);
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
                Sign in to continue to your Kalinga Family Portal account.
              </p>
            </div>

            {signupNotice && <div className="status-msg info-msg">{signupNotice}</div>}
            {error && <div className="status-msg error-msg">{error}</div>}
            {success && <div className="status-msg success-msg">Login Successful!</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email or Contact Number</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={22} />
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
                  <Lock className="input-icon" size={22} />
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

              <div className="security-note">
                <span className="security-note-icon">
                  <Shield size={15} />
                </span>
                <span>Your information is securely protected and encrypted.</span>
              </div>

              <p className="signup-prompt">
                Don't have an account?
                <Link to="/consent" style={{ textDecoration: 'none' }}>
                  <span>Sign Up</span>
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
