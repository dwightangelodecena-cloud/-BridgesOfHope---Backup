import React, { useEffect, useRef, useState } from 'react';
import { Home, User, LogOut, Bell, CheckCircle2, CheckCircle, Mail, Phone, Calendar, ClipboardList, MapPin, Building2, Hash, BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData, APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { FAMILY_COLORS } from '@/components/family/shared/ui';
import { PsgcSearchableSelect } from '@/components/address/PsgcSearchableSelect';
import { AddressFormSection, StreetAddressInput } from '@/components/address/AddressFormSection';
import { usePsgcAddressCascade } from '@/hooks/usePsgcAddressCascade';
import { getAddressStorageKey, loadAddressDraft, saveAddressDraft, clearAddressDraft } from '@/lib/addressPersistence';
import logo from '@/assets/logo2.png';

const Progress = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userInitials, setUserInitials] = useState('FU');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationItems, setNotificationItems] = useState([
    'Submit missing laboratory result before Friday.',
    'Family support session is scheduled on April 5, 10:00 AM.',
    'Weekly report reviewed by your assigned counselor.',
  ]);
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const patientBirthdayInputRef = useRef(null);
  const [patients, setPatients] = useState([]);
  const [activeTab, setActiveTab] = useState('admission');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [admissionForm, setAdmissionForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    province: '',
    municipalityCity: '',
    street: '',
    barangay: '',
    patientLastName: '',
    patientFirstName: '',
    patientMiddleName: '',
    patientGender: '',
    patientBirthday: '',
    reasonForAdmission: '',
    agreeToTerms: false,
  });
  const [admissionErrors, setAdmissionErrors] = useState({});

  const [dischargeForm, setDischargeForm] = useState({
    reasonCategory: '',
    reasonDetails: '',
    preferredDate: '',
    pickupAuthorized: '',
    followUpPhone: '',
    otherInfo: '',
  });
  const [dischargeErrors, setDischargeErrors] = useState({});
  const [addressRestored, setAddressRestored] = useState(false);
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
  } = usePsgcAddressCascade({ cityFieldKey: 'municipalityCity' });
  const psgcCodesRef = useRef({
    provinceCode: '',
    provinceKind: 'province',
    cityCode: '',
    barangayCode: '',
  });
  const psgcStorageKey = getAddressStorageKey('request_management_admission');
  const admissionRequiredFields = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email Address' },
    { key: 'phoneNumber', label: 'Phone Number' },
    { key: 'province', label: 'Province' },
    { key: 'municipalityCity', label: 'Municipality/City' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'street', label: 'Street' },
    { key: 'patientLastName', label: 'Patient Last Name' },
    { key: 'patientFirstName', label: 'Patient First Name' },
    { key: 'patientMiddleName', label: 'Patient Middle Name' },
    { key: 'patientGender', label: 'Patient Gender' },
    { key: 'patientBirthday', label: 'Patient Birthday' },
    { key: 'reasonForAdmission', label: 'Reason for Admission' },
  ];
  const admissionCompletedFields = admissionRequiredFields.filter((field) => String(admissionForm[field.key]).trim()).length;
  const admissionProgressPercent = Math.round((admissionCompletedFields / admissionRequiredFields.length) * 100);

  const getPatientFullName = (form = admissionForm) =>
    [form.patientFirstName, form.patientMiddleName, form.patientLastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');

  useEffect(() => {
    const requestedTab = location.state?.tab;
    if (requestedTab === 'admission' || requestedTab === 'discharge') {
      setActiveTab(requestedTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (loadingProvinces) return;
    const saved = loadAddressDraft(psgcStorageKey);
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
        setAdmissionForm
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
  }, [loadingProvinces, psgcStorageKey, hydrateFromSaved]);

  useEffect(() => {
    const p = provinceOptions.find((o) => o.name === admissionForm.province);
    if (p) {
      psgcCodesRef.current.provinceCode = p.code;
      psgcCodesRef.current.provinceKind = p.kind || 'province';
    } else if (!admissionForm.province?.trim()) {
      psgcCodesRef.current.provinceCode = '';
      psgcCodesRef.current.provinceKind = 'province';
      psgcCodesRef.current.cityCode = '';
      psgcCodesRef.current.barangayCode = '';
    }
  }, [admissionForm.province, provinceOptions]);

  useEffect(() => {
    const c = cityOptions.find((o) => o.name === admissionForm.municipalityCity);
    if (c) {
      psgcCodesRef.current.cityCode = c.code;
    } else if (!admissionForm.municipalityCity?.trim()) {
      psgcCodesRef.current.cityCode = '';
      psgcCodesRef.current.barangayCode = '';
    }
  }, [admissionForm.municipalityCity, cityOptions]);

  useEffect(() => {
    const b = barangayOptions.find((o) => o.name === admissionForm.barangay);
    if (b) {
      psgcCodesRef.current.barangayCode = b.code;
    } else if (!admissionForm.barangay?.trim()) {
      psgcCodesRef.current.barangayCode = '';
    }
  }, [admissionForm.barangay, barangayOptions]);

  useEffect(() => {
    if (!admissionForm.province.trim()) {
      clearAddressDraft(psgcStorageKey);
      return;
    }
    const t = window.setTimeout(() => {
      saveAddressDraft(psgcStorageKey, {
        province: admissionForm.province.trim(),
        city: admissionForm.municipalityCity.trim(),
        barangay: admissionForm.barangay.trim(),
        street: admissionForm.street.trim(),
        provinceCode: psgcCodesRef.current.provinceCode,
        provinceKind: psgcCodesRef.current.provinceKind,
        cityCode: psgcCodesRef.current.cityCode,
        barangayCode: psgcCodesRef.current.barangayCode,
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [psgcStorageKey, admissionForm.province, admissionForm.municipalityCity, admissionForm.barangay, admissionForm.street]);

  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      if (!isSupabaseConfigured()) {
        const saved = localStorage.getItem('bh_patients');
        if (!cancelled) setPatients(saved ? JSON.parse(saved) : []);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setPatients([]);
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at')
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setPatients([]);
        return;
      }
      setPatients((data || []).map((r) => uiPatientFromRow(r)).filter(Boolean));
    };
    loadPatients();
    window.addEventListener('storage', loadPatients);
    window.addEventListener(APP_DATA_REFRESH, loadPatients);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', loadPatients);
      window.removeEventListener(APP_DATA_REFRESH, loadPatients);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const deriveInitials = (name) =>
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'FU';
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const fallbackProfile = localStorage.getItem('bh_family_profile');
      const fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;
      let resolvedName =
        user?.user_metadata?.full_name ||
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
        fallbackName ||
        'Family User';
      if (user?.id) {
        const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        if (profileRow?.full_name) resolvedName = profileRow.full_name;
      }
      if (isMounted) {
        setUserInitials(deriveInitials(resolvedName));
      }
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const onDoc = (e) => {
      const t = e.target;
      const inDesktop = notificationsDesktopRef.current?.contains(t);
      const inMobile = notificationsMobileRef.current?.contains(t);
      if (!inDesktop && !inMobile) setShowNotifications(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showNotifications]);

  const addProcessingNotification = () => {
    setNotificationItems((prev) => ['Your request is being processed.', ...prev]);
  };

  const handleAdmissionChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAdmissionForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (admissionErrors[name]) {
      setAdmissionErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const openBirthdayPicker = () => {
    const input = patientBirthdayInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const validateAdmission = () => {
    const errs = {};
    if (!admissionForm.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!admissionForm.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(admissionForm.email)) errs.email = 'Invalid email format.';
    if (!admissionForm.phoneNumber.trim()) errs.phoneNumber = 'Phone number is required.';
    if (!admissionForm.province.trim()) errs.province = 'Province is required.';
    if (!admissionForm.municipalityCity.trim()) errs.municipalityCity = 'Municipality/City is required.';
    if (!admissionForm.street.trim()) errs.street = 'Street is required.';
    if (!admissionForm.barangay.trim()) errs.barangay = 'Barangay is required.';
    if (!admissionForm.patientLastName.trim()) errs.patientLastName = 'Patient last name is required.';
    if (!admissionForm.patientFirstName.trim()) errs.patientFirstName = 'Patient first name is required.';
    if (!admissionForm.patientMiddleName.trim()) errs.patientMiddleName = 'Patient middle name is required.';
    if (!admissionForm.patientGender.trim()) errs.patientGender = 'Patient gender is required.';
    if (!admissionForm.patientBirthday) errs.patientBirthday = 'Patient birthday is required.';
    if (!admissionForm.reasonForAdmission) errs.reasonForAdmission = 'Please select a reason.';
    if (!admissionForm.agreeToTerms) errs.agreeToTerms = 'You must agree to the terms.';
    setAdmissionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateDischarge = () => {
    const errs = {};
    if (!selectedPatientId) errs.selectedPatientId = 'Please select a patient.';
    if (!dischargeForm.reasonCategory) errs.reasonCategory = 'Please select a reason.';
    if (!dischargeForm.reasonDetails.trim() || dischargeForm.reasonDetails.trim().length < 15) {
      errs.reasonDetails = 'Reason details must be at least 15 characters.';
    }
    setDischargeErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitAdmission = async () => {
    if (!isSupabaseConfigured()) {
      setAdmissionErrors({ submit: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.' });
      return;
    }
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      setAdmissionErrors({ submit: 'Please sign in to submit an admission request.' });
      return;
    }
    const extendedRow = {
      family_id: user.id,
      guardian_full_name: admissionForm.fullName.trim(),
      guardian_email: admissionForm.email.trim(),
      guardian_phone: admissionForm.phoneNumber.trim(),
      guardian_province: admissionForm.province.trim(),
      guardian_municipality_city: admissionForm.municipalityCity.trim(),
      guardian_street: admissionForm.street.trim(),
      guardian_barangay: admissionForm.barangay.trim(),
      patient_name: getPatientFullName(),
      patient_last_name: admissionForm.patientLastName.trim(),
      patient_first_name: admissionForm.patientFirstName.trim(),
      patient_middle_name: admissionForm.patientMiddleName.trim(),
      patient_gender: admissionForm.patientGender.trim(),
      patient_birth_date: admissionForm.patientBirthday,
      reason_for_admission: admissionForm.reasonForAdmission,
    };
    let { error } = await supabase.from('admission_requests').insert(extendedRow);
    if (error && /column|schema cache|does not exist|PGRST204/i.test(error.message)) {
      const minimalRow = {
        family_id: user.id,
        guardian_full_name: admissionForm.fullName.trim(),
        guardian_email: admissionForm.email.trim(),
        guardian_phone: admissionForm.phoneNumber.trim(),
        patient_name: getPatientFullName(),
        patient_birth_date: admissionForm.patientBirthday,
        reason_for_admission: admissionForm.reasonForAdmission,
      };
      ({ error } = await supabase.from('admission_requests').insert(minimalRow));
    }
    if (error) {
      setAdmissionErrors({ submit: error.message || 'Could not submit request.' });
      return;
    }
    await appendActivityFeed(`Admission request submitted for ${getPatientFullName()}. Pending admin review.`, { familyId: user.id });
    refreshAppData();
    addProcessingNotification();
    setAdmissionForm({
      fullName: '',
      email: '',
      phoneNumber: '',
      province: '',
      municipalityCity: '',
      street: '',
      barangay: '',
      patientLastName: '',
      patientFirstName: '',
      patientMiddleName: '',
      patientGender: '',
      patientBirthday: '',
      reasonForAdmission: '',
      agreeToTerms: false,
    });
    setSuccessModal({ open: true, message: 'Admission request submitted successfully.' });
  };

  const submitDischarge = async () => {
    const selectedPatient = patients.find((p) => String(p.id) === String(selectedPatientId));
    if (!selectedPatient) return;
    if (!isSupabaseConfigured()) {
      const pending = JSON.parse(localStorage.getItem('bh_pending_discharges') || '[]');
      pending.push({
        id: Date.now(),
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.name,
        reason_category: dischargeForm.reasonCategory,
        reason_details: dischargeForm.reasonDetails.trim(),
        preferred_discharge_date: dischargeForm.preferredDate || null,
        pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
        follow_up_phone: dischargeForm.followUpPhone.trim() || null,
        other_info: dischargeForm.otherInfo.trim() || null,
        status: 'pending',
      });
      localStorage.setItem('bh_pending_discharges', JSON.stringify(pending));
      window.dispatchEvent(new Event('storage'));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setDischargeErrors({ submit: 'Please sign in to submit a discharge request.' });
        return;
      }
      const { error } = await supabase.from('discharge_requests').insert({
        patient_id: selectedPatient.id,
        family_id: user.id,
        reason_category: dischargeForm.reasonCategory,
        reason_details: dischargeForm.reasonDetails.trim(),
        preferred_discharge_date: dischargeForm.preferredDate || null,
        pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
        follow_up_phone: dischargeForm.followUpPhone.trim() || null,
        other_info: dischargeForm.otherInfo.trim() || null,
        status: 'pending',
      });
      if (error) {
        setDischargeErrors({ submit: error.message });
        return;
      }
      await appendActivityFeed(`Discharge request submitted for ${selectedPatient.name}. Awaiting admin review.`, { familyId: user.id });
      refreshAppData();
    }
    addProcessingNotification();
    setDischargeForm({
      reasonCategory: '',
      reasonDetails: '',
      preferredDate: '',
      pickupAuthorized: '',
      followUpPhone: '',
      otherInfo: '',
    });
    setSelectedPatientId('');
    setSuccessModal({ open: true, message: 'Discharge request submitted successfully.' });
  };

  const handlePrimarySubmit = () => {
    if (activeTab === 'admission') {
      if (!validateAdmission()) return;
      setConfirmModal({ open: true, type: 'admission' });
      return;
    }
    if (!validateDischarge()) return;
    setConfirmModal({ open: true, type: 'discharge' });
  };

  const confirmSubmit = async () => {
    const type = confirmModal.type;
    setConfirmModal({ open: false, type: null });
    if (type === 'admission') await submitAdmission();
    if (type === 'discharge') await submitDischarge();
  };

  return (
    <div className="progress-container">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .progress-container { display: flex; width: 100vw; height: 100vh; background: #F4F7FE; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
        .sidebar { width: ${isExpanded ? '280px' : '110px'}; background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; padding: 25px 0 170px; z-index: 100; transition: width 0.3s; cursor: pointer; position: relative; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '180px' : '70px'}; transition: width 0.3s; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; min-height: 52px; box-sizing: border-box; border: 2px solid transparent; border-radius: 12px; color: #707EAE; }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; color: #707EAE; }
        .sidebar-primary { width: 100%; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-nav { height: 85px; background: white; display: flex; align-items: center; padding: 0 30px; border-bottom: 1px solid #F1F1F1; }
        .top-nav-left { display: flex; align-items: center; gap: 40px; }
        .view-title { color: #F54E25; font-weight: 800; font-size: 24px; line-height: 1.2; }
        .top-nav-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
        .user-avatar-top { width: 40px; height: 40px; background: #F54E25; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
        .notifications-dropdown { position: absolute; top: calc(100% + 10px); right: 0; width: min(360px, calc(100vw - 48px)); background: white; border: 1px solid #E9EDF7; border-radius: 14px; box-shadow: 0 12px 40px rgba(27,37,89,.12); padding: 16px; z-index: 500; }
        .notifications-trigger {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          border-radius: 50%;
          border: none;
          background: #F54E25;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          padding: 0;
          line-height: 0;
        }
        .notifications-trigger svg {
          width: 20px;
          height: 20px;
          stroke: #ffffff;
          color: #ffffff;
          display: block;
          flex-shrink: 0;
        }
        .notif-dropdown-title { color: #1B2559; font-weight: 800; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .notif-dropdown-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #334155; font-size: 13px; }
        .content-area { flex: 1; padding: 24px 30px 30px; overflow-y: auto; }
        .content-wrap { width: 100%; max-width: 1600px; margin: 0 auto; }
        .request-shell { background: #fff; border: 1px solid #E9EDF7; border-radius: 20px; padding: 22px; min-height: calc(100vh - 170px); display: flex; flex-direction: column; }
        .heading { color: #1B2559; font-size: 24px; font-weight: 800; line-height: 1.2; }
        .subheading { margin-top: 6px; color: #64748B; font-size: 14px; font-weight: 600; }
        .tabs { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .tab-btn { border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 12px; padding: 12px; font-weight: 800; color: #334155; cursor: pointer; }
        .tab-btn.active { background: #FFF5F1; border-color: #F54E25; color: #F54E25; }
        .form-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-content: start; }
        .full { grid-column: 1 / -1; }
        .field label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .field input, .field textarea, .field select { width: 100%; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; font-size: 14px; color: #1B2559; background: #fff; }
        .field textarea { min-height: 100px; resize: vertical; }
        .error { color: #DC2626; font-size: 12px; margin-top: 4px; font-weight: 600; }
        .meta-card { border: 1px solid #E9EDF7; background: #FAFCFF; border-radius: 14px; padding: 12px; margin-top: 14px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 12px; color: #94A3B8; pointer-events: none; }
        .input-wrapper input, .input-wrapper select { padding-left: 42px; }
        .input-icon-btn { position: absolute; right: 10px; border: none; background: transparent; color: #64748B; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 4px; border-radius: 8px; }
        .input-icon-btn:hover { background: #EEF2FF; color: #1B2559; }
        .input-date { padding-right: 38px !important; }
        .date-field-hint { font-size: 12px; color: #94a3b8; margin-top: 6px; }
        .empty-patient { margin-top: 16px; border: 1px dashed #D4DFEE; background: #F8FBFF; border-radius: 12px; padding: 22px; text-align: center; color: #64748B; font-weight: 700; }
        .submit-row { margin-top: auto; padding-top: 20px; display: flex; justify-content: flex-end; }
        .primary-btn { background: #F54E25; color: #fff; border: none; border-radius: 12px; padding: 12px 22px; font-weight: 800; cursor: pointer; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 7000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-box { background: #fff; border-radius: 18px; width: 100%; max-width: 430px; padding: 24px; text-align: center; }
        .modal-title {
          color: #1B2559;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 10px;
        }
        .modal-body-text {
          color: #64748B;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .terms-modal {
          background: #fff;
          width: 100%;
          max-width: 840px;
          max-height: 88vh;
          border-radius: 22px;
          border: 1px solid #E7ECF5;
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.28);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .terms-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 20px 22px 16px;
          border-bottom: 1px solid #EDF2F8;
          background: linear-gradient(180deg, #fff9f6 0%, #ffffff 80%);
        }
        .terms-modal-title {
          color: #1B2559;
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.2;
        }
        .terms-modal-subtitle {
          color: #64748B;
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 600;
        }
        .terms-close-btn {
          border: none;
          background: #F8FAFC;
          color: #64748B;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          flex-shrink: 0;
        }
        .terms-close-btn:hover { background: #EEF2FF; color: #1B2559; }
        .terms-modal-body {
          padding: 18px 22px;
          overflow-y: auto;
          background: #FCFDFF;
        }
        .terms-section {
          background: #fff;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .terms-section strong {
          color: #1B2559;
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
        }
        .terms-section p {
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }
        .terms-modal-footer {
          padding: 14px 22px 20px;
          border-top: 1px solid #EDF2F8;
          background: #fff;
        }
        .mobile-top-bar, .mobile-bottom-nav { display: none; }
        @media (max-width: 768px) {
          .sidebar, .top-nav { display: none; }
          .progress-container { flex-direction: column; overflow: auto; min-height: 100vh; height: auto; }
          .main-view { overflow: visible; }
          .mobile-top-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #fff; border-bottom: 1px solid #F1F1F1; }
          .content-area { padding: 16px 14px 100px; overflow: visible; }
          .request-shell { min-height: auto; }
          .form-grid { grid-template-columns: 1fr; }
          .mobile-bottom-nav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; height: 74px; background: #fff; border-top: 1px solid #F1F1F1; justify-content: space-around; align-items: center; z-index: 500; }
          .terms-modal { max-height: 90vh; border-radius: 16px; }
          .terms-modal-header, .terms-modal-body, .terms-modal-footer { padding-left: 14px; padding-right: 14px; }
          .terms-modal-title,
          .modal-title,
          .heading,
          .view-title { font-size: 20px; }
        }
      `}</style>

      <aside className="sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="BH" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap"><BarChart3 size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Reports</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><User size={22} /><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><LogOut size={22} color="#F54E25" /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      <main className="main-view">
        <header className="top-nav">
          <div className="top-nav-left"><span className="view-title">Request Management</span></div>
          <div className="top-nav-actions">
            <div ref={notificationsDesktopRef} style={{ position: 'relative' }}>
              <button type="button" className="notifications-trigger" aria-expanded={showNotifications} aria-label="Notifications" onClick={() => setShowNotifications((v) => !v)}>
                <Bell size={20} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notif-dropdown-title"><Bell size={16} color="#F54E25" /> Notifications</div>
                  {notificationItems.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="notif-dropdown-row"><CheckCircle2 size={15} color="#2B31ED" /><span>{item}</span></div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="user-avatar-top" onClick={() => navigate('/profile')} aria-label="Open profile" style={{ border: 'none', cursor: 'pointer' }}>{userInitials}</button>
          </div>
        </header>

        <div className="mobile-top-bar">
          <img src={logo} alt="BH" style={{ width: 48 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notificationsMobileRef} style={{ position: 'relative' }}>
              <button type="button" className="notifications-trigger" aria-expanded={showNotifications} aria-label="Notifications" onClick={() => setShowNotifications((v) => !v)}>
                <Bell size={18} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notif-dropdown-title"><Bell size={16} color="#F54E25" /> Notifications</div>
                  {notificationItems.map((item, idx) => (
                    <div key={`${item}-m-${idx}`} className="notif-dropdown-row"><CheckCircle2 size={15} color="#2B31ED" /><span>{item}</span></div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => navigate('/profile')} aria-label="Open profile" style={{ width: 34, height: 34, background: '#F54E25', color: '#fff', borderRadius: '50%', border: 'none', fontWeight: 700 }}>{userInitials}</button>
          </div>
        </div>

        <div className="content-area" style={{ background: FAMILY_COLORS.background }}>
          <div className="content-wrap">
            <div className="request-shell">
              <div className="heading"><span style={{ color: '#F54E25' }}>Request</span> Management</div>
              <div className="subheading">Submit and track admission or discharge requests from one place.</div>

              <div className="tabs">
                <button className={`tab-btn ${activeTab === 'admission' ? 'active' : ''}`} onClick={() => setActiveTab('admission')}>Admission Form</button>
                <button className={`tab-btn ${activeTab === 'discharge' ? 'active' : ''}`} onClick={() => setActiveTab('discharge')}>Discharge Form</button>
              </div>

              {activeTab === 'admission' && (
                <>
                  <div className="meta-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>Form Completion</span>
                      <span style={{ fontWeight: 700, color: FAMILY_COLORS.accent, fontSize: '0.86rem' }}>{admissionProgressPercent}%</span>
                    </div>
                    <div style={{ height: 8, background: '#E2E8F0', borderRadius: 999 }}>
                      <div style={{ width: `${admissionProgressPercent}%`, height: '100%', background: FAMILY_COLORS.accent, borderRadius: 999 }} />
                    </div>
                    <p style={{ marginTop: 8, color: '#64748b', fontSize: '0.8rem' }}>
                      {admissionCompletedFields} of {admissionRequiredFields.length} required fields completed
                    </p>
                  </div>
                  <div className="meta-card">
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.86rem', marginBottom: 6 }}>Admission Checklist</div>
                    {admissionRequiredFields.map((field) => (
                      <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5 }}>
                        <span style={{ color: '#475569' }}>{field.label}</span>
                        <span style={{ color: String(admissionForm[field.key]).trim() ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                          {String(admissionForm[field.key]).trim() ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Full Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="fullName" placeholder="Your full name" value={admissionForm.fullName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.fullName && <div className="error">{admissionErrors.fullName}</div>}
                    </div>
                    <div className="field">
                      <label>Email Address *</label>
                      <div className="input-wrapper"><Mail className="input-icon" size={18} /><input name="email" type="email" placeholder="Email address" value={admissionForm.email} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.email && <div className="error">{admissionErrors.email}</div>}
                    </div>
                    <div className="field">
                      <label>Phone Number *</label>
                      <div className="input-wrapper"><Phone className="input-icon" size={18} /><input name="phoneNumber" placeholder="Contact number" value={admissionForm.phoneNumber} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.phoneNumber && <div className="error">{admissionErrors.phoneNumber}</div>}
                    </div>

                    <div className="field full">
                      <AddressFormSection
                        title="Guardian Address"
                        fetchError={fetchError}
                        onDismissError={() => setFetchError('')}
                        restoredHint={addressRestored ? 'We restored your last address on this device. Review before submitting.' : null}
                      >
                        <PsgcSearchableSelect
                          label="Province"
                          Icon={MapPin}
                          options={provinceOptions}
                          valueName={admissionForm.province}
                          onSelect={(opt) => {
                            void onProvinceSelected(opt, setAdmissionForm);
                            if (admissionErrors.province) setAdmissionErrors((prev) => ({ ...prev, province: '' }));
                          }}
                          onClear={() => {
                            onProvinceCleared(setAdmissionForm);
                            setAdmissionErrors((prev) => ({ ...prev, province: '', municipalityCity: '', barangay: '', street: '' }));
                          }}
                          disabled={loadingProvinces}
                          loading={loadingProvinces}
                          hasError={!!admissionErrors.province}
                          errorText={admissionErrors.province || ''}
                          placeholder={loadingProvinces ? 'Loading provinces…' : 'Choose Province'}
                          emptyText="No province matched. Try another spelling."
                        />
                        <PsgcSearchableSelect
                          label="City / Municipality"
                          Icon={Building2}
                          options={cityOptions}
                          valueName={admissionForm.municipalityCity}
                          onSelect={(opt) => {
                            void onCitySelected(opt, setAdmissionForm);
                            if (admissionErrors.municipalityCity) setAdmissionErrors((prev) => ({ ...prev, municipalityCity: '' }));
                          }}
                          onClear={() => {
                            onCityCleared(setAdmissionForm);
                            setAdmissionErrors((prev) => ({ ...prev, municipalityCity: '', barangay: '' }));
                          }}
                          disabled={!admissionForm.province.trim() || loadingCities}
                          loading={loadingCities}
                          hasError={!!admissionErrors.municipalityCity}
                          errorText={admissionErrors.municipalityCity || ''}
                          placeholder={!admissionForm.province.trim() ? 'Choose Province First' : loadingCities ? 'Loading cities…' : 'Choose City / Municipality'}
                          emptyText={loadingCities ? 'Loading…' : 'No match in this province.'}
                        />
                        <div className="addr-sec__full">
                          <PsgcSearchableSelect
                            label="Barangay"
                            Icon={Hash}
                            options={barangayOptions}
                            valueName={admissionForm.barangay}
                            onSelect={(opt) => {
                              onBarangaySelected(opt, setAdmissionForm);
                              if (admissionErrors.barangay) setAdmissionErrors((prev) => ({ ...prev, barangay: '' }));
                            }}
                            onClear={() => {
                              onBarangayCleared(setAdmissionForm);
                              setAdmissionErrors((prev) => ({ ...prev, barangay: '' }));
                            }}
                            disabled={!admissionForm.municipalityCity.trim() || loadingBarangays}
                            loading={loadingBarangays}
                            hasError={!!admissionErrors.barangay}
                            errorText={admissionErrors.barangay || ''}
                            placeholder={!admissionForm.municipalityCity.trim() ? 'Choose City First' : loadingBarangays ? 'Loading barangays…' : 'Choose Barangay'}
                            emptyText={loadingBarangays ? 'Loading…' : 'No barangay matched.'}
                          />
                        </div>
                        <div className="addr-sec__full">
                          <StreetAddressInput
                            label="Street / Building Line"
                            description="Block, lot, street, building, or subdivision (not in the lists above)."
                            placeholder="Enter block, lot, street, or building (e.g. Blk 2 Lot 15)"
                            value={admissionForm.street}
                            onChange={handleAdmissionChange}
                            errorText={admissionErrors.street || ''}
                          />
                        </div>
                      </AddressFormSection>
                    </div>

                    <div className="field">
                      <label>Patient Last Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientLastName" placeholder="Patient's last name" value={admissionForm.patientLastName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.patientLastName && <div className="error">{admissionErrors.patientLastName}</div>}
                    </div>
                    <div className="field">
                      <label>Patient First Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientFirstName" placeholder="Patient's first name" value={admissionForm.patientFirstName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.patientFirstName && <div className="error">{admissionErrors.patientFirstName}</div>}
                    </div>
                    <div className="field">
                      <label>Patient Middle Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientMiddleName" placeholder="Patient's middle name" value={admissionForm.patientMiddleName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.patientMiddleName && <div className="error">{admissionErrors.patientMiddleName}</div>}
                    </div>
                    <div className="field">
                      <label>Patient Gender *</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={18} />
                        <select name="patientGender" value={admissionForm.patientGender} onChange={handleAdmissionChange}>
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                      {admissionErrors.patientGender && <div className="error">{admissionErrors.patientGender}</div>}
                    </div>
                    <div className="field">
                      <label>Patient Birthday *</label>
                      <div className="input-wrapper">
                        <Calendar className="input-icon" size={18} />
                        <input ref={patientBirthdayInputRef} name="patientBirthday" type="date" className="input-date" value={admissionForm.patientBirthday} onChange={handleAdmissionChange} />
                        <button type="button" className="input-icon-btn" onClick={openBirthdayPicker} aria-label="Open birthday calendar">
                          <Calendar size={16} />
                        </button>
                      </div>
                      <p className="date-field-hint">Select a date or use the calendar control - not in the future.</p>
                      {admissionErrors.patientBirthday && <div className="error">{admissionErrors.patientBirthday}</div>}
                    </div>
                    <div className="field full">
                      <label>Reason for Admission *</label>
                      <div className="input-wrapper">
                        <ClipboardList className="input-icon" size={18} />
                        <select name="reasonForAdmission" value={admissionForm.reasonForAdmission} onChange={handleAdmissionChange}>
                          <option value="">Select Reason</option>
                          <option value="Drugs">Drugs</option>
                          <option value="Alcohol">Alcohol</option>
                          <option value="Gambling">Gambling</option>
                          <option value="Mental health">Mental health</option>
                        </select>
                      </div>
                      {admissionErrors.reasonForAdmission && <div className="error">{admissionErrors.reasonForAdmission}</div>}
                    </div>
                    <div className="field full" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={admissionForm.agreeToTerms}
                      onChange={handleAdmissionChange}
                      style={{ width: 18, height: 18 }}
                      />
                      
                      <label style={{ margin: 0 }}>
                        I agree to the{' '}
                        <span
                        style={{ color: '#F54E25', cursor: 'pointer', fontWeight: 700 }}
                        onClick={() => setShowTermsModal(true)}
                        >
                        Privacy Policy
                        </span>{' '}
                        and{' '}
                        <span
                        style={{ color: '#F54E25', cursor: 'pointer', fontWeight: 700 }}
                        onClick={() => setShowTermsModal(true)}
                        >
                          Terms
                          </span>{' '}
                          *
                    </label> 
                    </div>
                    {admissionErrors.agreeToTerms && <div className="error full">{admissionErrors.agreeToTerms}</div>}
                    {admissionErrors.submit && <div className="error full">{admissionErrors.submit}</div>}
                  </div>
                </>
              )}

              {activeTab === 'discharge' && (
                <>
                  <div className="form-grid">
                    <div className="field full">
                      <label>Select Patient *</label>
                      <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                        <option value="">Select admitted patient</option>
                        {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {dischargeErrors.selectedPatientId && <div className="error">{dischargeErrors.selectedPatientId}</div>}
                    </div>
                  </div>
                  {!patients.length && <div className="empty-patient">No admitted patients available for discharge request.</div>}
                  {selectedPatientId && (
                    <div className="form-grid">
                      <div className="field"><label>Reason Category *</label><select value={dischargeForm.reasonCategory} onChange={(e) => setDischargeForm((p) => ({ ...p, reasonCategory: e.target.value }))}><option value="">Select reason</option><option value="Treatment program completed">Treatment program completed</option><option value="Medical recommendation">Medical recommendation</option><option value="Family request">Family request</option><option value="Transfer">Transfer</option><option value="Other">Other</option></select>{dischargeErrors.reasonCategory && <div className="error">{dischargeErrors.reasonCategory}</div>}</div>
                      <div className="field"><label>Preferred Discharge Date</label><input type="date" value={dischargeForm.preferredDate} onChange={(e) => setDischargeForm((p) => ({ ...p, preferredDate: e.target.value }))} /></div>
                      <div className="field"><label>Authorized Pickup</label><input value={dischargeForm.pickupAuthorized} onChange={(e) => setDischargeForm((p) => ({ ...p, pickupAuthorized: e.target.value }))} /></div>
                      <div className="field"><label>Follow-up Phone</label><input value={dischargeForm.followUpPhone} onChange={(e) => setDischargeForm((p) => ({ ...p, followUpPhone: e.target.value }))} /></div>
                      <div className="field full"><label>Reason Details *</label><textarea value={dischargeForm.reasonDetails} onChange={(e) => setDischargeForm((p) => ({ ...p, reasonDetails: e.target.value }))} />{dischargeErrors.reasonDetails && <div className="error">{dischargeErrors.reasonDetails}</div>}</div>
                      <div className="field full"><label>Other Information</label><textarea value={dischargeForm.otherInfo} onChange={(e) => setDischargeForm((p) => ({ ...p, otherInfo: e.target.value }))} /></div>
                      {dischargeErrors.submit && <div className="error full">{dischargeErrors.submit}</div>}
                    </div>
                  )}
                </>
              )}

              <div className="submit-row"><button type="button" className="primary-btn" onClick={handlePrimarySubmit}>Submit Request</button></div>
            </div>
          </div>
        </div>

        <nav className="mobile-bottom-nav">
          <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/progress')}>
            <ClipboardList size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Requests</span>
          </div>
          <button
            type="button"
            aria-label="Appointments"
            onClick={() => navigate('/appointments')}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Calendar size={24} color="#A3AED0" />
          </button>
          <button
            type="button"
            aria-label="Reports"
            onClick={() => navigate('/reports')}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <BarChart3 size={24} color="#A3AED0" />
          </button>
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
          <LogOut size={24} color="#A3AED0" onClick={() => navigate('/login')} />
        </nav>
      </main>

      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div
            className="terms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="terms-modal-header">
              <div>
                <h2 className="terms-modal-title">TERMS AND CONDITIONS</h2>
                <p className="terms-modal-subtitle">Clinic Admission and Patient Management System</p>
              </div>
              <button type="button" className="terms-close-btn" onClick={() => setShowTermsModal(false)} aria-label="Close terms">
                ×
              </button>
            </div>

            <div className="terms-modal-body">
              <div className="terms-section">
                <strong>1. Acceptance of Terms</strong>
                <p>By accessing, registering, or using this application and web system ("the System"), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the System immediately.</p>
              </div>
              <div className="terms-section">
                <strong>2. Purpose of the System</strong>
                <p>The System is designed to facilitate admission processing, patient record management, scheduling, monitoring, and communication between the clinic, patients, and authorized guardians.</p>
              </div>
              <div className="terms-section">
                <strong>3. User Eligibility and Accounts</strong>
                <p>Users must provide accurate and complete information during registration and admission application. Guardians submitting applications on behalf of patients confirm they are legally authorized to provide the patient's information.</p>
              </div>
              <div className="terms-section">
                <strong>4. Data Collection and Privacy</strong>
                <p>The System collects personal and health-related information necessary for admission processing, monitoring, and care coordination. By using the System, you consent to the storage and processing of submitted information within the secure clinic database.</p>
              </div>
              <div className="terms-section">
                <strong>5. Accuracy of Information</strong>
                <p>Users agree to provide truthful, current, and complete information. Submission of false, misleading, or incomplete data may result in delayed admission processing, suspension of account access, or rejection of applications.</p>
              </div>
              <div className="terms-section">
                <strong>6. Communication and Notification</strong>
                <p>The System may send notifications regarding admission status, schedules, updates, and relevant announcements. These notifications are informational and should not be interpreted as medical advice or emergency instructions.</p>
              </div>
              <div className="terms-section">
                <strong>7. System Availability</strong>
                <p>The clinic will make reasonable efforts to maintain continuous system availability. However, temporary interruptions may occur due to maintenance, updates, technical issues, or network conditions.</p>
              </div>
              <div className="terms-section">
                <strong>8. Acceptable Use</strong>
                <p>Users agree not to misuse the System. Prohibited actions include unauthorized access, attempting to alter records without permission, uploading harmful content, sharing accounts, or interfering with system operations.</p>
              </div>
              <div className="terms-section">
                <strong>9. Record Access and Confidentiality</strong>
                <p>Patient records are confidential and may only be accessed by authorized staff and the registered patient or guardian.</p>
              </div>
              <div className="terms-section">
                <strong>10. Limitation of Liability</strong>
                <p>The System is intended to support administrative processes. The clinic is not responsible for decisions made solely based on system information without consultation with qualified healthcare professionals.</p>
              </div>
              <div className="terms-section">
                <strong>11. Modifications to Terms</strong>
                <p>The clinic reserves the right to modify these Terms and Conditions at any time. Continued use of the System after updates indicates acceptance of the revised terms.</p>
              </div>
              <div className="terms-section">
                <strong>12. Termination of Access</strong>
                <p>The clinic may suspend or terminate access if users violate these Terms, misuse the System, or compromise security or patient confidentiality.</p>
              </div>
              <div className="terms-section">
                <strong>13. Contact Information</strong>
                <p>For questions, corrections to records, or concerns regarding these Terms, users may contact the clinic administration through the official communication channels provided within the System.</p>
              </div>
            </div>
            <div className="terms-modal-footer">
              <button
                type="button"
                className="primary-btn"
                style={{ width: '100%' }}
                onClick={() => {
                  setAdmissionForm((prev) => ({ ...prev, agreeToTerms: true }));
                  setShowTermsModal(false);
                }}
              >
                I agree to the Terms of Service
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ open: false, type: null })}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirm Submission</h3>
            <p className="modal-body-text">
              Are you sure you want to submit this {confirmModal.type} request?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                style={{ flex: 1, padding: 12, border: '1px solid #CBD5E1', borderRadius: 10, background: '#fff', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setConfirmModal({ open: false, type: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#F54E25', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                onClick={confirmSubmit}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {successModal.open && (
        <div className="modal-overlay" onClick={() => setSuccessModal({ open: false, message: '' })}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckCircle size={38} />
            </div>
            <h3 className="modal-title" style={{ marginBottom: 8 }}>Success</h3>
            <p style={{ color: '#64748B', marginBottom: 14 }}>{successModal.message}</p>
            <p style={{ color: '#F54E25', fontWeight: 700, marginBottom: 18 }}>Your request is being processed.</p>
            <button type="button" className="primary-btn" onClick={() => setSuccessModal({ open: false, message: '' })}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default Progress;