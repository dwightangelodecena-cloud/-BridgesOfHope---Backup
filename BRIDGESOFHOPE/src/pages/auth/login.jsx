import React, { useState } from 'react';
import { Mail, Lock, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatAuthError } from '@/lib/authErrors';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    accountType: '',
    email: '',
    password: '',
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
    if (success) setSuccess(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.accountType) {
      setError('Please select an account type.');
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
    if (!emailOk) {
      setError('Please enter a valid email address.');
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
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.email.trim(),
      password: formData.password
    });
    setSubmitting(false);

    if (authError) {
      setError(formatAuthError(authError));
      return;
    }

    const metadataRole = (
      data.user?.user_metadata?.account_type ?? 'family'
    ).toLowerCase();
    const selected = formData.accountType.toLowerCase();

    if (metadataRole !== selected) {
      await supabase.auth.signOut();
      setError(
        `This account is not registered as ${formData.accountType}. Contact an administrator if you need staff access.`
      );
      return;
    }

    setSuccess(true);

    if (formData.accountType === 'nurse') {
      navigate('/nurse-dashboard');
    } else if (formData.accountType === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="login-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .login-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .login-content-wrapper {
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

        .login-card {
          background: #ffffff;
          padding: 50px 45px;
          border-radius: 50px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 480px;
          text-align: center;
          border: 1px solid #f1f5f9;
        }

        .card-header-logo {
          height: 90px;
          margin-bottom: 35px;
          object-fit: contain;
        }

        .form-group {
          text-align: left;
          margin-bottom: 22px;
        }

        .form-group label {
          display: block;
          font-size: 0.95rem;
          color: #475569;
          margin-bottom: 10px;
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper input, 
        .input-wrapper select {
          width: 100%;
          padding: 14px 15px 14px 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          color: #1e293b;
          outline: none;
          transition: all 0.2s ease;
          background-color: #ffffff;
          appearance: none;
        }

        .input-wrapper input:focus, 
        .input-wrapper select:focus {
          border-color: #F54E25;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }

        .input-icon {
          position: absolute;
          left: 18px;
          color: #94a3b8;
        }

        .eye-icon {
          position: absolute;
          right: 18px;
          color: #94a3b8;
          cursor: pointer;
          background: none;
          border: none;
          display: flex;
          align-items: center;
        }

        .chevron-icon {
          position: absolute;
          right: 18px;
          color: #475569;
          pointer-events: none;
        }

        .status-msg {
          padding: 12px;
          border-radius: 10px;
          font-size: 0.85rem;
          margin-bottom: 20px;
          text-align: center;
        }

        .error-msg {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .success-msg {
          background-color: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .form-extras {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
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

        .forgot-link {
          color: #334155;
          text-decoration: none;
          font-weight: 600;
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
          transition: transform 0.1s, background 0.2s;
        }

        .btn-primary:hover {
          background: #e0441f;
        }

        .btn-primary:active {
          transform: scale(0.98);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 25px 0;
          color: #334155;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .or-divider::before, 
        .or-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #334155;
        }

        .or-divider span {
          padding: 0 15px;
        }

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
          font-size: 1rem;
          color: #1e293b;
          cursor: pointer;
          margin-bottom: 30px;
          transition: background 0.2s;
        }

        .btn-google:hover {
          background: #f8fafc;
        }

        .signup-prompt {
          font-size: 1rem;
          color: #64748b;
        }

        .signup-prompt span {
          color: #F54E25;
          font-weight: 700;
          cursor: pointer;
          margin-left: 5px;
        }

        @media (max-width: 1100px) {
          .brand-side { display: none; }
          .form-side { justify-content: center; }
          .login-card { 
            box-shadow: none; 
            border: none;
            padding: 20px; 
          }
          .login-container { align-items: flex-start; padding-top: 50px; }
        }
      `}</style>

      <div className="login-content-wrapper">
        <div className="brand-side">
          <img src={logo} alt="Bridges of Hope" />
        </div>

        <div className="form-side">
          <div className="login-card">
            <img src={logo} alt="Bridges of Hope" className="card-header-logo" />

            {error && <div className="status-msg error-msg">{error}</div>}
            {success && <div className="status-msg success-msg">Login Successful!</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Choose account type</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                  >
                    <option value="" disabled>Select user type</option>
                    <option value="family">Family Member</option>
                    <option value="nurse">Nurse</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown className="chevron-icon" size={20} />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={22} />
                  <input
                    name="email"
                    type="text"
                    placeholder="your.email@example.com"
                    value={formData.email}
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
                <span>or</span>
              </div>

              <button type="button" className="btn-google">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <p className="signup-prompt">
                Don't have an account?
                <Link to="/signup" style={{ textDecoration: 'none' }}>
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