import React, { useEffect, useRef, useState } from 'react';
import { Home, User, LogOut, Bell, CheckCircle2, CheckCircle, Calendar, ClipboardList, BookUser, FileText, Paperclip, Upload } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData, APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { FAMILY_COLORS } from '@/components/family/shared/ui';
import logo from '@/assets/kalingalogo.png';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { appendFamilyNotificationsIfNew } from '@/lib/familyNotifications';
import { useFamilyPatientProgressRealtime } from '@/hooks/useFamilyPatientProgressRealtime';
import {
  FAMILY_DISCHARGE_TYPE,
  FAMILY_TEMPORARY_REASON_CATEGORIES,
} from '@/lib/dischargeRequestTypes';
import {
  insertAdmissionRequest,
  patchAdmissionRequestGender,
} from '@/lib/admissionRequestInsert';
import { uploadAdmissionDocuments } from '@/lib/admissionDocumentUpload';
import { admissionStatusLabel, parseAttachedFiles } from '@/lib/admissionWorkflow';

const Progress = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [familyNotifUserId, setFamilyNotifUserId] = useState('');
  const patientBirthdayInputRef = useRef(null);
  const [patients, setPatients] = useState([]);
  const [activeTab, setActiveTab] = useState('admission');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  const [showTermsModal, setShowTermsModal] = useState(false);

  useFamilyPatientProgressRealtime();

  const [admissionForm, setAdmissionForm] = useState({
    patientLastName: '',
    patientFirstName: '',
    patientMiddleName: '',
    patientGender: '',
    patientBirthday: '',
    reasonForAdmission: '',
    agreeToTerms: false,
  });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [submittedAdmissions, setSubmittedAdmissions] = useState([]);
  const [guardianProfile, setGuardianProfile] = useState({ fullName: '', email: '', phone: '' });
  const [supplementalUploadId, setSupplementalUploadId] = useState('');
  const fileInputRef = useRef(null);
  const supplementalFileRef = useRef(null);
  const [admissionErrors, setAdmissionErrors] = useState({});

  const [dischargeForm, setDischargeForm] = useState({
    reasonCategory: '',
    reasonCategoryOther: '',
    reasonDetails: '',
    preferredDate: '',
    pickupAuthorized: '',
    followUpPhone: '',
    escortName: '',
    escortRelation: '',
    escortContact: '',
    destinationAfterDischarge: '',
    belongingsChecklist: '',
    otherInfo: '',
  });
  const [dischargeErrors, setDischargeErrors] = useState({});
  const admissionRequiredFields = [
    { key: 'patientLastName', label: 'Resident Last Name' },
    { key: 'patientFirstName', label: 'Resident First Name' },
    { key: 'patientGender', label: 'Resident Gender' },
    { key: 'patientBirthday', label: 'Resident Birthday' },
    { key: 'reasonForAdmission', label: 'Reason for Admission' },
  ];
  const admissionCompletedFields = admissionRequiredFields.filter((field) => String(admissionForm[field.key]).trim()).length;
  const admissionProgressPercent = Math.round((admissionCompletedFields / admissionRequiredFields.length) * 100);
  const selectedPatient = patients.find((p) => String(p.id) === String(selectedPatientId));

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
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      if (isMounted) setFamilyNotifUserId(user.id || '');
      const metaName =
        user.user_metadata?.full_name
        || [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ');
      let fullName = metaName || '';
      let phone = user.user_metadata?.contact_number || '';
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();
      if (profileRow?.full_name) fullName = profileRow.full_name;
      if (profileRow?.phone) phone = profileRow.phone;
      if (isMounted) {
        setGuardianProfile({
          fullName: fullName || 'Family User',
          email: user.email || '',
          phone: phone || '',
        });
      }
      if (isSupabaseConfigured()) {
        const { data: rows } = await supabase
          .from('admission_requests')
          .select('*')
          .eq('family_id', user.id)
          .order('created_at', { ascending: false });
        if (isMounted) setSubmittedAdmissions(rows || []);
      }
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const addProcessingNotification = () => {
    if (!familyNotifUserId) return;
    appendFamilyNotificationsIfNew(
      [{ id: `local-processing-${Date.now()}`, text: 'Your request is being processed.' }],
      familyNotifUserId
    );
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
    if (!admissionForm.patientLastName.trim()) errs.patientLastName = 'Resident last name is required.';
    if (!admissionForm.patientFirstName.trim()) errs.patientFirstName = 'Resident first name is required.';
    if (!admissionForm.patientGender.trim()) errs.patientGender = 'Resident gender is required.';
    if (!admissionForm.patientBirthday) errs.patientBirthday = 'Resident birthday is required.';
    if (!admissionForm.reasonForAdmission) errs.reasonForAdmission = 'Please select a reason.';
    if (!attachedFiles.length) errs.attachedFiles = 'Please attach at least one necessary document.';
    if (!admissionForm.agreeToTerms) errs.agreeToTerms = 'You must agree to the terms.';
    setAdmissionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateDischarge = () => {
    const errs = {};
    if (!selectedPatientId) errs.selectedPatientId = 'Please choose which family member this request is for.';
    if (!dischargeForm.reasonCategory) errs.reasonCategory = 'Please choose the option that best matches your situation.';
    if (dischargeForm.reasonCategory === 'Other' && !dischargeForm.reasonCategoryOther.trim()) {
      errs.reasonCategoryOther = 'Please briefly describe the reason.';
    }
    if (!dischargeForm.reasonDetails.trim() || dischargeForm.reasonDetails.trim().length < 15) {
      errs.reasonDetails = 'Please add a bit more detail (at least 15 characters) so staff can understand your request.';
    }
    if (!dischargeForm.escortName.trim()) {
      errs.escortName = 'Please enter the name of the person who will pick up your family member.';
    }
    if (!dischargeForm.escortContact.trim()) {
      errs.escortContact = 'Please enter a phone number for the person who will pick them up.';
    }
    if (!dischargeForm.destinationAfterDischarge.trim()) {
      errs.destinationAfterDischarge = 'Please tell us where they will stay during this temporary leave (for example your home).';
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
    const genderValue = admissionForm.patientGender.trim();
    const formSnapshot = {
      patientLastName: admissionForm.patientLastName.trim(),
      patientFirstName: admissionForm.patientFirstName.trim(),
      patientMiddleName: admissionForm.patientMiddleName.trim(),
      patientGender: genderValue,
      patientBirthday: admissionForm.patientBirthday,
      reasonForAdmission: admissionForm.reasonForAdmission,
    };
    const uploadResult = await uploadAdmissionDocuments(attachedFiles, user.id, 'pending');
    if (!uploadResult.ok) {
      setAdmissionErrors({ submit: uploadResult.errorMessage });
      return;
    }
    const extendedRow = {
      family_id: user.id,
      guardian_full_name: guardianProfile.fullName.trim(),
      guardian_email: guardianProfile.email.trim(),
      guardian_phone: guardianProfile.phone.trim(),
      patient_name: getPatientFullName(),
      patient_last_name: admissionForm.patientLastName.trim(),
      patient_first_name: admissionForm.patientFirstName.trim(),
      patient_middle_name: admissionForm.patientMiddleName.trim(),
      patient_gender: genderValue,
      patient_birth_date: admissionForm.patientBirthday,
      reason_for_admission: admissionForm.reasonForAdmission,
      status: 'processing',
      form_data: formSnapshot,
      attached_files: uploadResult.files,
    };
    const coreRow = {
      family_id: user.id,
      guardian_full_name: guardianProfile.fullName.trim(),
      guardian_email: guardianProfile.email.trim(),
      guardian_phone: guardianProfile.phone.trim(),
      patient_name: getPatientFullName(),
      patient_last_name: admissionForm.patientLastName.trim(),
      patient_first_name: admissionForm.patientFirstName.trim(),
      patient_middle_name: admissionForm.patientMiddleName.trim(),
      patient_gender: genderValue,
      patient_birth_date: admissionForm.patientBirthday,
      reason_for_admission: admissionForm.reasonForAdmission,
      status: 'processing',
    };
    const minimalRow = {
      family_id: user.id,
      guardian_full_name: guardianProfile.fullName.trim(),
      guardian_email: guardianProfile.email.trim(),
      guardian_phone: guardianProfile.phone.trim(),
      patient_name: getPatientFullName(),
      patient_gender: genderValue,
      patient_birth_date: admissionForm.patientBirthday,
      reason_for_admission: admissionForm.reasonForAdmission,
      status: 'processing',
    };
    const insertResult = await insertAdmissionRequest([extendedRow, coreRow, minimalRow]);
    if (!insertResult.ok) {
      setAdmissionErrors({ submit: insertResult.errorMessage });
      return;
    }
    await patchAdmissionRequestGender(insertResult.id, genderValue);
    if (uploadResult.files.length) {
      await supabase
        .from('admission_requests')
        .update({ attached_files: uploadResult.files, form_data: formSnapshot })
        .eq('id', insertResult.id);
    }
    await appendActivityFeed(`Admission request submitted for ${getPatientFullName()}. Pending admin review.`, { familyId: user.id });
    refreshAppData();
    appendFamilyNotificationsIfNew(
      [{ id: `adm-processing-${insertResult.id}`, text: `Admission request for ${getPatientFullName()} is being processed.` }],
      user.id
    );
    const { data: rows } = await supabase
      .from('admission_requests')
      .select('*')
      .eq('family_id', user.id)
      .order('created_at', { ascending: false });
    setSubmittedAdmissions(rows || []);
    setAdmissionForm({
      patientLastName: '',
      patientFirstName: '',
      patientMiddleName: '',
      patientGender: '',
      patientBirthday: '',
      reasonForAdmission: '',
      agreeToTerms: false,
    });
    setAttachedFiles([]);
    setSuccessModal({ open: true, message: 'Admission request submitted successfully.' });
  };

  const uploadSupplementalDocuments = async (requestId) => {
    const input = supplementalFileRef.current;
    const files = input?.files;
    if (!requestId || !files?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const uploadResult = await uploadAdmissionDocuments(Array.from(files), user.id, requestId);
    if (!uploadResult.ok) {
      setAdmissionErrors({ submit: uploadResult.errorMessage });
      return;
    }
    const existing = submittedAdmissions.find((r) => r.id === requestId);
    const merged = [...parseAttachedFiles(existing?.attached_files), ...uploadResult.files];
    await supabase.from('admission_requests').update({ attached_files: merged }).eq('id', requestId);
    const { data: rows } = await supabase
      .from('admission_requests')
      .select('*')
      .eq('family_id', user.id)
      .order('created_at', { ascending: false });
    setSubmittedAdmissions(rows || []);
    setSupplementalUploadId('');
    if (input) input.value = '';
    appendFamilyNotificationsIfNew(
      [{ id: `adm-docs-${requestId}-${Date.now()}`, text: 'Additional documents uploaded for your admission request.' }],
      user.id
    );
  };

  const submitDischarge = async () => {
    if (!selectedPatient) return;
    const bundledOtherInfo = [
      dischargeForm.reasonCategory === 'Other' && dischargeForm.reasonCategoryOther?.trim()
        ? `Other Reason Category: ${dischargeForm.reasonCategoryOther.trim()}`
        : '',
      dischargeForm.otherInfo?.trim() ? `Additional Notes: ${dischargeForm.otherInfo.trim()}` : '',
      dischargeForm.escortName?.trim() ? `Authorized Escort: ${dischargeForm.escortName.trim()}` : '',
      dischargeForm.escortRelation?.trim() ? `Escort Relationship: ${dischargeForm.escortRelation.trim()}` : '',
      dischargeForm.escortContact?.trim() ? `Escort Contact: ${dischargeForm.escortContact.trim()}` : '',
      dischargeForm.destinationAfterDischarge?.trim() ? `Discharge Destination: ${dischargeForm.destinationAfterDischarge.trim()}` : '',
      dischargeForm.belongingsChecklist?.trim() ? `Belongings Checklist: ${dischargeForm.belongingsChecklist.trim()}` : '',
    ].filter(Boolean).join('\n');
    if (!isSupabaseConfigured()) {
      const pending = JSON.parse(localStorage.getItem('bh_pending_discharges') || '[]');
      pending.push({
        id: Date.now(),
        created_at: new Date().toISOString(),
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.name,
        discharge_type: FAMILY_DISCHARGE_TYPE,
        reason_category: dischargeForm.reasonCategory,
        reason_details: dischargeForm.reasonDetails.trim(),
        preferred_discharge_date: dischargeForm.preferredDate || null,
        pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
        follow_up_phone: dischargeForm.followUpPhone.trim() || null,
        other_info: bundledOtherInfo || null,
        status: 'pending',
      });
      localStorage.setItem('bh_pending_discharges', JSON.stringify(pending));
      window.dispatchEvent(new Event('storage'));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setDischargeErrors({ submit: 'Please sign in to submit your family discharge request.' });
        return;
      }
      const familyName =
        user.user_metadata?.full_name
        || guardianProfile.fullName?.trim()
        || 'Family User';
      const familyEmail = user.email || guardianProfile.email?.trim() || null;
      const familyPhone = guardianProfile.phone?.trim() || null;
      const dischargePayload = {
        patient_id: selectedPatient.id,
        family_id: user.id,
        family_name: familyName,
        guardian_email: familyEmail,
        guardian_phone: familyPhone,
        discharge_type: FAMILY_DISCHARGE_TYPE,
        reason_category: dischargeForm.reasonCategory,
        reason_details: dischargeForm.reasonDetails.trim(),
        preferred_discharge_date: dischargeForm.preferredDate || null,
        pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
        follow_up_phone: dischargeForm.followUpPhone.trim() || null,
        other_info: bundledOtherInfo || null,
        status: 'pending',
      };
      let { error } = await supabase.from('discharge_requests').insert(dischargePayload);
      if (error) {
        // Backward compatibility: retry with baseline columns for older schemas.
        ({ error } = await supabase.from('discharge_requests').insert({
          patient_id: selectedPatient.id,
          family_id: user.id,
          reason_category: dischargeForm.reasonCategory,
          reason_details: dischargeForm.reasonDetails.trim(),
          preferred_discharge_date: dischargeForm.preferredDate || null,
          pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
          follow_up_phone: dischargeForm.followUpPhone.trim() || null,
          other_info: bundledOtherInfo || null,
          status: 'pending',
        }));
      }
      if (error) {
        setDischargeErrors({ submit: error.message });
        return;
      }
      await appendActivityFeed(
        `Temporary discharge request submitted for ${selectedPatient.name}. Awaiting admin review.`,
        { familyId: user.id }
      );
      refreshAppData();
    }
    addProcessingNotification();
    setDischargeForm({
      reasonCategory: '',
      reasonCategoryOther: '',
      reasonDetails: '',
      preferredDate: '',
      pickupAuthorized: '',
      followUpPhone: '',
      escortName: '',
      escortRelation: '',
      escortContact: '',
      destinationAfterDischarge: '',
      belongingsChecklist: '',
      otherInfo: '',
    });
    setSelectedPatientId('');
    setSuccessModal({
      open: true,
      message: 'Your discharge request was submitted. Our team will review it and contact you if anything else is needed.',
    });
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
        .view-title { font-weight: 800; font-size: 18px; letter-spacing: -0.01em; line-height: 1.2; }
        .view-title-accent { color: #F54E25; }
        .view-title-rest { color: #0F172A; }
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
        .notif-dropdown-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .notif-dropdown-title { color: #1B2559; font-weight: 800; font-size: 16px; margin-bottom: 0; display: flex; align-items: center; gap: 8px; }
        .notif-clear-all { border: none; background: transparent; color: #94A3B8; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 6px; border-radius: 8px; }
        .notif-clear-all:hover { color: #64748b; background: #f1f5f9; }
        .notif-dropdown-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #334155; font-size: 13px; }
        .notif-dropdown-row span { flex: 1; min-width: 0; }
        .notif-remove-x { border: none; background: transparent; color: #CBD5E1; cursor: pointer; font-size: 16px; padding: 0; line-height: 1; flex-shrink: 0; }
        .notif-remove-x:hover { color: #EF4444; }
        .content-area { flex: 1; padding: 24px 30px 30px; overflow-y: auto; }
        .content-wrap { width: 100%; max-width: 1600px; margin: 0 auto; }
        .request-shell { background: #fff; border: 1px solid #E9EDF7; border-radius: 20px; padding: 22px; min-height: calc(100vh - 170px); display: flex; flex-direction: column; box-shadow: 0 14px 35px rgba(15, 23, 42, 0.06); }
        .heading { color: #1B2559; font-size: 24px; font-weight: 800; line-height: 1.2; }
        .subheading { margin-top: 6px; color: #64748B; font-size: 14px; font-weight: 600; }
        .tabs { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFF; border: 1px solid #E5ECFA; border-radius: 14px; padding: 8px; }
        .tab-btn { border: 1px solid transparent; background: transparent; border-radius: 10px; padding: 12px; font-weight: 800; color: #475569; cursor: pointer; transition: .18s ease; }
        .tab-btn:hover { background: #FFFFFF; border-color: #E2E8F0; color: #334155; }
        .tab-btn.active { background: linear-gradient(180deg, #FFF5F1 0%, #FFFFFF 100%); border-color: #FBCBBE; color: #F54E25; box-shadow: 0 8px 18px rgba(245, 78, 37, 0.12); }
        .form-surface {
          margin-top: 16px;
          border: 1px solid #E7ECF8;
          border-radius: 16px;
          background: linear-gradient(180deg, #FDFEFF 0%, #FFFFFF 100%);
          padding: 16px;
        }
        .section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: #7C3AED;
          background: #F3EDFF;
          border: 1px solid #E9DDFF;
          padding: 4px 9px;
          border-radius: 999px;
          margin-bottom: 8px;
        }
        .section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
        .section-title-main { color: #1B2559; font-size: 18px; font-weight: 800; }
        .section-title-sub { color: #64748B; font-size: 12px; font-weight: 600; }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 800;
          background: #ECFDF3;
          color: #166534;
          border: 1px solid #CFF7DC;
        }
        .quick-insights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        .insight-card { border: 1px solid #E8EEF8; border-radius: 12px; background: #F8FAFF; padding: 10px 12px; }
        .insight-label { color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
        .insight-value { color: #1E293B; font-size: 16px; font-weight: 800; margin-top: 2px; }
        .form-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-content: start; }
        .full { grid-column: 1 / -1; }
        .field {
          border: 1px solid #E9EEF8;
          border-radius: 14px;
          background: #FFFFFF;
          padding: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
        }
        .field.full { padding: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .field input, .field textarea, .field select { width: 100%; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; font-size: 14px; color: #1B2559; background: #fff; }
        .field textarea { min-height: 100px; resize: vertical; }
        .error { color: #DC2626; font-size: 12px; margin-top: 4px; font-weight: 600; }
        .meta-card { border: 1px solid #E9EDF7; background: #FAFCFF; border-radius: 14px; padding: 12px; margin-top: 14px; box-shadow: inset 0 1px 0 #FFFFFF; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 12px; color: #94A3B8; pointer-events: none; }
        .input-wrapper input, .input-wrapper select { padding-left: 42px; }
        .input-icon-btn { position: absolute; right: 10px; border: none; background: transparent; color: #64748B; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 4px; border-radius: 8px; }
        .input-icon-btn:hover { background: #EEF2FF; color: #1B2559; }
        .input-date { padding-right: 38px !important; }
        .date-field-hint { font-size: 12px; color: #94a3b8; margin-top: 6px; }
        .empty-patient { margin-top: 16px; border: 1px dashed #D4DFEE; background: #F8FBFF; border-radius: 12px; padding: 22px; text-align: center; color: #64748B; font-weight: 700; }
        .submit-row { margin-top: 18px; padding-top: 12px; display: flex; justify-content: flex-end; }
        .primary-btn { background: linear-gradient(145deg, #F97316, #EA580C); color: #fff; border: none; border-radius: 12px; padding: 12px 22px; font-weight: 800; cursor: pointer; box-shadow: 0 10px 24px rgba(234, 88, 12, 0.24); transition: transform .18s ease, box-shadow .18s ease; }
        .primary-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(234, 88, 12, 0.28); }
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
          .quick-insights { grid-template-columns: 1fr; }
          .mobile-bottom-nav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; height: 74px; background: #fff; border-top: 1px solid #F1F1F1; justify-content: space-around; align-items: center; z-index: 500; }
          .terms-modal { max-height: 90vh; border-radius: 16px; }
          .terms-modal-header, .terms-modal-body, .terms-modal-footer { padding-left: 14px; padding-right: 14px; }
          .terms-modal-title,
          .modal-title,
          .heading { font-size: 20px; }
        }
      `}</style>

      <aside className="sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="Kalinga" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}>
            <div className="sidebar-icon-wrap"><BookUser size={22} color="#707EAE" /></div><span className="sidebar-label">Resident Details</span>
          </div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Reports</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><User size={22} /><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><LogOut size={22} color="#F54E25" /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      <main className="main-view">
        <FamilyPageHeader title="Request Management" />

        <div className="content-area" style={{ background: FAMILY_COLORS.background }}>
          <div className="content-wrap">
            <div className="request-shell">
              <div className="tabs">
                <button className={`tab-btn ${activeTab === 'admission' ? 'active' : ''}`} onClick={() => setActiveTab('admission')}>Admission Form</button>
                <button className={`tab-btn ${activeTab === 'discharge' ? 'active' : ''}`} onClick={() => setActiveTab('discharge')}>Temporary discharge</button>
              </div>

              {activeTab === 'admission' && (
                <div className="form-surface">
                  <div className="section-kicker"><CheckCircle2 size={13} /> Admission workflow</div>
                  <div className="section-title-row">
                    <div>
                      <div className="section-title-main">Admission Request Form</div>
                      <div className="section-title-sub">Patient details only — your profile is used for guardian contact.</div>
                    </div>
                    <div className="status-pill"><CheckCircle size={13} /> Admin review required</div>
                  </div>
                  <div className="quick-insights">
                    <div className="insight-card">
                      <div className="insight-label">Completion</div>
                      <div className="insight-value">{admissionProgressPercent}%</div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-label">Required fields done</div>
                      <div className="insight-value">{admissionCompletedFields}/{admissionRequiredFields.length}</div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-label">Form status</div>
                      <div className="insight-value">{admissionProgressPercent === 100 ? 'Ready' : 'In Progress'}</div>
                    </div>
                  </div>
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
                    <div className="field full">
                      <label>Attach Necessary Files *</label>
                      <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: 14, background: '#F8FAFF' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setAttachedFiles(files);
                            if (admissionErrors.attachedFiles) {
                              setAdmissionErrors((prev) => ({ ...prev, attachedFiles: '' }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="primary-btn"
                          style={{ width: 'auto', padding: '10px 16px', margin: 0, boxShadow: 'none' }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                          Choose files
                        </button>
                        {attachedFiles.length > 0 && (
                          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: '0.82rem', color: '#475569' }}>
                            {attachedFiles.map((f) => (
                              <li key={`${f.name}-${f.size}`}><Paperclip size={12} style={{ display: 'inline', marginRight: 4 }} />{f.name}</li>
                            ))}
                          </ul>
                        )}
                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                          Upload IDs, medical records, or other required documents (PDF, images, Word — max 10 MB each).
                        </p>
                      </div>
                      {admissionErrors.attachedFiles && <div className="error">{admissionErrors.attachedFiles}</div>}
                    </div>

                    <div className="field">
                      <label>Patient Last Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientLastName" placeholder="Resident's last name" value={admissionForm.patientLastName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.patientLastName && <div className="error">{admissionErrors.patientLastName}</div>}
                    </div>
                    <div className="field">
                      <label>Patient First Name *</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientFirstName" placeholder="Resident's first name" value={admissionForm.patientFirstName} onChange={handleAdmissionChange} /></div>
                      {admissionErrors.patientFirstName && <div className="error">{admissionErrors.patientFirstName}</div>}
                    </div>
                    <div className="field">
                      <label>Patient Middle Name (Optional)</label>
                      <div className="input-wrapper"><User className="input-icon" size={18} /><input name="patientMiddleName" placeholder="Resident's middle name" value={admissionForm.patientMiddleName} onChange={handleAdmissionChange} /></div>
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

                  {submittedAdmissions.length > 0 && (
                    <div className="meta-card" style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 800, color: '#1B2559', marginBottom: 10 }}>Submitted Admission Requests</div>
                      {submittedAdmissions.map((row) => {
                        const formData = row.form_data || {};
                        const files = parseAttachedFiles(row.attached_files);
                        const st = admissionStatusLabel(row.status);
                        const inReview = String(row.status).toLowerCase() === 'in_review';
                        return (
                          <div key={row.id} style={{ border: '1px solid #E9EDF7', borderRadius: 12, padding: 12, marginBottom: 10, background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <strong style={{ color: '#1B2559' }}>{row.patient_name}</strong>
                              <span className="status-pill">{st}</span>
                            </div>
                            {row.meeting_date && (
                              <p style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: 6 }}>
                                Meeting with BOH: {row.meeting_date}{row.meeting_time ? ` at ${row.meeting_time}` : ''}
                              </p>
                            )}
                            {row.required_document_notes && inReview && (
                              <p style={{ fontSize: '0.8rem', color: '#b45309', marginBottom: 6 }}>
                                Required: {row.required_document_notes}
                              </p>
                            )}
                            <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                              <div>Reason: {formData.reasonForAdmission || row.reason_for_admission}</div>
                              <div>Gender: {formData.patientGender || row.patient_gender || '—'}</div>
                              <div>Birthday: {formData.patientBirthday || row.patient_birth_date || '—'}</div>
                            </div>
                            {files.length > 0 && (
                              <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
                                <strong>Attached files:</strong>
                                <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                                  {files.map((f) => (
                                    <li key={f.path || f.name}>{f.name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {inReview && !row.documents_complete && (
                              <div style={{ marginTop: 10 }}>
                                <input
                                  ref={supplementalUploadId === row.id ? supplementalFileRef : null}
                                  type="file"
                                  multiple
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                  style={{ display: 'none' }}
                                  onChange={() => void uploadSupplementalDocuments(row.id)}
                                />
                                <button
                                  type="button"
                                  className="primary-btn"
                                  style={{ width: 'auto', padding: '8px 14px', fontSize: '0.82rem', boxShadow: 'none' }}
                                  onClick={() => {
                                    setSupplementalUploadId(row.id);
                                    setTimeout(() => supplementalFileRef.current?.click(), 0);
                                  }}
                                >
                                  Upload missing documents
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'discharge' && (
                <div className="form-surface">
                  <div className="section-kicker"><ClipboardList size={13} /> Family / guardian request</div>
                  <div className="section-title-row">
                    <div>
                      <div className="section-title-main">Request temporary discharge</div>
                      <div className="section-title-sub">
                        Short-term leave only — your family member is expected to return to the facility. Who will pick them up, where they will stay, and why you need this leave.
                      </div>
                    </div>
                    <div className="status-pill"><CheckCircle size={13} /> Temporary leave · staff will review</div>
                  </div>
                  <div className="quick-insights">
                    <div className="insight-card">
                      <div className="insight-label">Family in our care</div>
                      <div className="insight-value">{patients.length}</div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-label">Selected for this form</div>
                      <div className="insight-value">{selectedPatient ? selectedPatient.name.split(' ')[0] : 'None'}</div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-label">Form status</div>
                      <div className="insight-value">{selectedPatientId ? 'Ready to finish' : 'Pick someone first'}</div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field full">
                      <label>Which family member is this for? *</label>
                      <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                        <option value="">Choose someone currently admitted</option>
                        {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {dischargeErrors.selectedPatientId && <div className="error">{dischargeErrors.selectedPatientId}</div>}
                    </div>
                  </div>
                  {!patients.length && (
                    <div className="empty-patient">
                      No one in your family is listed as admitted right now, so a temporary discharge request cannot be submitted yet.
                    </div>
                  )}
                  {selectedPatientId && (
                    <div className="form-grid">
                      <div className="field"><label>What best describes your reason? *</label><select value={dischargeForm.reasonCategory} onChange={(e) => setDischargeForm((p) => ({ ...p, reasonCategory: e.target.value, reasonCategoryOther: '' }))}><option value="">Choose one</option>{FAMILY_TEMPORARY_REASON_CATEGORIES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select>{dischargeErrors.reasonCategory && <div className="error">{dischargeErrors.reasonCategory}</div>}</div>
                      {dischargeForm.reasonCategory === 'Other' && (
                        <div className="field full">
                          <label>Describe your reason *</label>
                          <input
                            value={dischargeForm.reasonCategoryOther}
                            onChange={(e) => setDischargeForm((p) => ({ ...p, reasonCategoryOther: e.target.value }))}
                            placeholder="In your own words, what category fits best?"
                          />
                          {dischargeErrors.reasonCategoryOther && <div className="error">{dischargeErrors.reasonCategoryOther}</div>}
                        </div>
                      )}
                      <div className="field"><label>Preferred start date of temporary leave</label><input type="date" value={dischargeForm.preferredDate} onChange={(e) => setDischargeForm((p) => ({ ...p, preferredDate: e.target.value }))} /></div>
                      <div className="field"><label>Who is allowed to pick them up?</label><input value={dischargeForm.pickupAuthorized} onChange={(e) => setDischargeForm((p) => ({ ...p, pickupAuthorized: e.target.value }))} placeholder="e.g. parent, spouse, sibling" /></div>
                      <div className="field"><label>Best phone number to reach you</label><input value={dischargeForm.followUpPhone} onChange={(e) => setDischargeForm((p) => ({ ...p, followUpPhone: e.target.value }))} placeholder="Your number for follow-up calls" type="tel" /></div>
                      <div className="field"><label>Name of person picking them up *</label><input value={dischargeForm.escortName} onChange={(e) => setDischargeForm((p) => ({ ...p, escortName: e.target.value }))} placeholder="Full name" />{dischargeErrors.escortName && <div className="error">{dischargeErrors.escortName}</div>}</div>
                      <div className="field"><label>That person&apos;s relationship to your family member</label><input value={dischargeForm.escortRelation} onChange={(e) => setDischargeForm((p) => ({ ...p, escortRelation: e.target.value }))} placeholder="e.g. mother, partner" /></div>
                      <div className="field"><label>Pickup person&apos;s phone number *</label><input value={dischargeForm.escortContact} onChange={(e) => setDischargeForm((p) => ({ ...p, escortContact: e.target.value }))} placeholder="Mobile or landline" type="tel" />{dischargeErrors.escortContact && <div className="error">{dischargeErrors.escortContact}</div>}</div>
                      <div className="field full"><label>Where will they stay during this temporary leave? *</label><input value={dischargeForm.destinationAfterDischarge} onChange={(e) => setDischargeForm((p) => ({ ...p, destinationAfterDischarge: e.target.value }))} placeholder="Home address or a relative&apos;s home during the leave" />{dischargeErrors.destinationAfterDischarge && <div className="error">{dischargeErrors.destinationAfterDischarge}</div>}</div>
                      <div className="field full"><label>Important items going home</label><textarea value={dischargeForm.belongingsChecklist} onChange={(e) => setDischargeForm((p) => ({ ...p, belongingsChecklist: e.target.value }))} placeholder="Optional — clothing, IDs, papers, meds, or other things you want to make sure leave with them" /></div>
                      <div className="field full"><label>Tell us more about your request *</label><textarea value={dischargeForm.reasonDetails} onChange={(e) => setDischargeForm((p) => ({ ...p, reasonDetails: e.target.value }))} placeholder="Share a short explanation in your own words (timing, circumstances, anything staff should know)" />{dischargeErrors.reasonDetails && <div className="error">{dischargeErrors.reasonDetails}</div>}</div>
                      <div className="field full"><label>Anything else we should know?</label><textarea value={dischargeForm.otherInfo} onChange={(e) => setDischargeForm((p) => ({ ...p, otherInfo: e.target.value }))} placeholder="Optional" /></div>
                      {dischargeErrors.submit && <div className="error full">{dischargeErrors.submit}</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="submit-row"><button type="button" className="primary-btn" onClick={handlePrimarySubmit}>Submit Request</button></div>
            </div>
          </div>
        </div>

        <nav className="mobile-bottom-nav">
          <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
          <BookUser size={24} color="#A3AED0" onClick={() => navigate('/patient-details')} />
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
            <FileText size={24} color="#A3AED0" />
          </button>
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
          <LogOut size={24} color="#A3AED0" onClick={() => navigate('/login')} />
        </nav>
      </main>
      <FloatingChatHead />

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
            <h3 className="modal-title">Confirm submission</h3>
            <p className="modal-body-text">
              {confirmModal.type === 'discharge'
                ? 'Submit this discharge request for your family member? Our team will review it and reach out if we need anything else.'
                : 'Submit this admission request now?'}
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