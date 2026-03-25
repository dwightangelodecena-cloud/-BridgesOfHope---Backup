import React, { useState, useRef } from 'react';
import { Lock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';

const NewPass = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || 'forgot';

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isFocused, setIsFocused] = useState('');

  const confirmRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const passwordsMatch = formData.confirmPassword !== '' && formData.password === formData.confirmPassword;
  const isLengthValid = formData.password.length >= 8;
  const canSubmit = isLengthValid && passwordsMatch;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLengthValid) return;
    if (passwordsMatch) {
      console.log("Password reset successful");
      navigate(from === 'changepass' ? '/profile' : from === 'nursechangepass' ? '/nurseprofile' : '/login');
    }
  };

  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'password' && isLengthValid) {
        confirmRef.current?.focus();
      } else if (field === 'confirmPassword' && canSubmit) {
        handleSubmit(e);
      }
    }
  };

  return (
    <div className="newpass-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .newpass-container {
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

        .newpass-content-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 120px;
          width: 90%;
          max-width: 1400px;
        }

        .brand-side { flex: 1; display: flex; justify-content: flex-end; }
        .brand-side img { width: 100%; max-width: 550px; height: auto; }
        .form-side { flex: 1; display: flex; justify-content: flex-start; }

        .newpass-card {
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
          color: #1e293b;
          font-size: 1.8rem;
          margin-bottom: 10px;
          font-weight: 700;
        }

        .step-subtitle {
          color: #64748b;
          font-size: 0.95rem;
          margin-bottom: 40px;
          display: block;
        }

        .form-group { text-align: left; margin-bottom: 25px; }

        .input-label {
          display: block;
          font-size: 0.9rem;
          color: #475569;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .requirement-text {
          font-size: 0.75rem;
          color: ${isLengthValid ? '#10b981' : '#94a3b8'};
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .input-wrapper { position: relative; display: flex; align-items: center; }

        .input-wrapper input {
          width: 100%;
          padding: 14px 15px 14px 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          outline: none;
          color: #1e293b;
          background-color: #ffffff;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .input-password { border-color: ${isLengthValid ? '#10b981' : '#e2e8f0'} !important; }
        .input-confirm {
          border-color: ${formData.confirmPassword === '' ? '#e2e8f0' : (passwordsMatch ? '#10b981' : '#ef4444')} !important;
        }

        .input-wrapper input:focus {
          border-color: #F54E25 !important;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }

        .input-icon {
          position: absolute;
          left: 18px;
          color: #94a3b8;
          transition: color 0.2s ease;
        }

        .validation-icon {
          position: absolute;
          right: 15px;
          transition: opacity 0.2s ease;
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
          transition: all 0.3s ease;
          margin-top: 20px;
          opacity: ${canSubmit ? '1' : '0.6'};
        }

        .btn-primary:hover {
          transform: ${canSubmit ? 'translateY(-2px)' : 'none'};
          box-shadow: ${canSubmit ? '0 10px 20px rgba(245, 78, 37, 0.2)' : 'none'};
        }

        @media (max-width: 1024px) {
          .newpass-content-wrapper { flex-direction: column; gap: 40px; padding: 40px 20px; }
          .brand-side { justify-content: center; }
          .brand-side img { max-width: 300px; }
          .form-side { justify-content: center; width: 100%; }
          .newpass-card { padding: 40px 25px; border-radius: 30px; box-shadow: none; border: none; }
        }
      `}</style>

      <div className="newpass-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope Logo" />
        </div>

        <div className="form-side">
          <div className="newpass-card">
            <h2 className="step-title">New Password</h2>
            <span className="step-subtitle">Please create a secure password for your account</span>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="input-label">Enter New Password</label>
                <div className="input-wrapper">
                  <input
                    className="input-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setIsFocused('pass')}
                    onBlur={() => setIsFocused('')}
                    onKeyDown={(e) => handleKeyDown(e, 'password')}
                    required
                  />
                  <Lock className="input-icon" size={20} style={{ color: isFocused === 'pass' ? '#F54E25' : '#94a3b8' }} />
                  {isLengthValid && <CheckCircle className="validation-icon" size={18} color="#10b981" />}
                </div>
                <span className="requirement-text">
                  {isLengthValid ? <CheckCircle size={14} /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #94a3b8' }} />}
                  Minimum 8 characters
                </span>
              </div>

              <div className="form-group">
                <label className="input-label">Confirm New Password</label>
                <div className="input-wrapper">
                  <input
                    ref={confirmRef}
                    className="input-confirm"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setIsFocused('confirm')}
                    onBlur={() => setIsFocused('')}
                    onKeyDown={(e) => handleKeyDown(e, 'confirmPassword')}
                    required
                  />
                  <Lock className="input-icon" size={20} style={{ color: isFocused === 'confirm' ? '#F54E25' : '#94a3b8' }} />
                  {formData.confirmPassword !== '' && (
                    passwordsMatch ?
                      <CheckCircle className="validation-icon" size={18} color="#10b981" /> :
                      <XCircle className="validation-icon" size={18} color="#ef4444" />
                  )}
                </div>
                {formData.confirmPassword !== '' && !passwordsMatch && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '5px', display: 'block' }}>
                    Passwords do not match
                  </span>
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