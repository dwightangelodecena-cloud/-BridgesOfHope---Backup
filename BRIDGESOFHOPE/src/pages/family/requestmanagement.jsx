import React, { useEffect, useRef, useState } from 'react';
import { Home, User, LogOut, Bell, CheckCircle2, CheckCircle, BookUser, FileText, ClipboardList, Calendar } from 'lucide-react';
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
} from '@/lib/admissionRequestInsert';
import { uploadAdmissionDocuments } from '@/lib/admissionDocumentUpload';
import { parseAttachedFiles } from '@/lib/admissionWorkflow';
import {
  fetchFamilyAdmissionRequests,
  visibleFamilyAdmissionRequests,
} from '@/lib/familyAdmissionRequests';
import {
  ADMISSION_DEFAULT_REASON,
  RELATIONSHIP_OPTIONS,
} from '@/lib/admissionFormConfig';
import AdmissionFormPanel, { ADMISSION_FORM_PANEL_STYLES } from '@/components/family/AdmissionFormPanel';
import { ArrowRight, Save, Eraser } from 'lucide-react';

const EMPTY_ADMISSION_FORM = {
  patientLastName: '',
  patientFirstName: '',
  relationshipToResident: '',
  agreeToTerms: false,
};

const ADMISSION_DRAFT_KEY = 'bh_admission_form_draft';
const STICKY_BAR_HEIGHT = 68;
const CHAT_BOTTOM_WITH_STICKY = STICKY_BAR_HEIGHT + 16;

function formatRelativeTime(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 10) return 'just now';
    if (secs < 60) return `${secs} seconds ago`;
    const mins = Math.floor(secs / 60);
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return '1 hour ago';
    return `${hrs} hours ago`;
  } catch {
    return null;
  }
}

const Progress = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [familyNotifUserId, setFamilyNotifUserId] = useState('');
  const [patients, setPatients] = useState([]);
  const [activeTab, setActiveTab] = useState('admission');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  const [showTermsModal, setShowTermsModal] = useState(false);

  useFamilyPatientProgressRealtime();

  const [admissionForm, setAdmissionForm] = useState({ ...EMPTY_ADMISSION_FORM });
  const [validIdFile, setValidIdFile] = useState(null);
  const [birthCertFile, setBirthCertFile] = useState(null);
  const [hospitalReferralFile, setHospitalReferralFile] = useState(null);
  const validIdInputRef = useRef(null);
  const birthCertInputRef = useRef(null);
  const referralInputRef = useRef(null);
  const [submittedAdmissions, setSubmittedAdmissions] = useState([]);
  const [familyUserId, setFamilyUserId] = useState('');
  const [guardianProfile, setGuardianProfile] = useState({ fullName: '', email: '', phone: '' });
  const [supplementalUploadId, setSupplementalUploadId] = useState('');
  const supplementalFileRef = useRef(null);
  const [admissionErrors, setAdmissionErrors] = useState({});
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [lastActivityAt, setLastActivityAt] = useState(null);

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
    { key: 'relationshipToResident', label: 'Relationship to Resident' },
    { key: 'validIdFile', label: 'Valid ID', isFile: true },
    { key: 'birthCertFile', label: 'Birth Certificate', isFile: true },
  ];

  const isAdmissionFieldDone = (field) => {
    if (field.isFile) {
      if (field.key === 'validIdFile') return Boolean(validIdFile);
      if (field.key === 'birthCertFile') return Boolean(birthCertFile);
      return false;
    }
    return Boolean(String(admissionForm[field.key] || '').trim());
  };

  const admissionCompletedFields = admissionRequiredFields.filter(isAdmissionFieldDone).length;
  const admissionProgressPercent = Math.round((admissionCompletedFields / admissionRequiredFields.length) * 100);
  const selectedPatient = patients.find((p) => String(p.id) === String(selectedPatientId));
  const visibleSubmittedAdmissions = visibleFamilyAdmissionRequests(submittedAdmissions, familyUserId);

  const getPatientFullName = (form = admissionForm) =>
    [form.patientFirstName, form.patientLastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');

  const relationshipLabel = (value) =>
    RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label || value || '—';

  useEffect(() => {
    const requestedTab = location.state?.tab;
    if (requestedTab === 'admission' || requestedTab === 'discharge') {
      setActiveTab(requestedTab);
    }
  }, [location.state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMISSION_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.admissionForm) {
        setAdmissionForm((prev) => ({
          ...prev,
          patientLastName: parsed.admissionForm.patientLastName || '',
          patientFirstName: parsed.admissionForm.patientFirstName || '',
          relationshipToResident: parsed.admissionForm.relationshipToResident || '',
          agreeToTerms: false,
        }));
      }
      if (parsed?.savedAt) setDraftSavedAt(parsed.savedAt);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'admission') return undefined;
    setAutosaveStatus('saving');
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(
        ADMISSION_DRAFT_KEY,
        JSON.stringify({
          admissionForm: {
            patientLastName: admissionForm.patientLastName,
            patientFirstName: admissionForm.patientFirstName,
            relationshipToResident: admissionForm.relationshipToResident,
          },
          savedAt,
        })
      );
      setDraftSavedAt(savedAt);
      setAutosaveStatus('saved');
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    admissionForm.patientLastName,
    admissionForm.patientFirstName,
    admissionForm.relationshipToResident,
  ]);

  useEffect(() => {
    if (validIdFile || birthCertFile || hospitalReferralFile) {
      setLastActivityAt(new Date().toISOString());
    }
  }, [validIdFile, birthCertFile, hospitalReferralFile]);

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
    let cancelled = false;
    const loadUserAndAdmissions = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user?.id) {
        if (!cancelled) {
          setFamilyUserId('');
          setSubmittedAdmissions([]);
        }
        return;
      }
      if (cancelled) return;
      setFamilyNotifUserId(user.id);
      setFamilyUserId(user.id);
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
      if (cancelled) return;
      setGuardianProfile({
        fullName: fullName || 'Family User',
        email: user.email || '',
        phone: phone || '',
      });
      if (isSupabaseConfigured()) {
        const rows = await fetchFamilyAdmissionRequests(user.id);
        if (!cancelled) setSubmittedAdmissions(rows);
      }
    };
    loadUserAndAdmissions();
    window.addEventListener(APP_DATA_REFRESH, loadUserAndAdmissions);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_DATA_REFRESH, loadUserAndAdmissions);
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
    setLastActivityAt(new Date().toISOString());
    setAdmissionForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (admissionErrors[name]) {
      setAdmissionErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateAdmission = () => {
    const errs = {};
    if (!admissionForm.patientLastName.trim()) errs.patientLastName = 'Resident last name is required.';
    if (!admissionForm.patientFirstName.trim()) errs.patientFirstName = 'Resident first name is required.';
    if (!admissionForm.relationshipToResident) errs.relationshipToResident = 'Please select your relationship to the resident.';
    if (!validIdFile) errs.validIdFile = 'Please upload a valid ID.';
    if (!birthCertFile) errs.birthCertFile = 'Please upload a birth certificate.';
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
    const relationship = admissionForm.relationshipToResident;
    const formSnapshot = {
      patientLastName: admissionForm.patientLastName.trim(),
      patientFirstName: admissionForm.patientFirstName.trim(),
      relationshipToResident: relationship,
      relationshipLabel: relationshipLabel(relationship),
      hasHospitalReferral: Boolean(hospitalReferralFile),
    };
    const filesToUpload = [
      validIdFile ? { file: validIdFile, documentType: 'valid_id' } : null,
      birthCertFile ? { file: birthCertFile, documentType: 'birth_cert' } : null,
      hospitalReferralFile ? { file: hospitalReferralFile, documentType: 'hospital_referral' } : null,
    ].filter(Boolean);
    const uploadResult = await uploadAdmissionDocuments(filesToUpload, user.id, 'pending');
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
      reason_for_admission: ADMISSION_DEFAULT_REASON,
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
      reason_for_admission: ADMISSION_DEFAULT_REASON,
      status: 'processing',
    };
    const minimalRow = {
      family_id: user.id,
      guardian_full_name: guardianProfile.fullName.trim(),
      guardian_email: guardianProfile.email.trim(),
      guardian_phone: guardianProfile.phone.trim(),
      patient_name: getPatientFullName(),
      reason_for_admission: ADMISSION_DEFAULT_REASON,
      status: 'processing',
    };
    const insertResult = await insertAdmissionRequest([extendedRow, coreRow, minimalRow]);
    if (!insertResult.ok) {
      setAdmissionErrors({ submit: insertResult.errorMessage });
      return;
    }
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
    const rows = await fetchFamilyAdmissionRequests(user.id);
    setSubmittedAdmissions(rows);
    setAdmissionForm({ ...EMPTY_ADMISSION_FORM });
    setValidIdFile(null);
    setBirthCertFile(null);
    setHospitalReferralFile(null);
    localStorage.removeItem(ADMISSION_DRAFT_KEY);
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
    const rows = await fetchFamilyAdmissionRequests(user.id);
    setSubmittedAdmissions(rows);
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

  const saveAdmissionDraft = () => {
    const savedAt = new Date().toISOString();
    localStorage.setItem(
      ADMISSION_DRAFT_KEY,
      JSON.stringify({
        admissionForm: {
          patientLastName: admissionForm.patientLastName,
          patientFirstName: admissionForm.patientFirstName,
          relationshipToResident: admissionForm.relationshipToResident,
        },
        savedAt,
      })
    );
    setDraftSavedAt(savedAt);
    setAutosaveStatus('saved');
  };

  const clearAdmissionForm = () => {
    const hasContent =
      admissionForm.patientLastName.trim()
      || admissionForm.patientFirstName.trim()
      || admissionForm.relationshipToResident
      || admissionForm.agreeToTerms
      || validIdFile
      || birthCertFile
      || hospitalReferralFile;

    if (hasContent && !window.confirm('Clear this admission form? All entered fields and uploads will be removed.')) {
      return;
    }

    setAdmissionForm({ ...EMPTY_ADMISSION_FORM });
    setValidIdFile(null);
    setBirthCertFile(null);
    setHospitalReferralFile(null);
    if (validIdInputRef.current) validIdInputRef.current.value = '';
    if (birthCertInputRef.current) birthCertInputRef.current.value = '';
    if (referralInputRef.current) referralInputRef.current.value = '';
    setAdmissionErrors({});
    localStorage.removeItem(ADMISSION_DRAFT_KEY);
    setDraftSavedAt(null);
    setAutosaveStatus('idle');
    setLastActivityAt(null);
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
        .content-area { flex: 1; padding: 24px 30px 100px; overflow-y: auto; position: relative; }
        .content-wrap { width: 100%; max-width: 1060px; margin: 0 auto; position: relative; z-index: 1; }
        .req-page-bg-shape {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .req-page-bg-shape--1 {
          width: 320px;
          height: 320px;
          top: -80px;
          right: -60px;
          background: radial-gradient(circle, rgba(245, 78, 37, 0.07) 0%, transparent 70%);
        }
        .req-page-bg-shape--2 {
          width: 240px;
          height: 240px;
          bottom: 12%;
          left: -80px;
          background: radial-gradient(circle, rgba(27, 37, 89, 0.05) 0%, transparent 70%);
        }
        .req-page-intro {
          margin-bottom: 20px;
        }
        .req-page-subtitle {
          margin: 0 0 16px;
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.6;
          font-weight: 500;
        }
        .req-workflow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .req-workflow__step {
          font-size: 0.78rem;
          font-weight: 700;
          color: #94a3b8;
          padding: 6px 12px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          transition: color 0.2s, background 0.2s, border-color 0.2s;
        }
        .req-workflow__step--active {
          color: #F54E25;
          background: rgba(245, 78, 37, 0.08);
          border-color: rgba(245, 78, 37, 0.2);
        }
        .req-workflow__arrow { color: #cbd5e1; flex-shrink: 0; }
        .request-shell {
          background: #fff;
          border: 1px solid #E9EDF7;
          border-radius: 22px;
          padding: 28px 28px 32px;
          min-height: calc(100vh - 200px);
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.07);
        }
        .tabs {
          margin-bottom: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background: #F8FAFF;
          border: 1px solid #E5ECFA;
          border-radius: 16px;
          padding: 6px;
        }
        .tab-btn {
          border: 1px solid transparent;
          background: transparent;
          border-radius: 12px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.92rem;
          color: #475569;
          cursor: pointer;
          transition: background 0.22s ease, border-color 0.22s ease, color 0.22s ease, transform 0.15s ease, box-shadow 0.22s ease;
        }
        .tab-btn:hover {
          background: #FFFFFF;
          border-color: #E2E8F0;
          color: #334155;
        }
        .tab-btn.active {
          background: linear-gradient(180deg, #FFF5F1 0%, #FFFFFF 100%);
          border-color: #FBCBBE;
          color: #F54E25;
          box-shadow: 0 8px 22px rgba(245, 78, 37, 0.14);
          transform: translateY(-1px);
        }
        .form-surface {
          margin-top: 0;
          border: none;
          border-radius: 0;
          background: transparent;
          padding: 0;
        }
        ${ADMISSION_FORM_PANEL_STYLES}
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
        .req-sticky-bar {
          position: fixed;
          bottom: 0;
          right: 0;
          z-index: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 12px 28px;
          padding-right: 96px;
          background: rgba(255, 255, 255, 0.97);
          border-top: 1px solid #E9EDF7;
          box-shadow: 0 -6px 28px rgba(15, 23, 42, 0.07);
          backdrop-filter: blur(12px);
          transition: left 0.3s ease;
        }
        .req-sticky-bar__meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .req-sticky-bar__autosave {
          font-size: 0.82rem;
          font-weight: 700;
          color: #1B2559;
        }
        .req-sticky-bar__autosave--saving { color: #64748b; }
        .req-sticky-bar__autosave--saved { color: #16a34a; }
        .req-sticky-bar__saved-at {
          font-size: 0.76rem;
          font-weight: 500;
          color: #94a3b8;
        }
        .req-sticky-bar__actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .req-draft-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid #E2E8F0;
          background: #fff;
          color: #475569;
          font-weight: 700;
          font-size: 0.88rem;
          padding: 11px 18px;
          border-radius: 12px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .req-draft-btn:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }
        .req-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid #fecaca;
          background: #fff;
          color: #dc2626;
          font-weight: 700;
          font-size: 0.88rem;
          padding: 11px 18px;
          border-radius: 12px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .req-clear-btn:hover {
          border-color: #f87171;
          background: #fef2f2;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.08);
        }
        .req-draft-toast { display: none; }
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
          .content-area { padding: 16px 14px 120px; overflow: visible; }
          .req-sticky-bar { left: 0 !important; padding: 12px 14px; flex-wrap: wrap; }
          .req-sticky-bar__meta { flex: 1 1 100%; }
          .req-sticky-bar__actions { width: 100%; }
          .req-sticky-bar__actions .primary-btn,
          .req-sticky-bar__actions .req-draft-btn,
          .req-sticky-bar__actions .req-clear-btn { flex: 1; justify-content: center; }
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
          <div className="req-page-bg-shape req-page-bg-shape--1" aria-hidden />
          <div className="req-page-bg-shape req-page-bg-shape--2" aria-hidden />
          <div className="content-wrap">
            <div className="req-page-intro">
              <p className="req-page-subtitle">
                Submit admission requests and manage resident requirements.
              </p>
              <div className="req-workflow" aria-label="Admission workflow">
                <span className={`req-workflow__step ${activeTab === 'admission' ? 'req-workflow__step--active' : ''}`}>
                  Admission
                </span>
                <ArrowRight size={14} className="req-workflow__arrow" aria-hidden />
                <span className="req-workflow__step">Review</span>
                <ArrowRight size={14} className="req-workflow__arrow" aria-hidden />
                <span className="req-workflow__step">Approval</span>
              </div>
            </div>
            <div className="request-shell">
              <div className="tabs">
                <button className={`tab-btn ${activeTab === 'admission' ? 'active' : ''}`} onClick={() => setActiveTab('admission')}>Admission Form</button>
                <button className={`tab-btn ${activeTab === 'discharge' ? 'active' : ''}`} onClick={() => setActiveTab('discharge')}>Temporary discharge</button>
              </div>

              {activeTab === 'admission' && (
                <div className="form-surface">
                  <AdmissionFormPanel
                    admissionForm={admissionForm}
                    admissionErrors={admissionErrors}
                    handleAdmissionChange={handleAdmissionChange}
                    validIdFile={validIdFile}
                    birthCertFile={birthCertFile}
                    hospitalReferralFile={hospitalReferralFile}
                    validIdInputRef={validIdInputRef}
                    birthCertInputRef={birthCertInputRef}
                    referralInputRef={referralInputRef}
                    setValidIdFile={setValidIdFile}
                    setBirthCertFile={setBirthCertFile}
                    setHospitalReferralFile={setHospitalReferralFile}
                    setAdmissionErrors={setAdmissionErrors}
                    admissionRequiredFields={admissionRequiredFields}
                    isAdmissionFieldDone={isAdmissionFieldDone}
                    admissionCompletedFields={admissionCompletedFields}
                    admissionProgressPercent={admissionProgressPercent}
                    visibleSubmittedAdmissions={visibleSubmittedAdmissions}
                    relationshipLabel={relationshipLabel}
                    setShowTermsModal={setShowTermsModal}
                    supplementalUploadId={supplementalUploadId}
                    supplementalFileRef={supplementalFileRef}
                    setSupplementalUploadId={setSupplementalUploadId}
                    uploadSupplementalDocuments={uploadSupplementalDocuments}
                    lastActivityAt={lastActivityAt}
                  />
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

              {activeTab === 'discharge' && (
                <div className="submit-row">
                  <button type="button" className="primary-btn" onClick={handlePrimarySubmit}>Submit Request</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'admission' && (
          <div
            className="req-sticky-bar"
            style={{ left: isExpanded ? 280 : 110 }}
            role="region"
            aria-label="Admission form actions"
          >
            <div className="req-sticky-bar__meta">
              <span className={`req-sticky-bar__autosave req-sticky-bar__autosave--${autosaveStatus}`}>
                {autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'saved' ? 'Autosaved' : 'Draft ready'}
              </span>
              {draftSavedAt && formatRelativeTime(draftSavedAt) ? (
                <span className="req-sticky-bar__saved-at">
                  Last saved {formatRelativeTime(draftSavedAt)}
                </span>
              ) : null}
            </div>
            <div className="req-sticky-bar__actions">
              <button type="button" className="req-clear-btn" onClick={clearAdmissionForm}>
                <Eraser size={16} />
                Clear
              </button>
              <button type="button" className="req-draft-btn" onClick={saveAdmissionDraft}>
                <Save size={16} />
                Save Draft
              </button>
              <button type="button" className="primary-btn" onClick={handlePrimarySubmit}>
                Submit Request
              </button>
            </div>
          </div>
        )}

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
      <FloatingChatHead bottomOffset={activeTab === 'admission' ? CHAT_BOTTOM_WITH_STICKY : 24} />

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