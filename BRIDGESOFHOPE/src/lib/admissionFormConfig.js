/** Shared copy and options for family admission requests (Kalinga private facility). */

export const ADMISSION_FORM_TITLE = 'Admission Request Form';

export const ADMISSION_FORM_SUBTITLE =
  'Resident details and required documents — your profile is used for family contact.';

export const ADMISSION_REQUIREMENTS_NOTE =
  'No additional requirements are needed before admission. Families may optionally provide a hospital referral. As a private facility, Bridges of Hope does not require court orders (those apply to public rehabilitation centers through barangay or police paperwork).';

export const ADMISSION_DEFAULT_REASON = 'Admission request';

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
];

export const DOCUMENT_TYPE_LABELS = {
  valid_id: 'Valid ID',
  birth_cert: 'Birth Certificate',
  hospital_referral: 'Hospital Referral',
};
