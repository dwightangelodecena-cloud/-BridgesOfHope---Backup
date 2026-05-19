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
import { PRIVACY_POLICY, TERMS_OF_USE } from '@/lib/legalDocuments';
import LegalDocumentModal from '@/components/auth/LegalDocumentModal';

const SignUp = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
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
    agreeToTerms: false,
    agreeToPrivacy: false,
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

  const canCreateAccount =
    hasReadTerms
    && hasReadPrivacy
    && formData.agreeToTerms
    && formData.agreeToPrivacy;

  useEffect(() => {
    if (hasReadTerms) {
      setFormData((prev) => (prev.agreeToTerms ? prev : { ...prev, agreeToTerms: true }));
    }
  }, [hasReadTerms]);

  useEffect(() => {
    if (hasReadPrivacy) {
      setFormData((prev) => (prev.agreeToPrivacy ? prev : { ...prev, agreeToPrivacy: true }));
    }
  }, [hasReadPrivacy]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && checked) {
      if (name === 'agreeToTerms' && !hasReadTerms) return;
      if (name === 'agreeToPrivacy' && !hasReadPrivacy) return;
    }
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
    if (!hasReadTerms) newErrors.agreeToTerms = 'Please read the Terms and Conditions of Use to the end.';
    else if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the Terms and Conditions of Use.';
    if (!hasReadPrivacy) newErrors.agreeToPrivacy = 'Please read the Privacy Policy to the end.';
    else if (!formData.agreeToPrivacy) newErrors.agreeToPrivacy = 'You must agree to the Privacy Policy.';

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
    try {
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

      if (error) {
        setFormError(formatAuthError(error));
        return;
      }

      if (!data.user) {
        setFormError('Sign up did not complete. Please try again.');
        return;
      }

      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setFormError('This email is already registered. Try signing in or use Forgot password.');
        return;
      }

      // When a session exists (e.g. email confirmation off), RLS allows this upsert.
      // Otherwise `handle_new_user_profile` trigger creates the row after deploy.
      if (data.user.id) {
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

      const needsEmailConfirm = !data.session;
      sessionStorage.setItem('bh_post_signup', needsEmailConfirm ? 'check_email' : 'welcome');
      navigate('/login');
    } finally {
      setSubmitting(false);
    }
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

        .terms-accept-list {
          margin: 20px 0 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          text-align: left;
        }

        .terms-group {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 10px;
          width: 100%;
          font-size: 0.9rem;
          color: #64748b;
          text-align: left;
        }

        .terms-group--disabled input[type="checkbox"] {
          opacity: 0.45;
        }

        .terms-group p {
          margin: 0;
          line-height: 1.45;
          flex: 1;
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

        .terms-group span.link {
          color: #F54E25;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
        }
        .terms-group span.link:hover { color: #E04820; }
        .terms-group input[type="checkbox"]:disabled { cursor: not-allowed; }

        .legal-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2000;
          backdrop-filter: blur(2px);
        }

        .legal-modal-card {
          background: #fff;
          width: calc(100% - 32px);
          max-width: min(850px, 100%);
          max-height: 90vh;
          border-radius: 24px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.2);
          overflow: hidden;
        }

        .legal-modal-close {
          position: absolute;
          right: 20px;
          top: 20px;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 2;
        }

        .legal-modal-header {
          text-align: center;
          padding: 36px 48px 12px;
        }

        .legal-modal-header h1 {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
          color: #000;
        }

        .legal-modal-header p {
          margin: 6px 0 0;
          color: #475569;
          font-size: 0.95rem;
        }

        .legal-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 48px 20px;
          scrollbar-width: thin;
        }

        .legal-modal-section {
          margin-bottom: 20px;
        }

        .legal-modal-section h3 {
          font-size: 0.95rem;
          font-weight: 700;
          margin: 0 0 8px;
          color: #000;
        }

        .legal-modal-section p {
          margin: 0;
          color: #334155;
          line-height: 1.5;
          font-size: 0.9rem;
        }

        .legal-modal-footer-text {
          margin-top: 16px;
          font-weight: 500;
          color: #334155;
        }

        .legal-modal-scroll-hint {
          text-align: center;
          color: #F54E25;
          font-size: 0.85rem;
          font-weight: 600;
          margin: 16px 0 0;
        }

        .legal-modal-actions {
          padding: 16px 48px 28px;
        }

        .legal-modal-confirm {
          width: 100%;
          background: #F54E25;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .legal-modal-confirm:disabled {
          opacity: 0.45;
          cursor: not-allowed;
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

              <div className="terms-accept-list">
                <label className={`terms-group ${!hasReadTerms ? 'terms-group--disabled' : ''}`}>
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                    disabled={!hasReadTerms}
                  />
                  <p>
                    I have read and agree to the{' '}
                    <span
                      className="link"
                      role="button"
                      tabIndex={0}
                      onClick={() => setLegalModal('terms')}
                      onKeyDown={(e) => e.key === 'Enter' && setLegalModal('terms')}
                    >
                      Terms and Conditions of Use
                    </span>
                    {!hasReadTerms ? ' (open and scroll to the end first)' : ''}
                  </p>
                </label>
                {errors.agreeToTerms && <div className="error-message">{errors.agreeToTerms}</div>}

                <label className={`terms-group ${!hasReadPrivacy ? 'terms-group--disabled' : ''}`}>
                  <input
                    type="checkbox"
                    name="agreeToPrivacy"
                    checked={formData.agreeToPrivacy}
                    onChange={handleChange}
                    disabled={!hasReadPrivacy}
                  />
                  <p>
                    I have read and agree to the{' '}
                    <span
                      className="link"
                      role="button"
                      tabIndex={0}
                      onClick={() => setLegalModal('privacy')}
                      onKeyDown={(e) => e.key === 'Enter' && setLegalModal('privacy')}
                    >
                      Privacy Policy
                    </span>
                    {!hasReadPrivacy ? ' (open and scroll to the end first)' : ''}
                  </p>
                </label>
                {errors.agreeToPrivacy && <div className="error-message">{errors.agreeToPrivacy}</div>}
              </div>

              {formError && (
                <div className="error-message" style={{ textAlign: 'center', marginBottom: '12px' }}>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={submitting || !canCreateAccount}>
                {submitting ? 'Creating account…' : 'Create Account'}
              </button>
              <p className="login-prompt">Already have an account? <Link to="/login" style={{ textDecoration: 'none' }}><span>Sign In</span></Link></p>
            </form>
          </div>
        </div>
      </div>


      <LegalDocumentModal
        open={legalModal === 'terms'}
        document={TERMS_OF_USE}
        onClose={() => setLegalModal(null)}
        onConfirmRead={() => {
          setHasReadTerms(true);
          setFormData((prev) => ({ ...prev, agreeToTerms: true }));
        }}
        confirmLabel="I have read the Terms and Conditions of Use"
      />
      <LegalDocumentModal
        open={legalModal === 'privacy'}
        document={PRIVACY_POLICY}
        onClose={() => setLegalModal(null)}
        onConfirmRead={() => {
          setHasReadPrivacy(true);
          setFormData((prev) => ({ ...prev, agreeToPrivacy: true }));
        }}
        confirmLabel="I have read the Privacy Policy"
      />

    </div>
  );
};

export default SignUp;