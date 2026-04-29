import React, { useState, useRef, useEffect } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, X, Phone, MapPin, Building2, Hash, CheckCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatAuthError } from '@/lib/authErrors';
import { PsgcSearchableSelect } from '@/components/address/PsgcSearchableSelect';
import { AddressFormSection, StreetAddressInput } from '@/components/address/AddressFormSection';
import { usePsgcAddressCascade } from '@/hooks/usePsgcAddressCascade';
import {
  getAddressStorageKey,
  loadAddressDraft,
  saveAddressDraft,
  clearAddressDraft,
} from '@/lib/addressPersistence';
import { getPasswordStrengthChecks, getPasswordPolicyError, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';

const SignUp = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleInitial: '',
    contactNumber: '',
    province: '',
    municipality: '',
    barangay: '',
    street: '',
    houseBlockLot: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });

  const {
    provinceOptions,
    cityOptions,
    barangayOptions,
    loadingProvinces,
    loadingCities,
    loadingBarangays,
    fetchError,
    setFetchError,
    onProvinceSelected,
    onCitySelected,
    onBarangaySelected,
    onProvinceCleared,
    onCityCleared,
    onBarangayCleared,
    hydrateFromSaved,
  } = usePsgcAddressCascade({ cityFieldKey: 'municipality' });

  const psgcCodesRef = useRef({
    provinceCode: '',
    provinceKind: 'province',
    cityCode: '',
    barangayCode: '',
  });
  const [addressRestored, setAddressRestored] = useState(false);
  const addressStorageKey = getAddressStorageKey('signup');

  useEffect(() => {
    if (loadingProvinces) return;
    const saved = loadAddressDraft(addressStorageKey);
    if (!saved?.provinceCode) return;
    let cancelled = false;
    (async () => {
      const ok = await hydrateFromSaved(
        {
          provinceCode: saved.provinceCode,
          provinceKind: saved.provinceKind || 'province',
          cityCode: saved.cityCode,
          barangayCode: saved.barangayCode,
          province: saved.province,
          street: saved.street,
        },
        setFormData
      );
      if (cancelled || !ok) return;
      psgcCodesRef.current = {
        provinceCode: saved.provinceCode,
        provinceKind: saved.provinceKind || 'province',
        cityCode: saved.cityCode || '',
        barangayCode: saved.barangayCode || '',
      };
      setAddressRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [addressStorageKey, hydrateFromSaved, loadingProvinces]);

  useEffect(() => {
    const p = provinceOptions.find((o) => o.name === formData.province);
    if (p) {
      psgcCodesRef.current.provinceCode = p.code;
      psgcCodesRef.current.provinceKind = p.kind || 'province';
    } else if (!formData.province?.trim()) {
      psgcCodesRef.current.provinceCode = '';
      psgcCodesRef.current.provinceKind = 'province';
      psgcCodesRef.current.cityCode = '';
      psgcCodesRef.current.barangayCode = '';
    }
  }, [formData.province, provinceOptions]);

  useEffect(() => {
    const c = cityOptions.find((o) => o.name === formData.municipality);
    if (c) {
      psgcCodesRef.current.cityCode = c.code;
    } else if (!formData.municipality?.trim()) {
      psgcCodesRef.current.cityCode = '';
      psgcCodesRef.current.barangayCode = '';
    }
  }, [formData.municipality, cityOptions]);

  useEffect(() => {
    const b = barangayOptions.find((o) => o.name === formData.barangay);
    if (b) {
      psgcCodesRef.current.barangayCode = b.code;
    } else if (!formData.barangay?.trim()) {
      psgcCodesRef.current.barangayCode = '';
    }
  }, [formData.barangay, barangayOptions]);

  useEffect(() => {
    if (!formData.province.trim()) {
      clearAddressDraft(addressStorageKey);
      return;
    }
    const t = window.setTimeout(() => {
      saveAddressDraft(addressStorageKey, {
        province: formData.province.trim(),
        city: formData.municipality.trim(),
        barangay: formData.barangay.trim(),
        street: formData.street.trim(),
        provinceCode: psgcCodesRef.current.provinceCode,
        provinceKind: psgcCodesRef.current.provinceKind,
        cityCode: psgcCodesRef.current.cityCode,
        barangayCode: psgcCodesRef.current.barangayCode,
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    addressStorageKey,
    formData.province,
    formData.municipality,
    formData.barangay,
    formData.street,
  ]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (formError) setFormError('');
  };

  const validateForm = () => {
    let newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (formData.middleInitial && !/^[A-Za-z]$/.test(formData.middleInitial.trim())) {
      newErrors.middleInitial = "Middle initial must be one letter";
    }
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact number is required";
    } else if (!/^[0-9]{10,13}$/.test(formData.contactNumber.trim())) {
      newErrors.contactNumber = "Contact number must be 10-13 digits";
    }
    if (!formData.province.trim()) newErrors.province = "Province is required";
    if (!formData.municipality.trim()) newErrors.municipality = "Municipality / City is required";
    if (!formData.barangay.trim()) newErrors.barangay = "Barangay is required";
    if (!formData.street.trim()) newErrors.street = "Street is required";
    else if (formData.street.trim().length < 2) newErrors.street = "Enter a valid street (at least 2 characters)";
    if (!formData.houseBlockLot.trim()) newErrors.houseBlockLot = "House # / Block / Lot is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format";

    const pwErr = getPasswordPolicyError(formData.password);
    if (pwErr) newErrors.password = pwErr;

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!formData.agreeToTerms) newErrors.agreeToTerms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    if (!isSupabaseConfigured()) {
      setFormError(
        'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.'
      );
      return;
    }

    setSubmitting(true);
    const first = formData.firstName.trim();
    const last = formData.lastName.trim();
    const middle = formData.middleInitial.trim();
    const fullName = middle
      ? `${first} ${middle.toUpperCase()}. ${last}`
      : `${first} ${last}`;

    const province = formData.province.trim();
    const municipality = formData.municipality.trim();
    const barangay = formData.barangay.trim();
    const street = formData.street.trim();
    const houseBlockLot = formData.houseBlockLot.trim();
    const addressLine = [houseBlockLot, street, barangay, municipality, province].filter(Boolean).join(', ');

    const { data, error } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: {
          first_name: first,
          last_name: last,
          middle_initial: middle.toUpperCase() || null,
          full_name: fullName,
          contact_number: formData.contactNumber.trim(),
          province,
          municipality,
          barangay,
          street,
          house_block_lot: houseBlockLot,
          address: addressLine,
          account_type: 'family'
        }
      }
    });
    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    // Best-effort profile write to `public.profiles` for app-level user data.
    if (data.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          full_name: fullName,
          phone: formData.contactNumber.trim(),
          account_type: 'family',
          province,
          municipality,
          barangay,
          street,
          house_block_lot: houseBlockLot
        }, { onConflict: 'id' });

      if (profileError) {
        console.warn('[signup] profile upsert failed:', profileError.message);
      }
    }

    navigate('/login');
  };

  const pwChecks = getPasswordStrengthChecks(formData.password);

  return (
    <div className="signup-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .signup-container {
          min-height: 100vh;
          width: 100%;
          max-width: 100%;
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          box-sizing: border-box;
          position: relative;
          --signup-header-top: 22px;
          --signup-back-size: 42px;
          /* Match .signup-content-wrapper width math so fixed logo sits in the left “gap” */
          /* Same shell / card width / gap as login page */
          --signup-shell: min(1240px, calc(100vw - 40px));
          --signup-gap: 22px;
          --signup-card-track: min(680px, var(--signup-shell));
          --signup-brand-track: max(0px, calc(var(--signup-shell) - var(--signup-gap) - var(--signup-card-track)));
        }

        .signup-brand-fixed {
          display: none;
          position: fixed;
          top: 50%;
          left: calc((100vw - var(--signup-shell)) / 2 + var(--signup-brand-track) / 2);
          transform: translate(-50%, -50%);
          z-index: 0;
          pointer-events: none;
          align-items: center;
          justify-content: center;
          width: min(360px, 34vw, calc(var(--signup-brand-track) - 8px));
          max-width: min(360px, 34vw);
        }

        .signup-brand-fixed img {
          width: 100%;
          max-width: min(360px, 34vw);
          max-height: min(58vh, 420px);
          height: auto;
          object-fit: contain;
          display: block;
        }

        @media (min-width: 901px) {
          .signup-brand-fixed {
            display: flex;
          }
        }

        .signup-content-wrapper {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          width: 100%;
          max-width: min(1240px, 100%);
          margin: 0 auto;
          padding: clamp(28px, 4vh, 40px) clamp(16px, 3vw, 24px) 48px;
          box-sizing: border-box;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
        }

        .signup-form-column {
          width: 100%;
          min-width: 0;
          max-width: min(680px, 100%);
        }

        .signup-card {
          background: #ffffff;
          padding: calc(var(--signup-header-top) + var(--signup-back-size) + 18px) clamp(32px, 4vw, 48px) 46px;
          border-radius: 50px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: min(680px, 100%);
          text-align: center;
          border: 1px solid #f1f5f9;
          position: relative;
          box-sizing: border-box;
        }

        .back-button {
          position: absolute;
          left: clamp(18px, 3.5vw, 26px);
          top: var(--signup-header-top);
          width: var(--signup-back-size);
          height: var(--signup-back-size);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #1B2559;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }

        .back-button:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #F54E25;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
        }

        .back-button:focus-visible {
          outline: 2px solid #F54E25;
          outline-offset: 2px;
        }

        .form-group { text-align: left; margin-bottom: 20px; position: relative; }
        .form-group label {
          display: block;
          font-size: 0.95rem;
          color: #475569;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .form-section-label {
          text-align: left;
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 8px 0 4px 0;
        }

        .input-wrapper { position: relative; display: flex; align-items: center; }

        .input-wrapper input {
          width: 100%;
          padding: 14px 15px 14px 48px;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          font-size: 1rem;
          color: #1e293b;
          background-color: #ffffff;
          outline: none;
          transition: all 0.2s ease;
        }

        .input-wrapper input.input-error {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .error-message {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 5px;
          font-weight: 500;
          margin-left: 4px;
        }

        .password-requirements {
          margin-top: 10px;
          text-align: left;
          font-size: 0.72rem;
          color: #64748b;
          line-height: 1.55;
        }
        .password-requirements .req-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
          font-weight: 500;
        }
        .password-requirements .req-row.met { color: #059669; }
        .password-requirements .req-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1.5px solid #94a3b8;
          flex-shrink: 0;
        }

        .input-wrapper input:focus {
          border-color: #F54E25;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }

        .input-icon { position: absolute; left: 18px; color: #94a3b8; }
        .eye-icon { position: absolute; right: 18px; cursor: pointer; color: #94a3b8; background: none; border: none; display: flex; align-items: center; }

        .terms-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 25px 0 5px 0;
          font-size: 0.9rem;
          color: #64748b;
        }

        .terms-group input[type="checkbox"] {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border: 2px solid #e2e8f0;
          border-radius: 4px;
          background-color: #ffffff;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }

        .terms-group input[type="checkbox"]:checked {
          background-color: #F54E25;
          border-color: #F54E25;
        }

        .terms-group input[type="checkbox"]:checked::after {
          content: '✔';
          position: absolute;
          color: white;
          font-size: 11px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .terms-group span { color: #F54E25; font-weight: 600; cursor: pointer; }

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
          margin-top: 10px;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-prompt { font-size: 1rem; color: #64748b; margin-top: 25px; }
        .login-prompt span { color: #F54E25; font-weight: 700; margin-left: 5px; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          width: 100%;
          max-width: 100%;
          height: 100%;
          min-height: 100dvh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2000;
          backdrop-filter: blur(2px);
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .modal-card {
          background: #ffffff;
          width: calc(100% - 32px);
          max-width: min(850px, 100%);
          max-height: 90vh;
          border-radius: 40px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.2);
          overflow: hidden;
          animation: modalPop 0.3s ease-out;
        }

        @keyframes modalPop {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .modal-close-btn {
          position: absolute;
          right: 30px;
          top: 30px;
          background: none;
          border: none;
          cursor: pointer;
          color: #000;
          z-index: 10;
        }

        .modal-content-area {
          flex: 1;
          overflow-y: auto;
          padding: 50px 60px;
          scrollbar-width: thin;
        }

        .modal-header { text-align: center; margin-bottom: 40px; }
        .modal-header h1 { 
          font-size: 2.2rem; 
          font-weight: 800; 
          margin: 0; 
          letter-spacing: 1px;
          color: #000;
        }
        .modal-header p { 
          font-size: 1rem; 
          color: #475569; 
          margin-top: 5px;
          font-weight: 500;
        }

        .terms-text-container {
          text-align: left;
          color: #1e293b;
          line-height: 1.5;
          font-size: 0.95rem;
        }

        .terms-section { margin-bottom: 25px; }
        .terms-section h3 { 
          font-size: 1rem; 
          font-weight: 700; 
          margin-bottom: 10px; 
          color: #000; 
        }
        .terms-section p { margin: 0; color: #334155; }

        .modal-footer {
          padding: 30px 60px 50px 60px;
          background: #ffffff;
        }

        .btn-modal-agree {
          width: 100%;
          background: #F54E25;
          color: white;
          padding: 18px;
          border: none;
          border-radius: 15px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        @media (max-width: 900px) {
          .signup-brand-fixed { display: none !important; }
          .signup-content-wrapper {
            justify-content: center;
            padding: 24px 16px 40px;
          }
          .signup-form-column { max-width: 100%; }
        }

        @media (max-width: 768px) {
          /* MODAL FIXES: Centralized and slightly bigger */
          .modal-card { 
            width: 95%; /* Increased width */
            max-width: 500px;
            max-height: 88vh; /* Increased height */
            border-radius: 35px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }

          /* CHECKBOX FIXES: Orange background, white checkmark */
          .terms-group input[type="checkbox"] {
            border: 2.5px solid #F54E25; /* Thicker border in brand color */
          }
          
          .terms-group input[type="checkbox"]:checked {
            background-color: #F54E25;
            border-color: #F54E25;
          }

          .terms-group input[type="checkbox"]:checked::after {
            content: '✔';
            color: #ffffff; /* Explicitly white checkmark */
            font-size: 12px;
          }

          .modal-content-area { padding: 45px 30px; }
          .modal-footer { padding: 25px 30px 35px 30px; }
          .modal-header h1 { font-size: 1.8rem; }
          .modal-header p { font-size: 0.9rem; }
          .btn-modal-agree { padding: 18px; font-size: 1.05rem; border-radius: 15px; }
          
          .signup-card { border: none; box-shadow: none; padding: 20px 16px; border-radius: 0; }
          .signup-content-wrapper {
            justify-content: center;
            padding: 16px 12px 32px;
            max-width: 100%;
          }
        }
      `}</style>

      <div className="signup-brand-fixed" aria-hidden="true">
        <img src={logo} alt="" />
      </div>

      <div className="signup-content-wrapper">
        <div className="signup-form-column">
          <div className="signup-card">
            <button
              type="button"
              className="back-button"
              aria-label="Back to login"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={20} strokeWidth={2.25} />
            </button>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label>First Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={22} />
                  <input name="firstName" type="text" placeholder="Enter first name" className={errors.firstName ? 'input-error' : ''} value={formData.firstName} onChange={handleChange} />
                </div>
                {errors.firstName && <div className="error-message">{errors.firstName}</div>}
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={22} />
                  <input name="lastName" type="text" placeholder="Enter last name" className={errors.lastName ? 'input-error' : ''} value={formData.lastName} onChange={handleChange} />
                </div>
                {errors.lastName && <div className="error-message">{errors.lastName}</div>}
              </div>

              <div className="form-group">
                <label>Middle Initial (Optional)</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={22} />
                  <input
                    name="middleInitial"
                    type="text"
                    placeholder="e.g. A"
                    maxLength={1}
                    className={errors.middleInitial ? 'input-error' : ''}
                    value={formData.middleInitial}
                    onChange={handleChange}
                  />
                </div>
                {errors.middleInitial && <div className="error-message">{errors.middleInitial}</div>}
              </div>

              <div className="form-group">
                <label>Contact Number</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={22} />
                  <input
                    name="contactNumber"
                    type="text"
                    placeholder="Enter contact number"
                    className={errors.contactNumber ? 'input-error' : ''}
                    value={formData.contactNumber}
                    onChange={handleChange}
                  />
                </div>
                {errors.contactNumber && <div className="error-message">{errors.contactNumber}</div>}
              </div>

              <AddressFormSection
                fetchError={fetchError}
                onDismissError={() => setFetchError('')}
                restoredHint={
                  addressRestored ? 'We restored your last address on this device. Review and update if needed.' : null
                }
              >
                <PsgcSearchableSelect
                  label="Province"
                  Icon={MapPin}
                  options={provinceOptions}
                  valueName={formData.province}
                  onSelect={(opt) => {
                    void onProvinceSelected(opt, setFormData);
                    if (errors.province) setErrors((prev) => ({ ...prev, province: '' }));
                  }}
                  onClear={() => {
                    onProvinceCleared(setFormData);
                    setErrors((prev) => ({
                      ...prev,
                      province: '',
                      municipality: '',
                      barangay: '',
                      street: '',
                    }));
                  }}
                  disabled={loadingProvinces}
                  loading={loadingProvinces}
                  hasError={!!errors.province}
                  errorText={errors.province || ''}
                  placeholder={loadingProvinces ? 'Loading provinces…' : 'Choose Province'}
                  emptyText="No province matched. Try another spelling."
                />

                <PsgcSearchableSelect
                  label="City / Municipality"
                  Icon={Building2}
                  options={cityOptions}
                  valueName={formData.municipality}
                  onSelect={(opt) => {
                    void onCitySelected(opt, setFormData);
                    if (errors.municipality) setErrors((prev) => ({ ...prev, municipality: '' }));
                  }}
                  onClear={() => {
                    onCityCleared(setFormData);
                    setErrors((prev) => ({ ...prev, municipality: '', barangay: '' }));
                  }}
                  disabled={!formData.province.trim() || loadingCities}
                  loading={loadingCities}
                  hasError={!!errors.municipality}
                  errorText={errors.municipality || ''}
                  placeholder={
                    !formData.province.trim()
                      ? 'Choose Province First'
                      : loadingCities
                        ? 'Loading cities…'
                        : 'Choose City / Municipality'
                  }
                  emptyText={loadingCities ? 'Loading…' : 'No match in this province.'}
                />

                <div className="addr-sec__full">
                  <PsgcSearchableSelect
                    label="Barangay"
                    Icon={Hash}
                    options={barangayOptions}
                    valueName={formData.barangay}
                    onSelect={(opt) => {
                      onBarangaySelected(opt, setFormData);
                      if (errors.barangay) setErrors((prev) => ({ ...prev, barangay: '' }));
                    }}
                    onClear={() => {
                      onBarangayCleared(setFormData);
                      setErrors((prev) => ({ ...prev, barangay: '' }));
                    }}
                    disabled={!formData.municipality.trim() || loadingBarangays}
                    loading={loadingBarangays}
                    hasError={!!errors.barangay}
                    errorText={errors.barangay || ''}
                    placeholder={
                      !formData.municipality.trim()
                        ? 'Choose City First'
                        : loadingBarangays
                          ? 'Loading barangays…'
                          : 'Choose Barangay'
                    }
                    emptyText={loadingBarangays ? 'Loading…' : 'No barangay matched.'}
                  />
                </div>

                <div className="addr-sec__full">
                  <StreetAddressInput
                    label="Street / Building Line"
                    description="Block, lot, street, building, or subdivision (not in the lists above)."
                    placeholder="Enter block, lot, street, or building (e.g. Blk 2 Lot 15)"
                    value={formData.street}
                    onChange={handleChange}
                    errorText={errors.street || ''}
                  />
                </div>
              </AddressFormSection>

              <div className="form-group">
                <label>House # / Block / Lot</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={22} />
                  <input name="houseBlockLot" type="text" placeholder="e.g. Blk 2 Lot 15" className={errors.houseBlockLot ? 'input-error' : ''} value={formData.houseBlockLot} onChange={handleChange} />
                </div>
                {errors.houseBlockLot && <div className="error-message">{errors.houseBlockLot}</div>}
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={22} />
                  <input name="email" type="email" placeholder="Enter your email" className={errors.email ? 'input-error' : ''} value={formData.email} onChange={handleChange} />
                </div>
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={22} />
                  <input name="password" type={showPassword ? "text" : "password"} placeholder="Create Password" className={errors.password ? 'input-error' : ''} value={formData.password} onChange={handleChange} />
                  <button type="button" className="eye-icon" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={22} /> : <Eye size={22} />}</button>
                </div>
                {errors.password && <div className="error-message">{errors.password}</div>}
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
                    One special character (! @ # $ % …)
                  </div>
                  <div className={`req-row ${pwChecks.noSpaces ? 'met' : ''}`}>
                    {pwChecks.noSpaces ? <CheckCircle size={13} /> : <span className="req-dot" />}
                    No spaces
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={22} />
                  <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" className={errors.confirmPassword ? 'input-error' : ''} value={formData.confirmPassword} onChange={handleChange} />
                  <button type="button" className="eye-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}</button>
                </div>
                {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
              </div>

              <div className="terms-group">
                <input type="checkbox" name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} />
                <p>I agree to the <span onClick={() => setShowTermsModal(true)}>Privacy Policy</span> and <span onClick={() => setShowTermsModal(true)}>Terms</span></p>
              </div>
              {errors.agreeToTerms && <div className="error-message" style={{ textAlign: 'center', marginBottom: '10px' }}>{errors.agreeToTerms}</div>}

              {formError && (
                <div className="error-message" style={{ textAlign: 'center', marginBottom: '12px' }}>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create Account'}
              </button>
              <p className="login-prompt">Already have an account? <Link to="/login" style={{ textDecoration: 'none' }}><span>Sign In</span></Link></p>
            </form>
          </div>
        </div>
      </div>

      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowTermsModal(false)}>
              <X size={28} />
            </button>

            <div className="modal-content-area">
              <div className="modal-header">
                <h1>TERMS AND CONDITION OF USE</h1>
                <p>Clinic Admission and Patient Management System</p>
              </div>

              <div className="terms-text-container">
                <div className="terms-section">
                  <h3>1. Acceptance of Terms</h3>
                  <p>By accessing, registering, or using this application and web system (“the System”), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the System immediately.</p>
                </div>

                <div className="terms-section">
                  <h3>2. Purpose of the System</h3>
                  <p>The System is designed to facilitate admission processing, patient record management, scheduling, monitoring, and communication between the clinic, patients, and authorized guardians. The System supports administrative and informational functions only and does not replace professional medical judgment, diagnosis, or treatment.</p>
                </div>

                <div className="terms-section">
                  <h3>3. User Eligibility and Accounts</h3>
                  <p>Users must provide accurate and complete information during registration and admission application. Guardians submitting applications on behalf of patients confirm they are legally authorized to provide the patient’s information. Users are responsible for maintaining the confidentiality of their login credentials and all activities performed under their account.</p>
                </div>

                <div className="terms-section">
                  <h3>4. Data Collection and Privacy</h3>
                  <p>The System collects personal and health-related information necessary for admission processing, monitoring, and care coordination. By using the System, you consent to the storage and processing of submitted information within the secure clinic database. Access to records is restricted to authorized personnel only and handled in accordance with applicable data privacy regulations and institutional policies.</p>
                </div>

                <div className="terms-section">
                  <h3>5. Accuracy of Information</h3>
                  <p>Users agree to provide truthful, current, and complete information. Submission of false, misleading, or incomplete data may result in delayed admission processing, suspension of account access, or rejection of applications.</p>
                </div>

                <div className="terms-section">
                  <h3>6. Communication and Notification</h3>
                  <p>The System may send notifications regarding admission status, schedules, updates, and relevant announcements. These notifications are informational and should not be interpreted as medical advice or emergency instructions.</p>
                </div>

                <div className="terms-section">
                  <h3>7. System Availability</h3>
                  <p>The clinic will make reasonable efforts to maintain continuous system availability. However, temporary interruptions may occur due to maintenance, updates, technical issues, or network conditions. The clinic is not liable for delays caused by such interruptions.</p>
                </div>

                <div className="terms-section">
                  <h3>8. Acceptable Use</h3>
                  <p>Users agree not to misuse the System. Prohibited actions include unauthorized access, attempting to alter records without permission, uploading harmful content, sharing accounts, or interfering with system operations. Violations may result in account suspension and further action as permitted by law.</p>
                </div>

                <div className="terms-section">
                  <h3>9. Record Access and Confidentiality</h3>
                  <p>Patient records are confidential and may only be accessed by authorized staff and the registered patient or guardian. Users agree not to share retrieved information with unauthorized individuals and to respect the privacy of all patients within the System.</p>
                </div>

                <div className="terms-section">
                  <h3>10. Limitation of Liability</h3>
                  <p>The System is intended to support administrative processes. The clinic is not responsible for decisions made solely based on system information without consultation with qualified healthcare professionals. The System does not provide emergency medical services.</p>
                </div>

                <div className="terms-section">
                  <h3>11. Modifications to Terms</h3>
                  <p>The clinic reserves the right to modify these Terms and Conditions at any time. Continued use of the System after updates indicates acceptance of the revised terms.</p>
                </div>

                <div className="terms-section">
                  <h3>12. Termination of Access</h3>
                  <p>The clinic may suspend or terminate access if users violate these Terms, misuse the System, or compromise security or patient confidentiality.</p>
                </div>

                <div className="terms-section">
                  <h3>13. Contact Information</h3>
                  <p>For questions, corrections to records, or concerns regarding these Terms, users may contact the clinic administration through the official communication channels provided within the System.</p>
                </div>

                <p style={{ marginTop: '30px', fontWeight: '500' }}>
                  By selecting <strong>“I Agree”</strong> or <strong>continuing to use the System</strong>, you confirm your acceptance of these Terms and Conditions.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-modal-agree"
                onClick={() => {
                  setFormData(prev => ({ ...prev, agreeToTerms: true }));
                  setShowTermsModal(false);
                }}
              >
                I agree to the Privacy Policy and Terms of Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignUp;