import React, { useState, useRef } from 'react';
import { Lock, CheckCircle, XCircle, ChevronLeft, KeyRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getPasswordStrengthChecks, getPasswordPolicyError, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import AuthBrandPanel from '@/components/auth/AuthBrandPanel';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

const NewPass = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || 'forgot';

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [saveError, setSaveError] = useState('');

  const confirmRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const passwordsMatch = formData.confirmPassword !== '' && formData.password === formData.confirmPassword;
  const pwChecks = getPasswordStrengthChecks(formData.password);
  const canSubmit = pwChecks.isValid && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    const pwErr = getPasswordPolicyError(formData.password);
    if (pwErr) {
      setSaveError(pwErr);
      return;
    }
    if (!passwordsMatch) return;

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: formData.password });
      if (error) {
        setSaveError(error.message || 'Could not update password.');
        return;
      }
    }

    navigate(from === 'changepass' ? '/profile' : from === 'nursechangepass' ? '/nurseprofile' : '/login');
  };

  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'password' && pwChecks.isValid) {
        confirmRef.current?.focus();
      } else if (field === 'confirmPassword' && canSubmit) {
        handleSubmit(e);
      }
    }
  };

  return (
    <div className="login-container">
      <AuthPageBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        @keyframes newpassFocusRing {
          from { box-shadow: 0 0 0 0 rgba(245, 78, 37, 0.2); }
          to { box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.14), inset 0 1px 2px rgba(26, 43, 74, 0.04); }
        }

        .newpass-card {
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

        .newpass-card:hover {
          box-shadow: var(--auth-shadow-card-hover);
          transform: translateY(-2px);
        }

        .newpass-back-link {
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

        .newpass-back-link:hover {
          color: var(--brand-navy);
          background: var(--bh-slate-100);
        }

        .newpass-card-icon {
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

        .newpass-card-title {
          font-size: clamp(1.45rem, 2.5vw, 1.75rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 8px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .newpass-card-subtitle {
          font-size: 0.9rem;
          color: var(--bh-text-muted);
          line-height: 1.55;
          margin: 0 0 24px;
          font-weight: 400;
        }

        .form-group {
          margin-bottom: 18px;
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
          padding: 0 44px 0 48px;
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
          animation: newpassFocusRing 0.3s ease forwards;
          transform: translateY(-1px);
        }

        .input-wrapper input.input-valid {
          border-color: var(--bh-success);
        }

        .input-wrapper input.input-invalid {
          border-color: var(--bh-danger);
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

        .validation-icon {
          position: absolute;
          right: 15px;
          display: flex;
          align-items: center;
          pointer-events: none;
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

        .mismatch-msg {
          color: var(--bh-danger);
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 6px;
          display: block;
          text-align: left;
        }

        .password-requirements {
          margin-top: 12px;
          text-align: left;
          font-size: 0.75rem;
          color: var(--bh-text-muted);
          line-height: 1.6;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 12px;
        }

        .password-requirements .req-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .password-requirements .req-row.met {
          color: var(--bh-success-text);
        }

        .password-requirements .req-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1.5px solid var(--bh-slate-400);
          flex-shrink: 0;
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
          margin-top: 22px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease, opacity 0.25s ease;
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
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        @media (max-width: 900px) {
          .newpass-card {
            padding: 24px;
          }

          .password-requirements {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="login-content-wrapper">
        <AuthBrandPanel variant="recovery" />

        <div className="form-side">
          <div className="newpass-card" role="main">
            <button
              type="button"
              className="newpass-back-link"
              onClick={() => navigate('/login')}
            >
              <ChevronLeft size={15} />
              Back to Log In
            </button>

            <div className="newpass-card-icon" aria-hidden="true">
              <KeyRound size={26} strokeWidth={2.25} />
            </div>

            <h1 className="newpass-card-title">New Password</h1>
            <p className="newpass-card-subtitle">
              Please create a secure password for your account.
            </p>

            {saveError ? <div className="status-msg error-msg">{saveError}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Enter New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    className={pwChecks.isValid ? 'input-valid' : ''}
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'password')}
                    required
                  />
                  {pwChecks.isValid && (
                    <span className="validation-icon">
                      <CheckCircle size={18} color="var(--bh-success)" />
                    </span>
                  )}
                </div>
                <div className="password-requirements" aria-label="Password requirements">
                  <div className={`req-row ${pwChecks.lengthOk ? 'met' : ''}`}>
                    {pwChecks.lengthOk ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    At least {PASSWORD_MIN_LENGTH} characters
                  </div>
                  <div className={`req-row ${pwChecks.upper ? 'met' : ''}`}>
                    {pwChecks.upper ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    One uppercase letter
                  </div>
                  <div className={`req-row ${pwChecks.lower ? 'met' : ''}`}>
                    {pwChecks.lower ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    One lowercase letter
                  </div>
                  <div className={`req-row ${pwChecks.number ? 'met' : ''}`}>
                    {pwChecks.number ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    One number
                  </div>
                  <div className={`req-row ${pwChecks.special ? 'met' : ''}`}>
                    {pwChecks.special ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    One special character
                  </div>
                  <div className={`req-row ${pwChecks.noSpaces ? 'met' : ''}`}>
                    {pwChecks.noSpaces ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    No spaces
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    ref={confirmRef}
                    className={
                      formData.confirmPassword === '' ? '' : passwordsMatch ? 'input-valid' : 'input-invalid'
                    }
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, 'confirmPassword')}
                    required
                  />
                  {formData.confirmPassword !== '' && (
                    <span className="validation-icon">
                      {passwordsMatch ? (
                        <CheckCircle size={18} color="var(--bh-success)" />
                      ) : (
                        <XCircle size={18} color="var(--bh-danger)" />
                      )}
                    </span>
                  )}
                </div>
                {formData.confirmPassword !== '' && !passwordsMatch && (
                  <span className="mismatch-msg">Passwords do not match</span>
                )}
              </div>

              <button type="submit" className="btn-primary" disabled={!canSubmit}>
                Update Password
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPass;
