/**
 * GUIDE: verify.jsx
 * System Part: Authentication Module
 * 
 * This file supports the Authentication Module of the Bridges of Hope system.
 */
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { startGoogleOAuthWeb } from '@/lib/oauthWeb';

const VerifyStep2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || 'forgot';
  const recoveryEmail = location.state?.email || localStorage.getItem('bh_recovery_email') || '';
  const otpLength = 6;

  // State to hold the 6-digit code
  const [otp, setOtp] = useState(() => Array.from({ length: otpLength }, () => ''));
  const [verifyError, setVerifyError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  
  // References for each input field to handle auto-focus
  const inputRefs = Array.from({ length: otpLength }, () => useRef());

  const handleChange = (index, value) => {
    // Only allow numbers
    if (isNaN(value)) return;

    const newOtp = [...otp];
    // Take only the last character entered
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus to next input if value is entered
    if (value && index < otp.length - 1) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
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

  return (
    <div className="verify-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .verify-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
        }

        .verify-content-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 120px;
          width: 90%;
          max-width: 1400px;
        }

        .brand-side {
          flex: 1;
          display: flex;
          justify-content: flex-end;
        }

        .brand-side img {
          width: 100%;
          max-width: 550px;
          height: auto;
        }

        .form-side {
          flex: 1;
          display: flex;
          justify-content: flex-start;
        }

        .verify-card {
          background: #ffffff;
          padding: 60px 50px;
          border-radius: 50px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 500px;
          text-align: center;
          border: 1px solid #f1f5f9;
        }

        .step-title {
          color: #475569;
          font-size: 1.6rem;
          margin-bottom: 25px;
          font-weight: 500;
        }

        .input-label {
          display: block;
          font-size: 0.95rem;
          color: #1e293b;
          margin-bottom: 20px;
          font-weight: 400;
        }

        .otp-wrapper {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .otp-input {
          width: 60px;
          height: 60px;
          border: 1.5px solid #e2e8f0;
          border-radius: 50%;
          text-align: center;
          font-size: 1.2rem;
          font-weight: 500;
          color: #1e293b;
          outline: none;
          background-color: #ffffff;
          transition: border-color 0.2s;
        }

        .otp-input:focus {
          border-color: #F54E25;
        }

        .text-link-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.85rem;
          cursor: pointer;
          margin: 15px 0 25px 0;
          display: block;
          width: 100%;
          text-align: center;
        }

        .btn-primary {
          width: 100%;
          background: #F54E25;
          color: white;
          padding: 16px;
          border: none;
          border-radius: 14px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 30px 0;
          color: #334155;
          font-size: 0.85rem;
        }

        .or-divider::before, 
        .or-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #334155;
        }

        .or-divider span { padding: 0 15px; }

        .btn-google {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 14px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 500;
          cursor: pointer;
          color: #1e293b;
        }

        .signup-prompt { margin-top: 30px; font-size: 1rem; color: #64748b; }
        .signup-prompt span { color: #F54E25; font-weight: 700; cursor: pointer; }

        @media (max-width: 1024px) {
          .verify-content-wrapper { flex-direction: column; gap: 40px; padding: 40px 20px; }
          .brand-side { justify-content: center; }
          .brand-side img { max-width: 300px; }
          .form-side { justify-content: center; width: 100%; }
          .verify-card { padding: 40px 25px; border-radius: 30px; box-shadow: none; border: none; }
          .otp-input { width: 50px; height: 50px; background-color: #ffffff !important; }
        }
      `}</style>

      <div className="verify-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope" />
        </div>

        <div className="form-side">
          <div className="verify-card">
            <h2 className="step-title">Forgot Password?</h2>
            <label className="input-label">Enter the 6-digit code sent to your email</label>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: -8, marginBottom: 16 }}>
              Use the one-time code from your email. Do not use the magic link.
            </p>

            {verifyError ? (
              <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{verifyError}</div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="otp-wrapper">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength="1"
                    className="otp-input"
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

            <div className="or-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={handleGoogle}
              disabled={googleBusy}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
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

            <p className="signup-prompt">
              Don&apos;t have an account? <span onClick={() => navigate('/signup')}>Sign Up</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyStep2;