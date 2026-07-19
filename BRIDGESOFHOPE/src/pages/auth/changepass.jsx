import React, { useState } from 'react';
import { Mail, X, CheckCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatAuthError } from '@/lib/authErrors';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

const ChangePass = () => {
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({ email: '' });
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const isValidEmail = /\S+@\S+\.\S+/.test(formData.email);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (formError) setFormError('');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!isValidEmail) newErrors.email = 'Invalid email format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    if (!isSupabaseConfigured()) {
      setFormError('Password reset is unavailable: Supabase is not configured.');
      return;
    }

    setIsLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const redirectTo = `${window.location.origin}/newpass`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        const otpFallback = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (otpFallback.error) {
          setFormError(formatAuthError(error));
          return;
        }
        localStorage.setItem('bh_recovery_email', email);
        navigate('/verify', { state: { from: 'changepass', email } });
        return;
      }
      localStorage.setItem('bh_recovery_email', email);
      navigate('/verify', { state: { from: 'changepass', email } });
    } finally {
      setIsLoading(false);
    }
  };

  const inputStateClass = errors.email
    ? 'changepass-input--error'
    : isValidEmail && formData.email
      ? 'changepass-input--valid'
      : isFocused
        ? 'changepass-input--focus'
        : '';

  return (
    <div className="login-container">
      <AuthPageBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        @keyframes changepassFocusRing {
          from { box-shadow: 0 0 0 0 rgba(245, 78, 37, 0.2); }
          to { box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.14), inset 0 1px 2px rgba(26, 43, 74, 0.04); }
        }

        @keyframes changepassSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes changepassFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        .changepass-card {
          position: relative;
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

        .changepass-card:hover {
          box-shadow:
            0 1px 2px rgba(26, 43, 74, 0.03),
            0 12px 32px rgba(26, 43, 74, 0.07),
            0 32px 64px rgba(26, 43, 74, 0.1);
        }

        .changepass-close-btn {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 36px;
          height: 36px;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .changepass-close-btn:hover {
          background: #fee2d5;
          color: var(--brand-orange);
          transform: rotate(90deg);
        }

        .changepass-icon-wrap {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #fff1ec 0%, #fde0d5 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 4px 16px rgba(245, 78, 37, 0.12);
          color: var(--brand-orange);
        }

        .changepass-title {
          font-size: clamp(1.45rem, 2.5vw, 1.75rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 10px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .changepass-subtitle {
          font-size: 0.95rem;
          color: #64748b;
          margin: 0 0 28px;
          font-weight: 400;
          line-height: 1.6;
        }

        .changepass-form-group {
          text-align: left;
          margin-bottom: 20px;
        }

        .changepass-label {
          display: block;
          font-size: 0.875rem;
          color: var(--brand-navy);
          margin-bottom: 8px;
          font-weight: 600;
        }

        .changepass-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .changepass-input-wrap input {
          width: 100%;
          height: 54px;
          padding: 0 44px 0 46px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          outline: none;
          color: var(--brand-navy);
          background-color: #f8fafc;
          transition: border-color 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease;
          font-family: inherit;
          box-shadow: inset 0 1px 2px rgba(26, 43, 74, 0.04);
        }

        .changepass-input-wrap input::placeholder {
          color: #94a3b8;
        }

        .changepass-input-wrap input:hover {
          border-color: #cbd5e1;
          background-color: #ffffff;
        }

        .changepass-input--focus input,
        .changepass-input-wrap input:focus {
          border-color: var(--brand-orange);
          background-color: #ffffff;
          animation: changepassFocusRing 0.22s ease forwards;
        }

        .changepass-input--valid input {
          border-color: #10b981;
          background-color: #f0fdf4;
        }

        .changepass-input--error input {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .changepass-input-icon {
          position: absolute;
          left: 16px;
          pointer-events: none;
          transition: color 0.2s ease;
          color: #94a3b8;
        }

        .changepass-input--focus .changepass-input-icon,
        .changepass-input-wrap:focus-within .changepass-input-icon {
          color: var(--brand-orange);
        }

        .changepass-input--valid .changepass-input-icon {
          color: #10b981;
        }

        .changepass-input--error .changepass-input-icon {
          color: #ef4444;
        }

        .changepass-valid-icon {
          position: absolute;
          right: 14px;
          pointer-events: none;
          animation: changepassFadeIn 0.2s ease;
        }

        .changepass-error {
          color: #ef4444;
          font-size: 0.8rem;
          margin-top: 8px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .changepass-form-error {
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

        .changepass-btn {
          width: 100%;
          height: 54px;
          background: linear-gradient(135deg, #FF6A3D 0%, #FF4D1F 100%);
          color: white;
          padding: 0 24px;
          border: none;
          border-radius: 999px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease, opacity 0.22s ease;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
          box-shadow: 0 4px 16px rgba(255, 77, 31, 0.32);
        }

        .changepass-btn:hover:not(:disabled) {
          filter: brightness(1.04);
          box-shadow: 0 8px 28px rgba(255, 77, 31, 0.38);
          transform: translateY(-2px);
        }

        .changepass-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        .changepass-btn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          box-shadow: none;
        }

        .changepass-spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: changepassSpin 0.7s linear infinite;
        }

        @media (max-width: 480px) {
          .changepass-card {
            border-radius: 20px;
            padding: 24px 20px;
          }
        }
      `}</style>

      <div className="login-content-wrapper">
        <AuthBrandPanel variant="recovery" />

        <div className="form-side">
          <div className="changepass-card">
            <button
              type="button"
              className="changepass-close-btn"
              onClick={() => navigate('/profile')}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="changepass-icon-wrap" aria-hidden="true">
              <Mail size={26} strokeWidth={2.25} />
            </div>

            <h1 className="changepass-title">Change Password</h1>
            <p className="changepass-subtitle">
              Enter your email address and we&apos;ll send you a verification link or code.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="changepass-form-group">
                <label className="changepass-label" htmlFor="changepass-email">
                  Enter Email Address
                </label>
                <div className={`changepass-input-wrap ${inputStateClass}`}>
                  <Mail className="changepass-input-icon" size={20} />
                  <input
                    id="changepass-email"
                    name="email"
                    type="email"
                    placeholder="example@email.com"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                  />
                  {isValidEmail && formData.email && !errors.email && (
                    <CheckCircle className="changepass-valid-icon" size={18} color="#10b981" />
                  )}
                </div>
                {errors.email && (
                  <div className="changepass-error">
                    <X size={12} color="#ef4444" /> {errors.email}
                  </div>
                )}
              </div>

              {formError && (
                <div className="changepass-form-error" role="alert">
                  {formError}
                </div>
              )}

              <button type="submit" className="changepass-btn" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="changepass-spinner" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    Send Verification
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePass;
