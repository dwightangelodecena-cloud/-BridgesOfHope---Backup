import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

const Forgot = () => {
  const navigate = useNavigate();
  
  // --- STATE (Now matches Login.jsx structure) ---
  const [formData, setFormData] = useState({
    email: '',
    rememberMe: false
  });
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState('');

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError(''); 
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // --- VALIDATION (Matches Login.jsx logic) ---
    if (!formData.email.includes('@') || !formData.email.toLowerCase().endsWith('.com')) {
      setError('Email is required');
      return;
    }

    setError('');
    console.log("Proceeding with recovery for:", formData);
    navigate('/verify'); 
  };

  return (
    <div className="forgot-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .forgot-container {
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

        .forgot-content-wrapper {
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

        .forgot-card {
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
          margin-bottom: 40px;
          font-weight: 500;
        }

        .form-group {
          text-align: left;
          margin-bottom: 25px;
        }

        .input-label {
          display: block;
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 10px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 15px 14px 48px;
          border: 1.5px solid ${error ? '#ef4444' : (isFocused ? '#F54E25' : '#e2e8f0')};
          border-radius: 14px;
          font-size: 1rem;
          outline: none;
          color: #1e293b;
          background-color: #ffffff;
          transition: all 0.2s ease;
        }

        .input-icon {
          position: absolute;
          left: 18px;
          color: ${isFocused ? '#F54E25' : '#94a3b8'};
          transition: color 0.2s ease;
        }

        .error-message {
          color: #ef4444;
          font-size: 0.8rem;
          margin-top: 5px;
          display: block;
        }

        /* --- Custom Checkbox Styles from Login.jsx --- */
        .form-extras {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          margin-bottom: 25px;
          font-size: 0.9rem;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #64748b;
          cursor: pointer;
          position: relative;
          user-select: none;
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
          border-radius: 4px;
          display: inline-block;
          position: relative;
          transition: all 0.2s;
        }

        .remember-me input:checked ~ .checkmark {
          background-color: #F54E25;
          border-color: #F54E25;
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

        .text-link-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.85rem;
          cursor: pointer;
          margin: 20px 0;
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

        .btn-primary:hover { opacity: 0.9; }

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
        }

        .signup-prompt { margin-top: 30px; font-size: 1rem; color: #64748b; }
        .signup-prompt span { color: #F54E25; font-weight: 700; cursor: pointer; }

        @media (max-width: 1024px) {
          .forgot-content-wrapper { flex-direction: column; gap: 40px; padding: 40px 20px; }
          .brand-side { justify-content: center; }
          .brand-side img { max-width: 300px; }
          .form-side { justify-content: center; width: 100%; }
          .forgot-card { padding: 40px 25px; border-radius: 30px; box-shadow: none; }
          .input-wrapper input { background-color: #ffffff !important; }
        }
      `}</style>

      <div className="forgot-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope" />
        </div>

        <div className="form-side">
          <div className="forgot-card">
            <h2 className="step-title">Forgot Password?</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="input-label">Enter Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={20} />
                  <input 
                    name="email"
                    type="text" 
                    placeholder="your.email@example.com" 
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                  />
                </div>
                {error && <span className="error-message">{error}</span>}
              </div>

              {/* Added Remember Me Checkbox */}
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

              <button 
                type="button" 
                className="text-link-btn" 
                onClick={() => navigate('/login')}
              >
                Back to Log In
              </button>

              <button type="submit" className="btn-primary">Send Verification</button>
            </form>

            <div className="or-divider"><span>or</span></div>
            
            <button type="button" className="btn-google">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p className="signup-prompt">
              Don't have an account? <span onClick={() => navigate('/signup')}>Sign Up</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forgot;