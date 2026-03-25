import React, { useState } from 'react';
import { Mail, X, CheckCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

const NurseChangePass = () => {
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({ email: '' });
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = /\S+@\S+\.\S+/.test(formData.email);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    let newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail) newErrors.email = "Invalid email format";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        navigate('/verify', { state: { from: 'nursechangepass' } });
      }, 800);
    }
  };

  const getBorderColor = () => {
    if (errors.email) return '#ef4444';
    if (isValidEmail && formData.email) return '#10b981';
    if (isFocused) return '#F54E25';
    return '#e2e8f0';
  };

  const getIconColor = () => {
    if (errors.email) return '#ef4444';
    if (isValidEmail && formData.email) return '#10b981';
    if (isFocused) return '#F54E25';
    return '#94a3b8';
  };

  return (
    <div className="changepass-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .changepass-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
        }

        .changepass-content-wrapper {
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

        .changepass-card {
          background: #ffffff;
          padding: 44px 40px 48px 40px;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.09);
          width: 100%;
          max-width: 440px;
          text-align: center;
          position: relative;
          border: 1px solid #f1f5f9;
        }

        .card-close-btn {
          position: absolute;
          top: 18px;
          right: 20px;
          background: #F8F9FD;
          border: none;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .card-close-btn:hover {
          background: #fee2d5;
          color: #F54E25;
        }

        .card-icon-wrap {
          width: 62px;
          height: 62px;
          background: linear-gradient(135deg, #fff1ec, #fde0d5);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px auto;
        }

        .card-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 6px;
        }

        .card-subtitle {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 32px;
          font-weight: 400;
          line-height: 1.5;
        }

        .form-group { text-align: left; margin-bottom: 20px; }

        .input-label {
          display: block;
          font-size: 0.875rem;
          color: #475569;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 44px 14px 46px;
          border: 1.5px solid ${getBorderColor()};
          border-radius: 14px;
          font-size: 0.95rem;
          outline: none;
          color: #1e293b;
          background-color: ${errors.email ? '#fef2f2' : '#ffffff'};
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .input-wrapper input::placeholder { color: #c4cdd9; }

        .input-icon {
          position: absolute;
          left: 15px;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .valid-icon {
          position: absolute;
          right: 14px;
          pointer-events: none;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }

        .error-message {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 6px;
          font-weight: 500;
          margin-left: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-primary {
          width: 100%;
          background: #F54E25;
          color: white;
          padding: 15px;
          border: none;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
          opacity: ${isLoading ? '0.8' : '1'};
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(245, 78, 37, 0.28);
          background: #e8441e;
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .changepass-content-wrapper { flex-direction: column; gap: 0; padding: 0; width: 100%; }
          .brand-side { display: none; }
          .form-side { justify-content: center; width: 100%; padding: 24px 16px 40px 16px; }
          .changepass-card { max-width: 100%; padding: 36px 24px 40px 24px; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        }
      `}</style>

      <div className="changepass-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope" />
        </div>

        <div className="form-side">
          <div className="changepass-card">

            <button className="card-close-btn" onClick={() => navigate('/nurseprofile')}>
              <X size={18} />
            </button>

            <div className="card-icon-wrap">
              <Mail size={28} color="#F54E25" />
            </div>

            <h2 className="card-title">Change Password</h2>
            <p className="card-subtitle">Enter your email address and we'll send you a verification code</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="input-label">Enter Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={20} color={getIconColor()} />
                  <input
                    name="email"
                    type="email"
                    placeholder="example@email.com"
                    className={errors.email ? 'input-error' : ''}
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                  />
                  {isValidEmail && formData.email && !errors.email && (
                    <CheckCircle className="valid-icon" size={18} color="#10b981" />
                  )}
                </div>
                {errors.email && (
                  <div className="error-message">
                    <X size={12} color="#ef4444" /> {errors.email}
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? (
                  <><div className="spinner" /> Sending...</>
                ) : (
                  <><Send size={17} /> Send Verification</>
                )}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseChangePass;