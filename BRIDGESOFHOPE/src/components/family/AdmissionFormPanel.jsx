import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Users,
  Upload,
  FileText,
  Shield,
  Info,
  CheckCircle2,
  Circle,
  Paperclip,
  CheckCircle,
  Sparkles,
  X,
  Eye,
  ChevronDown,
  Clock,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import {
  ADMISSION_DEFAULT_REASON,
  ADMISSION_FORM_SUBTITLE,
  ADMISSION_FORM_TITLE,
  ADMISSION_REQUIREMENTS_NOTE,
  PATIENT_GENDER_OPTIONS,
  REASON_FOR_ADMISSION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  patientGenderLabel,
  reasonForAdmissionLabel,
  validatePatientGender,
  validateReasonForAdmission,
} from '@/lib/admissionFormConfig';
import { resolveAdmissionDocumentsForView } from '@/lib/admissionDocumentAccess';
import { AdmissionAttachedFilesList } from '@/components/admin/AdmissionAttachedFilesList';
import { FamilySupplementalDocumentsList } from '@/components/family/FamilySupplementalDocumentsList';
import {
  admissionStatusLabel,
  admissionStatusPillClass,
  partitionAdmissionDocuments,
} from '@/lib/admissionWorkflow';

function deriveInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => (p[0] ? p[0].toUpperCase() : ''))
    .join('') || '?';
}

function parseFormData(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function formatSubmittedDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatRelativeTime(iso) {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 10) return 'Just now';
    if (secs < 60) return `${secs} seconds ago`;
    const mins = Math.floor(secs / 60);
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return '1 hour ago';
    return `${hrs} hours ago`;
  } catch {
    return '—';
  }
}

function ProgressRing({ percent }) {
  const size = 96;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="adm-ring" aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="adm-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="adm-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="adm-ring__label">{percent}%</span>
    </div>
  );
}

function UploadDropzone({
  title,
  description,
  file,
  inputRef,
  onFileSelect,
  onClear,
  error,
  optional = false,
  accent = 'orange',
}) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) onFileSelect(f);
    },
    [onFileSelect]
  );

  return (
    <div
      className={[
        'adm-upload',
        file ? 'adm-upload--done' : '',
        dragOver ? 'adm-upload--drag' : '',
        error ? 'adm-upload--error' : '',
        accent === 'navy' ? 'adm-upload--navy' : '',
      ].filter(Boolean).join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !file && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />
      {file ? (
        <div className="adm-upload__success">
          <div className="adm-upload__success-icon">
            <CheckCircle2 size={22} strokeWidth={2.25} />
          </div>
          <div className="adm-upload__success-text">
            <strong>{title} uploaded</strong>
            <span>
              <Paperclip size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              {file.name}
            </span>
          </div>
          <button
            type="button"
            className="adm-upload__replace"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Replace
          </button>
          <button
            type="button"
            className="adm-upload__clear"
            aria-label={`Remove ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="adm-upload__icon">
            <FileText size={26} strokeWidth={1.75} />
          </div>
          <div className="adm-upload__title">{title}{optional ? '' : ' *'}</div>
          <p className="adm-upload__hint">{description || 'Drag files here or click to browse'}</p>
          <p className="adm-upload__meta">Accepted: PNG, JPG, PDF · Maximum: 10 MB</p>
          <button
            type="button"
            className="adm-upload__browse"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Upload size={16} />
            Browse files
          </button>
        </>
      )}
      {error ? <p className="adm-field-error">{error}</p> : null}
    </div>
  );
}

function FormSectionCard({
  sectionNumber,
  icon: Icon,
  title,
  description,
  helper,
  children,
  className = '',
}) {
  return (
    <section className={`adm-section-card ${className}`.trim()}>
      <div className="adm-section-card__head">
        {sectionNumber ? (
          <span className="adm-section-card__num" aria-hidden>
            {sectionNumber}
          </span>
        ) : null}
        <div className="adm-section-card__icon" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="adm-section-card__head-text">
          <h3 className="adm-section-card__title">{title}</h3>
          {description ? <p className="adm-section-card__desc">{description}</p> : null}
          {helper ? <p className="adm-section-card__helper">{helper}</p> : null}
        </div>
      </div>
      <div className="adm-section-card__body">{children}</div>
    </section>
  );
}

export default function AdmissionFormPanel({
  admissionForm,
  admissionErrors,
  handleAdmissionChange,
  validIdFile,
  birthCertFile,
  hospitalReferralFile,
  validIdInputRef,
  birthCertInputRef,
  referralInputRef,
  setValidIdFile,
  setBirthCertFile,
  setHospitalReferralFile,
  setAdmissionErrors,
  admissionRequiredFields,
  isAdmissionFieldDone,
  admissionCompletedFields,
  admissionProgressPercent,
  visibleSubmittedAdmissions,
  relationshipLabel,
  setShowTermsModal,
  supplementalUploadId,
  supplementalFileRef,
  setSupplementalUploadId,
  uploadSupplementalDocuments,
  removeSupplementalDocument,
  startReplaceSupplementalDocument,
  replaceSupplementalRef,
  onReplaceSupplementalFile,
  supplementalBusyKey,
  supplementalDocError,
  documentsRefreshKey,
  lastActivityAt,
}) {
  const remainingTasks = admissionRequiredFields.length - admissionCompletedFields;
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [expandedDocuments, setExpandedDocuments] = useState([]);
  const [expandedDocumentsLoading, setExpandedDocumentsLoading] = useState(false);
  const [justCompletedKey, setJustCompletedKey] = useState(null);
  const prevDoneKeysRef = useRef(new Set());
  const estimatedMinutes = Math.max(1, remainingTasks * 2);

  useEffect(() => {
    let popTimer;
    admissionRequiredFields.forEach((field) => {
      const done = isAdmissionFieldDone(field);
      if (done && !prevDoneKeysRef.current.has(field.key)) {
        prevDoneKeysRef.current.add(field.key);
        setJustCompletedKey(field.key);
        popTimer = window.setTimeout(() => setJustCompletedKey(null), 700);
      }
      if (!done) prevDoneKeysRef.current.delete(field.key);
    });
    return () => {
      if (popTimer) window.clearTimeout(popTimer);
    };
  }, [admissionRequiredFields, isAdmissionFieldDone, admissionCompletedFields]);

  useEffect(() => {
    if (!expandedRequestId) {
      setExpandedDocuments([]);
      setExpandedDocumentsLoading(false);
      return undefined;
    }

    const row = visibleSubmittedAdmissions.find((r) => r.id === expandedRequestId);
    if (!row) return undefined;

    let cancelled = false;
    setExpandedDocumentsLoading(true);
    void (async () => {
      try {
        const files = await resolveAdmissionDocumentsForView({
          requestId: row.id,
          attachedFiles: row.attached_files,
          familyId: row.family_id,
          createdAfter: row.created_at,
        });
        if (!cancelled) setExpandedDocuments(files);
      } catch {
        if (!cancelled) setExpandedDocuments([]);
      } finally {
        if (!cancelled) setExpandedDocumentsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expandedRequestId, visibleSubmittedAdmissions, documentsRefreshKey]);

  const nextField = useMemo(
    () => admissionRequiredFields.find((f) => !isAdmissionFieldDone(f)),
    [admissionRequiredFields, isAdmissionFieldDone]
  );

  const statusText =
    admissionProgressPercent === 100 ? 'Ready to Submit' : admissionProgressPercent > 0 ? 'In Progress' : 'Not Started';

  const clearUploadError = (key) => {
    if (admissionErrors[key]) {
      setAdmissionErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const fieldState = (key, value, isFile = false) => {
    if (admissionErrors[key]) return 'error';
    if (key === 'reasonForAdmission') {
      if (!validateReasonForAdmission(value)) return 'valid';
      return 'idle';
    }
    if (key === 'patientGender') {
      if (!validatePatientGender(value)) return 'valid';
      return 'idle';
    }
    if (isFile ? Boolean(value) : Boolean(String(value || '').trim())) return 'valid';
    return 'idle';
  };

  return (
    <div className="adm-form-panel">
      <header className="adm-form-hero">
        <div className="adm-form-hero__row">
          <div className="adm-form-hero__main">
            <span className="adm-form-kicker">
              <Sparkles size={13} />
              Admission workflow
            </span>
            <h2 className="adm-form-hero__title">{ADMISSION_FORM_TITLE}</h2>
            <p className="adm-form-hero__sub">{ADMISSION_FORM_SUBTITLE}</p>
          </div>
          <span className="adm-form-pill adm-form-pill--review">
            <CheckCircle size={13} />
            Admin review required
          </span>
        </div>
      </header>

      <div className="adm-dashboard">
        <div className="adm-dashboard__ring-wrap">
          <ProgressRing percent={admissionProgressPercent} />
          <span className="adm-dashboard__ring-caption">Overall completion</span>
        </div>
        <div className="adm-stat-grid">
          <div className="adm-stat-card">
            <span className="adm-stat-card__label">Completion</span>
            <strong className="adm-stat-card__value">{admissionProgressPercent}%</strong>
          </div>
          <div className="adm-stat-card">
            <span className="adm-stat-card__label">Requirements completed</span>
            <strong className="adm-stat-card__value">
              {admissionCompletedFields} of {admissionRequiredFields.length}
            </strong>
          </div>
          <div className="adm-stat-card">
            <span className="adm-stat-card__label">Current status</span>
            <strong className={`adm-stat-card__value adm-stat-card__value--${admissionProgressPercent === 100 ? 'ready' : admissionProgressPercent > 0 ? 'progress' : 'pending'}`}>
              {statusText}
            </strong>
          </div>
          <div className="adm-stat-card">
            <span className="adm-stat-card__label">Remaining tasks</span>
            <strong className="adm-stat-card__value adm-stat-card__value--muted">{remainingTasks}</strong>
          </div>
        </div>
      </div>

      <div className="adm-meta-strip">
        <span className="adm-meta-strip__item">
          <Clock size={14} aria-hidden />
          ~{estimatedMinutes} min estimated to finish
        </span>
        <span className="adm-meta-strip__item adm-meta-strip__item--muted">
          Last activity {formatRelativeTime(lastActivityAt)}
        </span>
      </div>

      <div className="adm-checklist-card">
        <h3 className="adm-checklist-card__title">Admission checklist</h3>
        <ul className="adm-checklist">
          {admissionRequiredFields.map((field) => {
            const done = isAdmissionFieldDone(field);
            const isNext = nextField?.key === field.key && !done;
            const isPop = justCompletedKey === field.key;
            return (
              <li
                key={field.key}
                className={[
                  'adm-checklist__item',
                  done ? 'adm-checklist__item--done' : '',
                  isNext ? 'adm-checklist__item--next' : '',
                  isPop ? 'adm-checklist__item--pop' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="adm-checklist__icon" aria-hidden>
                  {done ? (
                    <CheckCircle2 size={18} />
                  ) : isNext ? (
                    <ArrowRight size={18} />
                  ) : (
                    <Circle size={18} />
                  )}
                </span>
                <span className="adm-checklist__label">{field.label}</span>
                <span className="adm-checklist__status">
                  {done ? 'Completed' : isNext ? 'Next' : 'Pending'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="adm-info-banner">
        <Info size={20} className="adm-info-banner__icon" aria-hidden />
        <div>
          <strong>Requirements before admitting a resident</strong>
          <p>{ADMISSION_REQUIREMENTS_NOTE}</p>
        </div>
      </div>

      <FormSectionCard
        sectionNumber={1}
        icon={User}
        title="Resident information"
        description="Legal first and last name, date of birth, and reason admission is being requested."
        helper="Use the name exactly as it appears on official documents."
      >
        <div className="adm-fields-grid">
          <div className={`adm-field adm-field--required adm-field--${fieldState('patientLastName', admissionForm.patientLastName)}`}>
            <label htmlFor="adm-last-name">
              Resident last name <span className="adm-required-mark">*</span>
            </label>
            <div className="adm-input-wrap">
              <User className="adm-input-icon" size={18} />
              <input
                id="adm-last-name"
                name="patientLastName"
                placeholder="Enter last name"
                value={admissionForm.patientLastName}
                onChange={handleAdmissionChange}
              />
            </div>
            {admissionErrors.patientLastName ? (
              <p className="adm-field-error">{admissionErrors.patientLastName}</p>
            ) : fieldState('patientLastName', admissionForm.patientLastName) === 'valid' ? (
              <p className="adm-field-ok">Looks good</p>
            ) : null}
          </div>
          <div className={`adm-field adm-field--required adm-field--${fieldState('patientFirstName', admissionForm.patientFirstName)}`}>
            <label htmlFor="adm-first-name">
              Resident first name <span className="adm-required-mark">*</span>
            </label>
            <div className="adm-input-wrap">
              <User className="adm-input-icon" size={18} />
              <input
                id="adm-first-name"
                name="patientFirstName"
                placeholder="Enter first name"
                value={admissionForm.patientFirstName}
                onChange={handleAdmissionChange}
              />
            </div>
            {admissionErrors.patientFirstName ? (
              <p className="adm-field-error">{admissionErrors.patientFirstName}</p>
            ) : fieldState('patientFirstName', admissionForm.patientFirstName) === 'valid' ? (
              <p className="adm-field-ok">Looks good</p>
            ) : null}
          </div>
          <div className={`adm-field adm-field--full adm-field--required adm-field--${fieldState('patientBirthDate', admissionForm.patientBirthDate)}`}>
            <label htmlFor="adm-birth-date">
              Date of birth <span className="adm-required-mark">*</span>
            </label>
            <div className="adm-input-wrap">
              <Calendar className="adm-input-icon" size={18} />
              <input
                id="adm-birth-date"
                name="patientBirthDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={admissionForm.patientBirthDate}
                onChange={handleAdmissionChange}
              />
            </div>
            {admissionErrors.patientBirthDate ? (
              <p className="adm-field-error">{admissionErrors.patientBirthDate}</p>
            ) : fieldState('patientBirthDate', admissionForm.patientBirthDate) === 'valid' ? (
              <p className="adm-field-ok">Looks good</p>
            ) : null}
          </div>
          <div className={`adm-field adm-field--full adm-field--required adm-field--${fieldState('patientGender', admissionForm.patientGender)}`}>
            <label htmlFor="adm-gender">
              Gender <span className="adm-required-mark">*</span>
            </label>
            <div className="adm-input-wrap">
              <User className="adm-input-icon" size={18} />
              <select
                id="adm-gender"
                name="patientGender"
                value={admissionForm.patientGender}
                onChange={handleAdmissionChange}
              >
                {PATIENT_GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value || 'placeholder'} value={opt.value} disabled={!opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {admissionErrors.patientGender ? (
              <p className="adm-field-error">{admissionErrors.patientGender}</p>
            ) : fieldState('patientGender', admissionForm.patientGender) === 'valid' ? (
              <p className="adm-field-ok">Selected</p>
            ) : null}
          </div>
          <div className={`adm-field adm-field--full adm-field--required adm-field--${fieldState('reasonForAdmission', admissionForm.reasonForAdmission)}`}>
            <label htmlFor="adm-reason">
              Reason for admission <span className="adm-required-mark">*</span>
            </label>
            <div className="adm-input-wrap">
              <FileText className="adm-input-icon" size={18} />
              <select
                id="adm-reason"
                name="reasonForAdmission"
                value={admissionForm.reasonForAdmission}
                onChange={handleAdmissionChange}
              >
                {REASON_FOR_ADMISSION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'placeholder'} value={opt.value} disabled={!opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {admissionErrors.reasonForAdmission ? (
              <p className="adm-field-error">{admissionErrors.reasonForAdmission}</p>
            ) : fieldState('reasonForAdmission', admissionForm.reasonForAdmission) === 'valid' ? (
              <p className="adm-field-ok">Selected</p>
            ) : null}
          </div>
        </div>
      </FormSectionCard>

      <FormSectionCard
        sectionNumber={2}
        icon={Users}
        title="Relationship information"
        description="Your relationship to the resident submitting this request."
        helper="Select the option that best describes your connection to the resident."
      >
        <div className={`adm-field adm-field--full adm-field--required adm-field--${fieldState('relationshipToResident', admissionForm.relationshipToResident)}`}>
          <label htmlFor="adm-relationship">
            Relationship to resident <span className="adm-required-mark">*</span>
          </label>
          <div className="adm-input-wrap">
            <Users className="adm-input-icon" size={18} />
            <select
              id="adm-relationship"
              name="relationshipToResident"
              value={admissionForm.relationshipToResident}
              onChange={handleAdmissionChange}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.value || 'placeholder'} value={opt.value} disabled={!opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {admissionErrors.relationshipToResident ? (
            <p className="adm-field-error">{admissionErrors.relationshipToResident}</p>
          ) : fieldState('relationshipToResident', admissionForm.relationshipToResident) === 'valid' ? (
            <p className="adm-field-ok">Selected</p>
          ) : null}
        </div>
      </FormSectionCard>

      <FormSectionCard
        sectionNumber={3}
        icon={FileText}
        title="Required documents"
        description="Upload clear copies of identification and birth certificate."
        helper="Accepted formats: PNG, JPG, or PDF — maximum 10 MB each."
      >
        <div className="adm-upload-grid">
          <UploadDropzone
            title="Valid ID"
            file={validIdFile}
            inputRef={validIdInputRef}
            onFileSelect={(f) => {
              setValidIdFile(f);
              clearUploadError('validIdFile');
            }}
            onClear={() => {
              setValidIdFile(null);
              if (validIdInputRef.current) validIdInputRef.current.value = '';
            }}
            error={admissionErrors.validIdFile}
          />
          <UploadDropzone
            title="Birth Certificate"
            file={birthCertFile}
            inputRef={birthCertInputRef}
            onFileSelect={(f) => {
              setBirthCertFile(f);
              clearUploadError('birthCertFile');
            }}
            onClear={() => {
              setBirthCertFile(null);
              if (birthCertInputRef.current) birthCertInputRef.current.value = '';
            }}
            error={admissionErrors.birthCertFile}
          />
        </div>
      </FormSectionCard>

      <FormSectionCard
        sectionNumber={4}
        icon={Upload}
        title="Optional documents"
        description="Hospital referrals are welcome but not required for private admission."
        helper="Families may attach a hospital referral if one is available."
        className="adm-section-card--optional"
      >
        <UploadDropzone
          title="Hospital Referral"
          description="Optional — families may provide a referral from a hospital."
          file={hospitalReferralFile}
          inputRef={referralInputRef}
          optional
          accent="navy"
          onFileSelect={setHospitalReferralFile}
          onClear={() => {
            setHospitalReferralFile(null);
            if (referralInputRef.current) referralInputRef.current.value = '';
          }}
        />
      </FormSectionCard>

      <FormSectionCard
        sectionNumber={5}
        icon={Shield}
        title="Consent & submission"
        description="Review policies before submitting your request."
        helper="You must agree before your admission request can be submitted."
      >
        <div className="adm-consent">
          <div className="adm-consent__shield">
            <Shield size={22} />
            <span>Your information is securely protected.</span>
          </div>
          <label className="adm-consent__check">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={admissionForm.agreeToTerms}
              onChange={handleAdmissionChange}
            />
            <span>
              I agree to the{' '}
              <button type="button" className="adm-link" onClick={() => setShowTermsModal(true)}>
                Privacy Policy
              </button>{' '}
              and{' '}
              <button type="button" className="adm-link" onClick={() => setShowTermsModal(true)}>
                Terms
              </button>
              .
            </span>
          </label>
          {admissionErrors.agreeToTerms ? <p className="adm-field-error">{admissionErrors.agreeToTerms}</p> : null}
          {admissionErrors.submit ? <p className="adm-field-error adm-field-error--center">{admissionErrors.submit}</p> : null}
        </div>
      </FormSectionCard>

      {visibleSubmittedAdmissions.length > 0 ? (
        <section className="adm-submitted">
          <h3 className="adm-submitted__title">Submitted admission requests</h3>
          <div className="adm-submitted__list">
            {visibleSubmittedAdmissions.map((row) => {
              const formData = parseFormData(row.form_data);
              const st = admissionStatusLabel(row.status);
              const pillClass = admissionStatusPillClass(row.status);
              const inReview = String(row.status).toLowerCase() === 'in_review';
              const reason =
                (formData.reasonForAdmission || row.reason_for_admission) !== ADMISSION_DEFAULT_REASON
                  ? formData.reasonForAdmission || row.reason_for_admission
                  : null;
              const showMissingDocsSection = inReview && !row.documents_complete;
              const { submitted: submittedDocs, supplemental: supplementalDocs } =
                expandedRequestId === row.id
                  ? partitionAdmissionDocuments(expandedDocuments)
                  : { submitted: [], supplemental: [] };

              return (
                <article key={row.id} className={`adm-request-card${expandedRequestId === row.id ? ' adm-request-card--expanded' : ''}`}>
                  <div className="adm-request-card__avatar" aria-hidden>
                    {deriveInitials(row.patient_name)}
                  </div>
                  <div className="adm-request-card__main">
                    <div className="adm-request-card__head">
                      <div className="adm-request-card__info">
                        <h4 className="adm-request-card__name">{row.patient_name}</h4>
                        <p className="adm-request-card__meta">
                          {relationshipLabel(formData.relationshipToResident) !== '—'
                            ? relationshipLabel(formData.relationshipToResident)
                            : formData.relationshipLabel || 'Family member'}
                          {reason ? ` · ${reason}` : ''}
                        </p>
                        {row.created_at ? (
                          <p className="adm-request-card__date">Submitted {formatSubmittedDate(row.created_at)}</p>
                        ) : null}
                      </div>
                      <span className={`adm-status-badge ${pillClass}`}>{st}</span>
                    </div>
                    {expandedRequestId === row.id ? (
                      <div className="adm-request-card__details">
                        <dl className="adm-request-card__detail-grid">
                          <div className="adm-request-card__detail-item">
                            <dt>Reason for admission</dt>
                            <dd>
                              {reasonForAdmissionLabel(formData.reasonForAdmission || row.reason_for_admission)
                                || '—'}
                            </dd>
                          </div>
                          <div className="adm-request-card__detail-item">
                            <dt>Date of birth</dt>
                            <dd>{formatDisplayDate(formData.patientBirthDate || row.patient_birth_date)}</dd>
                          </div>
                          <div className="adm-request-card__detail-item">
                            <dt>Gender</dt>
                            <dd>
                              {patientGenderLabel(formData.patientGender || row.patient_gender) || '—'}
                            </dd>
                          </div>
                          <div className="adm-request-card__detail-item">
                            <dt>Relationship</dt>
                            <dd>
                              {relationshipLabel(formData.relationshipToResident) !== '—'
                                ? relationshipLabel(formData.relationshipToResident)
                                : formData.relationshipLabel || 'Family member'}
                            </dd>
                          </div>
                          <div className="adm-request-card__detail-item">
                            <dt>Status</dt>
                            <dd>{st}</dd>
                          </div>
                          {row.guardian_full_name ? (
                            <div className="adm-request-card__detail-item">
                              <dt>Guardian</dt>
                              <dd>{row.guardian_full_name}</dd>
                            </div>
                          ) : null}
                          {row.guardian_email ? (
                            <div className="adm-request-card__detail-item">
                              <dt>Contact email</dt>
                              <dd>{row.guardian_email}</dd>
                            </div>
                          ) : null}
                          {row.guardian_phone ? (
                            <div className="adm-request-card__detail-item">
                              <dt>Contact phone</dt>
                              <dd>{row.guardian_phone}</dd>
                            </div>
                          ) : null}
                        </dl>
                        <div className="adm-request-card__docs">
                          <p className="adm-request-card__docs-title">Submitted documents</p>
                          {expandedDocumentsLoading ? (
                            <p className="adm-request-card__docs-empty">Loading documents…</p>
                          ) : submittedDocs.length > 0 ? (
                            <AdmissionAttachedFilesList files={submittedDocs} />
                          ) : (
                            <p className="adm-request-card__docs-empty">No documents uploaded yet.</p>
                          )}
                        </div>
                        {row.meeting_date ? (
                          <p className="adm-request-card__note adm-request-card__note--meeting">
                            Meeting with BOH: {row.meeting_date}
                            {row.meeting_time ? ` at ${row.meeting_time}` : ''}
                          </p>
                        ) : null}
                        {row.required_document_notes && inReview ? (
                          <p className="adm-request-card__note adm-request-card__note--warn">
                            Required: {row.required_document_notes}
                          </p>
                        ) : null}
                        {showMissingDocsSection || supplementalDocs.length > 0 ? (
                          <div className="adm-request-card__docs adm-request-card__docs--missing">
                            <p className="adm-request-card__docs-title">Documents</p>
                            {supplementalDocs.length > 0 ? (
                              <FamilySupplementalDocumentsList
                                files={supplementalDocs}
                                requestId={row.id}
                                onRemove={removeSupplementalDocument}
                                onReplace={startReplaceSupplementalDocument}
                                busyKey={supplementalBusyKey}
                              />
                            ) : (
                              <p className="adm-request-card__docs-empty">No missing documents uploaded yet.</p>
                            )}
                            {showMissingDocsSection ? (
                              <div className="adm-request-card__actions">
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
                                  className="adm-request-card__btn"
                                  disabled={supplementalBusyKey === 'upload'}
                                  onClick={() => {
                                    setSupplementalUploadId(row.id);
                                    setTimeout(() => supplementalFileRef.current?.click(), 0);
                                  }}
                                >
                                  {supplementalBusyKey === 'upload' ? 'Uploading…' : 'Upload missing documents'}
                                </button>
                              </div>
                            ) : null}
                            {supplementalDocError ? (
                              <p className="adm-supplemental-files__error">{supplementalDocError}</p>
                            ) : null}
                          </div>
                        ) : null}
                        <input
                          ref={replaceSupplementalRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={() => void onReplaceSupplementalFile?.()}
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="adm-request-card__view"
                      onClick={() => setExpandedRequestId(expandedRequestId === row.id ? null : row.id)}
                      aria-expanded={expandedRequestId === row.id}
                    >
                      <Eye size={15} />
                      {expandedRequestId === row.id ? 'Hide details' : 'View details'}
                      <ChevronDown size={15} className={expandedRequestId === row.id ? 'adm-request-card__chev--open' : ''} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const ADMISSION_FORM_PANEL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

  .adm-form-panel {
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 28px;
    max-width: 100%;
    margin: 0 auto;
  }

  .adm-form-hero__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .adm-form-hero__main {
    flex: 1;
    min-width: 0;
  }

  .adm-form-kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #F54E25;
    background: rgba(245, 78, 37, 0.1);
    padding: 6px 12px;
    border-radius: 999px;
    margin-bottom: 10px;
  }

  .adm-form-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    padding: 8px 14px;
    border-radius: 999px;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .adm-form-pill--review {
    color: #b45309;
    background: #fffbeb;
    border: 1px solid #fde68a;
  }

  .adm-form-hero__title {
    margin: 0 0 8px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.55rem;
    font-weight: 800;
    color: #1B2559;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .adm-form-hero__sub {
    margin: 0;
    font-size: 0.92rem;
    color: #64748b;
    line-height: 1.6;
    max-width: 640px;
  }

  .adm-dashboard {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 24px;
    align-items: center;
    padding: 24px 26px;
    background: #fff;
    border: none;
    border-radius: 20px;
    box-shadow: 0 10px 36px rgba(27, 37, 89, 0.07);
  }

  .adm-dashboard__ring-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .adm-dashboard__ring-caption {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .adm-ring {
    position: relative;
    width: 96px;
    height: 96px;
  }

  .adm-ring__track {
    fill: none;
    stroke: #f1f5f9;
  }

  .adm-ring__fill {
    fill: none;
    stroke: #F54E25;
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    transition: stroke-dashoffset 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .adm-ring__label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.15rem;
    font-weight: 800;
    color: #1B2559;
  }

  .adm-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .adm-stat-card {
    background: #f8fafc;
    border: none;
    border-radius: 14px;
    padding: 12px 14px;
    transition: box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;
  }

  .adm-stat-card:hover {
    background: #fff;
    box-shadow: 0 6px 18px rgba(27, 37, 89, 0.06);
    transform: translateY(-1px);
  }

  .adm-stat-card__label {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .adm-stat-card__value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.1rem;
    font-weight: 800;
    color: #1B2559;
    line-height: 1.2;
  }

  .adm-stat-card__value--ready { color: #16a34a; }
  .adm-stat-card__value--progress { color: #F54E25; }
  .adm-stat-card__value--pending { color: #94a3b8; }
  .adm-stat-card__value--muted { color: #64748b; }

  .adm-meta-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
    padding: 0 4px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
  }

  .adm-meta-strip__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .adm-meta-strip__item--muted {
    color: #94a3b8;
    font-weight: 500;
  }

  .adm-checklist-card {
    background: #fff;
    border: none;
    border-radius: 20px;
    padding: 22px 24px;
    box-shadow: 0 8px 28px rgba(27, 37, 89, 0.06);
  }

  .adm-checklist-card__title {
    margin: 0 0 14px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1rem;
    font-weight: 800;
    color: #1B2559;
  }

  .adm-checklist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .adm-checklist__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid transparent;
    background: #f8fafc;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .adm-checklist__item:hover {
    background: #f1f5f9;
  }

  .adm-checklist__item--done {
    background: #f0fdf4;
    border-color: #dcfce7;
  }

  .adm-checklist__item--done:hover {
    box-shadow: 0 4px 14px rgba(22, 163, 74, 0.08);
  }

  .adm-checklist__item--done .adm-checklist__icon { color: #16a34a; }
  .adm-checklist__item--done .adm-checklist__status {
    color: #16a34a;
    background: #dcfce7;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
  }

  .adm-checklist__item--next {
    background: #fff7f4;
    border-color: rgba(245, 78, 37, 0.35);
    box-shadow: 0 0 0 3px rgba(245, 78, 37, 0.08), 0 4px 16px rgba(245, 78, 37, 0.1);
  }

  .adm-checklist__item--next .adm-checklist__icon { color: #F54E25; }
  .adm-checklist__item--next .adm-checklist__status {
    color: #F54E25;
    background: rgba(245, 78, 37, 0.12);
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .adm-checklist__item--pop {
    animation: adm-check-pop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  @keyframes adm-check-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.02); box-shadow: 0 6px 20px rgba(22, 163, 74, 0.15); }
    100% { transform: scale(1); }
  }

  .adm-checklist__icon { color: #cbd5e1; flex-shrink: 0; }
  .adm-checklist__label { flex: 1; font-size: 0.9rem; font-weight: 600; color: #334155; }
  .adm-checklist__status { font-size: 0.76rem; font-weight: 700; color: #94a3b8; }

  .adm-info-banner {
    display: flex;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 18px;
    background: linear-gradient(135deg, #fff9f7, #ffffff);
    border: 1px solid rgba(245, 78, 37, 0.14);
  }

  .adm-info-banner__icon { color: #F54E25; flex-shrink: 0; margin-top: 2px; }
  .adm-info-banner strong { display: block; color: #1B2559; font-size: 0.9rem; margin-bottom: 6px; }
  .adm-info-banner p { margin: 0; font-size: 0.84rem; color: #475569; line-height: 1.65; }

  .adm-section-card {
    background: #fff;
    border: none;
    border-radius: 20px;
    padding: 26px 28px;
    box-shadow: 0 10px 32px rgba(27, 37, 89, 0.06);
    transition: box-shadow 0.22s ease;
  }

  .adm-section-card:hover {
    box-shadow: 0 14px 40px rgba(27, 37, 89, 0.08);
  }

  .adm-section-card--optional {
    background: #fafbfc;
  }

  .adm-section-card__head {
    display: flex;
    gap: 14px;
    margin-bottom: 22px;
    align-items: flex-start;
  }

  .adm-section-card__num {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: #1B2559;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .adm-section-card__head-text {
    flex: 1;
    min-width: 0;
  }

  .adm-section-card__icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(245, 78, 37, 0.1);
    color: #F54E25;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .adm-section-card--optional .adm-section-card__icon {
    background: rgba(27, 37, 89, 0.08);
    color: #1B2559;
  }

  .adm-section-card__title {
    margin: 0 0 4px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.08rem;
    font-weight: 800;
    color: #1B2559;
  }

  .adm-section-card__desc {
    margin: 0;
    font-size: 0.86rem;
    color: #64748b;
    line-height: 1.5;
  }

  .adm-section-card__helper {
    margin: 6px 0 0;
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.45;
  }

  .adm-fields-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .adm-required-mark {
    color: #F54E25;
  }

  .adm-field label {
    display: block;
    font-size: 0.82rem;
    font-weight: 700;
    color: #475569;
    margin-bottom: 8px;
  }

  .adm-field-ok {
    margin: 6px 0 0;
    font-size: 0.76rem;
    font-weight: 600;
    color: #16a34a;
  }

  .adm-field--valid .adm-input-wrap input,
  .adm-field--valid .adm-input-wrap select,
  .adm-field--valid .adm-input-wrap textarea {
    border-color: #86efac;
    background: #f0fdf4;
  }

  .adm-field--error .adm-input-wrap input,
  .adm-field--error .adm-input-wrap select,
  .adm-field--error .adm-input-wrap textarea {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .adm-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .adm-input-wrap--textarea {
    align-items: stretch;
  }

  .adm-input-icon {
    position: absolute;
    left: 16px;
    color: #94a3b8;
    pointer-events: none;
  }

  .adm-input-wrap input,
  .adm-input-wrap select,
  .adm-input-wrap textarea {
    width: 100%;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    font-size: 15px;
    color: #1B2559;
    background: #f8fafc;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }

  .adm-input-wrap input,
  .adm-input-wrap select {
    height: 52px;
    padding: 0 16px 0 46px;
  }

  .adm-input-wrap textarea {
    min-height: 120px;
    padding: 14px 16px;
    line-height: 1.5;
    resize: vertical;
  }

  .adm-input-wrap input:focus,
  .adm-input-wrap select:focus,
  .adm-input-wrap textarea:focus {
    outline: none;
    border-color: #F54E25;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.12);
  }

  .adm-field-error {
    margin: 8px 0 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: #dc2626;
  }

  .adm-field-error--center { text-align: center; }

  .adm-upload-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .adm-upload {
    border: 2px dashed #cbd5e1;
    border-radius: 18px;
    padding: 28px 20px;
    text-align: center;
    background: #f8fafc;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .adm-upload:hover {
    border-color: #F54E25;
    background: #fff9f7;
  }

  .adm-upload--drag {
    border-color: #F54E25;
    background: #fff7f4;
    box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.12);
    transform: scale(1.01);
  }

  .adm-upload--done {
    border-style: solid;
    border-color: #bbf7d0;
    background: #f0fdf4;
    cursor: default;
    min-height: auto;
    padding: 18px;
  }

  .adm-upload--error { border-color: #fca5a5; background: #fef2f2; }
  .adm-upload--navy.adm-upload:hover { border-color: #1B2559; background: #f8fafc; }

  .adm-upload__icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: rgba(245, 78, 37, 0.1);
    color: #F54E25;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .adm-upload--navy .adm-upload__icon {
    background: rgba(27, 37, 89, 0.08);
    color: #1B2559;
  }

  .adm-upload__title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    color: #1B2559;
    font-size: 0.95rem;
    margin-bottom: 6px;
  }

  .adm-upload__hint {
    margin: 0 0 8px;
    font-size: 0.84rem;
    color: #64748b;
    line-height: 1.5;
  }

  .adm-upload__meta {
    margin: 0 0 14px;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .adm-upload__browse {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: linear-gradient(135deg, #F54E25, #e0441f);
    color: #fff;
    font-weight: 700;
    font-size: 0.86rem;
    padding: 10px 18px;
    border-radius: 12px;
    cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
  }

  .adm-upload--navy .adm-upload__browse {
    background: linear-gradient(135deg, #1B2559, #2d3a6e);
  }

  .adm-upload__browse:hover { filter: brightness(1.05); }
  .adm-upload__browse:active { transform: scale(0.98); }

  .adm-upload__success {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
  }

  .adm-upload__success-icon { color: #16a34a; flex-shrink: 0; }
  .adm-upload__success-text { flex: 1; min-width: 0; }
  .adm-upload__success-text strong { display: block; color: #1B2559; font-size: 0.9rem; margin-bottom: 4px; }
  .adm-upload__success-text span { font-size: 0.8rem; color: #475569; word-break: break-all; }

  .adm-upload__replace {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 8px 12px;
    border-radius: 10px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .adm-upload__clear {
    border: none;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    flex-shrink: 0;
  }

  .adm-consent__shield {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 14px;
    margin-bottom: 16px;
    color: #1B2559;
    font-size: 0.88rem;
    font-weight: 600;
  }

  .adm-consent__shield svg { color: #F54E25; }

  .adm-consent__check {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #475569;
    line-height: 1.55;
  }

  .adm-consent__check input {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    accent-color: #F54E25;
    flex-shrink: 0;
  }

  .adm-link {
    border: none;
    background: none;
    padding: 0;
    color: #F54E25;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .adm-submitted__title {
    margin: 8px 0 16px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.1rem;
    font-weight: 800;
    color: #1B2559;
  }

  .adm-submitted__list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .adm-request-card {
    display: flex;
    gap: 18px;
    padding: 22px 24px;
    background: #fff;
    border: 1px solid #eef2f7;
    border-radius: 20px;
    box-shadow: 0 8px 26px rgba(27, 37, 89, 0.06);
    transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
  }

  .adm-request-card:hover {
    box-shadow: 0 12px 36px rgba(27, 37, 89, 0.09);
    transform: translateY(-2px);
    border-color: #e2e8f0;
  }

  .adm-request-card--expanded {
    border-color: rgba(245, 78, 37, 0.22);
    box-shadow: 0 14px 40px rgba(27, 37, 89, 0.1);
  }

  .adm-request-card__avatar {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: linear-gradient(135deg, #F54E25, #ff7a50);
    color: #fff;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 6px 18px rgba(245, 78, 37, 0.22);
  }

  .adm-request-card__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0; }

  .adm-request-card__head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 4px;
  }

  .adm-request-card__info { min-width: 0; flex: 1; }

  .adm-request-card__name {
    margin: 0 0 5px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.08rem;
    font-weight: 800;
    color: #1B2559;
    line-height: 1.3;
  }

  .adm-request-card__meta {
    margin: 0;
    font-size: 0.86rem;
    color: #64748b;
    line-height: 1.45;
  }

  .adm-request-card__date {
    margin: 8px 0 0;
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .adm-status-badge {
    display: inline-flex;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .am-pill--ok { background: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; }
  .am-pill--pending { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
  .am-pill--warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  .am-pill--bad { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .am-pill--muted { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

  .adm-request-card__note {
    margin: 0 0 8px;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .adm-request-card__note--meeting { color: #92400e; }
  .adm-request-card__note--warn { color: #b45309; }

  .adm-request-card__files {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 0.78rem;
    color: #475569;
  }

  .adm-request-card__btn {
    margin-top: 10px;
    border: none;
    background: linear-gradient(135deg, #F54E25, #e0441f);
    color: #fff;
    font-weight: 700;
    font-size: 0.82rem;
    padding: 10px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
  }

  .adm-request-card__btn:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  .adm-request-card__details {
    margin: 12px 0 4px;
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 14px;
    border: 1px solid #eef2f7;
    animation: adm-details-in 0.22s ease;
  }

  .adm-request-card__detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;
    margin: 0 0 16px;
    padding: 0;
  }

  .adm-request-card__detail-item dt {
    font-size: 0.68rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .adm-request-card__detail-item dd {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1B2559;
    word-break: break-word;
  }

  .adm-request-card__docs {
    margin-bottom: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
  }

  .adm-request-card__docs-title {
    margin: 0 0 10px;
    font-size: 0.68rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .adm-request-card__docs-empty {
    margin: 0;
    font-size: 0.86rem;
    color: #64748b;
    font-weight: 500;
  }

  .adm-request-card__docs--missing {
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px dashed #e2e8f0;
  }

  .adm-supplemental-files {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }

  .adm-supplemental-files__item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e8edf5;
    border-radius: 12px;
  }

  .adm-supplemental-files__info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .adm-supplemental-files__name {
    word-break: break-word;
    font-size: 0.88rem;
    font-weight: 600;
    color: #1B2559;
  }

  .adm-supplemental-files__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .adm-supplemental-files__btn--muted {
    color: #475569;
  }

  .adm-supplemental-files__btn--danger {
    color: #dc2626;
    border-color: #fecaca;
  }

  .adm-supplemental-files__btn--danger:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #b91c1c;
  }

  .adm-supplemental-files__error {
    margin: 10px 0 0;
    font-size: 12px;
    color: #dc2626;
    font-weight: 600;
  }

  @keyframes adm-details-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .adm-request-card__view {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    margin-top: 14px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    color: #1B2559;
    font-size: 0.84rem;
    font-weight: 700;
    padding: 9px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
  }

  .adm-request-card__view:hover {
    border-color: #F54E25;
    color: #F54E25;
    background: #fff9f7;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 78, 37, 0.1);
  }

  .adm-request-card__chev--open {
    transform: rotate(180deg);
  }

  .adm-request-card__view svg:last-child {
    transition: transform 0.22s ease;
  }

  @media (max-width: 768px) {
    .adm-form-hero__row { flex-direction: column; }
    .adm-form-pill { align-self: flex-start; margin-top: 0; }
    .adm-dashboard { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .adm-stat-grid { grid-template-columns: 1fr; width: 100%; }
    .adm-fields-grid, .adm-upload-grid { grid-template-columns: 1fr; }
    .adm-request-card { flex-direction: column; }
    .adm-meta-strip { flex-direction: column; gap: 8px; }
  }
`;
