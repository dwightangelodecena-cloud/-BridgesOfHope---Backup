/** Shared copy and options for family admission requests (Kalinga private facility). */

export const ADMISSION_FORM_TITLE = 'Admission Request Form';

export const ADMISSION_FORM_SUBTITLE =
  'Resident details and required documents — your profile is used for family contact.';

export const ADMISSION_REQUIREMENTS_NOTE =
  'No additional requirements are needed before admission. Families may optionally provide a hospital referral. As a private facility, Bridges of Hope does not require court orders (those apply to public rehabilitation centers through barangay or police paperwork).';

export const ADMISSION_DEFAULT_REASON = 'Admission request';

export const REASON_FOR_ADMISSION_OPTIONS = [
  { value: '', label: 'Select reason for admission' },
  { value: 'Drugs', label: 'Drugs' },
  { value: 'Alcohol', label: 'Alcohol' },
  { value: 'Mental Health', label: 'Mental Health' },
  { value: 'Gambling', label: 'Gambling' },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Select relationship' },
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse / Partner' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'relative', label: 'Other Relative' },
  { value: 'legal_guardian', label: 'Legal Guardian' },
  { value: 'other', label: 'Other' },
] as const;

export const PATIENT_GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  valid_id: 'Valid ID',
  birth_cert: 'Birth Certificate',
  hospital_referral: 'Hospital Referral',
};

/** @returns Empty string when valid, otherwise an error message. */
export function validateReasonForAdmission(text: string): string {
  const value = String(text || '').trim();
  if (!value) return 'Please select a reason for admission.';
  const allowed = REASON_FOR_ADMISSION_OPTIONS.some((o) => o.value && o.value === value);
  if (!allowed) return 'Please select a valid reason for admission.';
  return '';
}

export function reasonForAdmissionLabel(value: string): string {
  const match = REASON_FOR_ADMISSION_OPTIONS.find((o) => o.value === value);
  return match?.label || String(value || '').trim() || '';
}

/** @returns Empty string when valid, otherwise an error message. */
export function validatePatientGender(value: string): string {
  const selected = String(value || '').trim();
  if (!selected) return 'Please select the resident\'s gender.';
  const allowed = PATIENT_GENDER_OPTIONS.some((o) => o.value && o.value === selected);
  if (!allowed) return 'Please select a valid gender.';
  return '';
}

export function patientGenderLabel(value: string): string {
  const match = PATIENT_GENDER_OPTIONS.find((o) => o.value === value);
  return match?.label || String(value || '').trim() || '';
}

/** @returns Empty string when valid, otherwise an error message. */
export function validatePatientBirthDate(iso: string): string {
  const day = String(iso || '').trim().slice(0, 10);
  if (!day) return 'Resident date of birth is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Enter a valid date of birth.';
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (day > todayIso) return 'Date of birth cannot be in the future.';
  return '';
}
