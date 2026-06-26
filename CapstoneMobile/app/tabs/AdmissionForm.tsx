import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appendActivityFeed } from '../../lib/activityFeed';
import {
  uploadAdmissionDocumentsMobile,
  type PickedAdmissionFile,
} from '../../lib/admissionDocumentUploadMobile';
import {
  insertAdmissionRequest,
} from '../../lib/admissionRequestInsert';
import * as DocumentPicker from 'expo-document-picker';
import { appendFamilyNotificationsIfNewMobile, notificationTextMobile } from '../../lib/familyNotificationsMobile';
import { useFamilyNotificationsState } from '../../lib/useFamilyNotificationsMobile';
import {
  ADMISSION_DEFAULT_REASON,
  ADMISSION_FORM_SUBTITLE,
  ADMISSION_FORM_TITLE,
  ADMISSION_REQUIREMENTS_NOTE,
  RELATIONSHIP_OPTIONS,
} from '../../lib/admissionFormConfig';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

const DRAFT_KEY = 'bh_admission_draft';

type FormData = {
  patientLastName: string;
  patientFirstName: string;
  relationshipToResident: string;
  agreeToTerms: boolean;
};

const emptyForm: FormData = {
  patientLastName: '',
  patientFirstName: '',
  relationshipToResident: '',
  agreeToTerms: false,
};

export default function AdmissionForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveBanner, setSaveBanner] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validIdFile, setValidIdFile] = useState<PickedAdmissionFile | null>(null);
  const [birthCertFile, setBirthCertFile] = useState<PickedAdmissionFile | null>(null);
  const [hospitalReferralFile, setHospitalReferralFile] = useState<PickedAdmissionFile | null>(null);
  const [guardianProfile, setGuardianProfile] = useState({ fullName: '', email: '', phone: '' });
  const [showNotifications, setShowNotifications] = useState(false);
  const [familyUserId, setFamilyUserId] = useState('');
  const { notificationItems, setNotificationItems } = useFamilyNotificationsState(familyUserId);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');

  const requiredFields = useMemo(
    () =>
      [
        { key: 'patientLastName' as const, label: 'Resident Last Name' },
        { key: 'patientFirstName' as const, label: 'Resident First Name' },
        { key: 'relationshipToResident' as const, label: 'Relationship to Resident' },
        { key: 'validIdFile' as const, label: 'Valid ID', isFile: true as const },
        { key: 'birthCertFile' as const, label: 'Birth Certificate', isFile: true as const },
      ] as const,
    []
  );

  const isFieldDone = (field: (typeof requiredFields)[number]) => {
    if ('isFile' in field && field.isFile) {
      if (field.key === 'validIdFile') return Boolean(validIdFile);
      if (field.key === 'birthCertFile') return Boolean(birthCertFile);
      return false;
    }
    return Boolean(String(formData[field.key as keyof FormData] || '').trim());
  };

  const completedFields = requiredFields.filter(isFieldDone).length;
  const progressPercent = Math.round((completedFields / requiredFields.length) * 100);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as Partial<FormData> & {
            middleInitial?: string;
            patientName?: string;
          };
          const { middleInitial: _omitMi, patientName: legacyName, ...draft } = parsed;
          const merged: Partial<FormData> = { ...draft };
          if (
            legacyName &&
            typeof legacyName === 'string' &&
            legacyName.trim() &&
            !merged.patientFirstName?.trim() &&
            !merged.patientLastName?.trim()
          ) {
            merged.patientFirstName = legacyName.trim();
          }
          setFormData((prev) => ({ ...prev, ...merged, agreeToTerms: Boolean(parsed.agreeToTerms) }));
        }
      } catch {
        await AsyncStorage.removeItem(DRAFT_KEY);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      if (!isSupabaseConfigured()) {
        setFamilyUserId('');
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user?.id) {
          if (mounted) setFamilyUserId('');
        } else if (mounted) {
          setFamilyUserId(user.id);
        }
        let fullName =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'Family User';
        let phone = (user?.user_metadata?.contact_number as string) || '';
        if (user?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', user.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) fullName = profileRow.full_name.trim();
          if (profileRow?.phone?.trim()) phone = profileRow.phone.trim();
        }
        if (mounted) {
          setDisplayName(fullName);
          setUserInitials(deriveInitials(fullName));
          setGuardianProfile({
            fullName,
            email: user?.email || '',
            phone,
          });
        }
      } catch {
        if (mounted) setFamilyUserId('');
        /* keep default */
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const setField = useCallback((name: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name as string]) return prev;
      const next = { ...prev };
      delete next[name as string];
      return next;
    });
  }, []);

  const validateForm = useCallback(() => {
    const next: Record<string, string> = {};
    if (!formData.patientLastName.trim()) next.patientLastName = 'Resident last name is required.';
    if (!formData.patientFirstName.trim()) next.patientFirstName = 'Resident first name is required.';
    if (!formData.relationshipToResident) next.relationshipToResident = 'Please select your relationship to the resident.';
    if (!validIdFile) next.validIdFile = 'Please upload a valid ID.';
    if (!birthCertFile) next.birthCertFile = 'Please upload a birth certificate.';
    if (!formData.agreeToTerms) next.agreeToTerms = 'You must agree to the terms.';
    if (!guardianProfile.fullName.trim()) next.submit = 'Complete your profile before submitting.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData, validIdFile, birthCertFile, guardianProfile.fullName]);

  const saveDraft = async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      setSaveBanner('Draft saved locally.');
      setTimeout(() => setSaveBanner(''), 1800);
    } catch {
      setSaveBanner('Could not save draft.');
      setTimeout(() => setSaveBanner(''), 1800);
    }
  };

  const clearForm = async () => {
    setFormData(emptyForm);
    setValidIdFile(null);
    setBirthCertFile(null);
    setHospitalReferralFile(null);
    setErrors({});
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setSaveBanner('Form has been reset.');
    setTimeout(() => setSaveBanner(''), 1800);
  };

  const handleSubmit = async () => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n.submit;
      return n;
    });
    if (!validateForm()) return;

    if (!isSupabaseConfigured()) {
      setErrors({ submit: 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.' });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setErrors({ submit: 'Please sign in to submit an admission request.' });
        return;
      }

      const patientFull = [formData.patientFirstName, formData.patientLastName]
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .join(' ');

      const relationshipLabel =
        RELATIONSHIP_OPTIONS.find((o) => o.value === formData.relationshipToResident)?.label
        || formData.relationshipToResident;

      const filesToUpload = [validIdFile, birthCertFile, hospitalReferralFile].filter(
        Boolean
      ) as PickedAdmissionFile[];

      const uploadResult = await uploadAdmissionDocumentsMobile(filesToUpload, user.id, 'draft');
      if (!uploadResult.ok) {
        setErrors({ submit: uploadResult.errorMessage });
        return;
      }

      const formSnapshot = {
        patientLastName: formData.patientLastName.trim(),
        patientFirstName: formData.patientFirstName.trim(),
        relationshipToResident: formData.relationshipToResident,
        relationshipLabel,
        hasHospitalReferral: Boolean(hospitalReferralFile),
      };
      const extendedRow = {
        family_id: user.id,
        guardian_full_name: guardianProfile.fullName.trim(),
        guardian_email: guardianProfile.email.trim(),
        guardian_phone: guardianProfile.phone.trim(),
        patient_name: patientFull,
        patient_last_name: formData.patientLastName.trim(),
        patient_first_name: formData.patientFirstName.trim(),
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
        patient_name: patientFull,
        patient_last_name: formData.patientLastName.trim(),
        patient_first_name: formData.patientFirstName.trim(),
        reason_for_admission: ADMISSION_DEFAULT_REASON,
        status: 'processing',
      };
      const minimalRow = {
        family_id: user.id,
        guardian_full_name: guardianProfile.fullName.trim(),
        guardian_email: guardianProfile.email.trim(),
        guardian_phone: guardianProfile.phone.trim(),
        patient_name: patientFull,
        reason_for_admission: ADMISSION_DEFAULT_REASON,
        status: 'processing',
      };

      const insertResult = await insertAdmissionRequest([extendedRow, coreRow, minimalRow]);
      if (!insertResult.ok) {
        setErrors({ submit: insertResult.errorMessage });
        return;
      }

      if (uploadResult.files.length) {
        await supabase
          .from('admission_requests')
          .update({ attached_files: uploadResult.files, form_data: formSnapshot })
          .eq('id', insertResult.id);
      }

      await appendActivityFeed(`Admission request submitted for ${patientFull}. Pending admin review.`, {
        familyId: user.id,
      });
      if (familyUserId) {
        await appendFamilyNotificationsIfNewMobile(
          [{ id: `adm-processing-${insertResult.id}`, text: `Admission request for ${patientFull} is being processed.` }],
          familyUserId
        );
      }
      setValidIdFile(null);
      setBirthCertFile(null);
      setHospitalReferralFile(null);
      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setShowSuccessModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const pickSingleDocument = async (
    documentType: 'valid_id' | 'birth_cert' | 'hospital_referral',
    setter: (file: PickedAdmissionFile | null) => void,
    errorKey?: string
  ) => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    setter({
      uri: asset.uri,
      name: asset.name || 'document',
      mimeType: asset.mimeType,
      size: asset.size,
      documentType,
    });
    if (errorKey) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const relationshipDisplay =
    RELATIONSHIP_OPTIONS.find((o) => o.value === formData.relationshipToResident)?.label
    || 'Select Relationship';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifModalRoot}>
          <Pressable style={styles.notifModalBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={[styles.notificationsDropdown, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notificationsDropdownTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notificationsDropdownTitle}>Notifications</Text>
            </View>
            {notificationItems.length === 0 ? (
              <Text style={[styles.notificationsDropdownText, { color: '#94A3B8', fontWeight: '700' }]}>No notifications.</Text>
            ) : notificationItems.map((item, idx) => (
              <View key={`${item.id}-${idx}`} style={styles.notificationsDropdownRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notificationsDropdownText}>{notificationTextMobile(item)}</Text>
                <TouchableOpacity
                  onPress={() => setNotificationItems((prev) => prev.filter((r) => r.id !== item.id))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove notification"
                >
                  <Text style={styles.notificationDismiss}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate(TAB_ROUTES.home)} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrandTitle}>Admission</Text>
          <Text style={styles.headerWelcomeLine} numberOfLines={1}>
            Welcome Back, {(displayName || 'Family User').trim().split(/\s+/)[0]}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setShowNotifications((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => router.navigate(TAB_ROUTES.profile)}
            accessibilityLabel="Profile"
          >
            <Text style={styles.headerAvatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
          {saveBanner ? (
            <View style={styles.saveBanner}>
              <Text style={styles.saveBannerText}>{saveBanner}</Text>
            </View>
          ) : null}

          <View style={styles.admissionIntro}>
            <Text style={styles.admissionIntroKicker}>Admission workflow</Text>
            <Text style={styles.admissionIntroTitle}>{ADMISSION_FORM_TITLE}</Text>
            <Text style={styles.admissionIntroSub}>{ADMISSION_FORM_SUBTITLE}</Text>
          </View>

          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsTitle}>Requirements before admitting a resident</Text>
            <Text style={styles.requirementsBody}>{ADMISSION_REQUIREMENTS_NOTE}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Form Completion</Text>
              <Text style={styles.percentText}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.cardSub}>
              {completedFields} of {requiredFields.length} required fields completed
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.checklistHeading}>Admission Checklist</Text>
            {requiredFields.map((field) => {
              const done = isFieldDone(field);
              return (
                <View key={field.key} style={styles.checklistRow}>
                  <Text style={styles.checklistLabel}>{field.label}</Text>
                  <Text style={[styles.checklistStatus, done ? styles.checklistDone : styles.checklistPending]}>
                    {done ? 'Done' : 'Pending'}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.formBlock}>
            <LabeledInput
              label="Resident Last Name"
              placeholder="Resident's last name"
              icon="person-outline"
              value={formData.patientLastName}
              onChangeText={(t) => setField('patientLastName', t)}
              error={errors.patientLastName}
            />
            <LabeledInput
              label="Resident First Name"
              placeholder="Resident's first name"
              icon="person-outline"
              value={formData.patientFirstName}
              onChangeText={(t) => setField('patientFirstName', t)}
              error={errors.patientFirstName}
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Relationship to Resident</Text>
              <TouchableOpacity
                style={[styles.inputShell, errors.relationshipToResident ? styles.inputShellError : null]}
                onPress={() => setShowRelationshipModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="people-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text style={[styles.dateInputText, !formData.relationshipToResident && styles.placeholderText]}>
                  {relationshipDisplay}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {errors.relationshipToResident ? <Text style={styles.errorSmall}>{errors.relationshipToResident}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Valid ID</Text>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => void pickSingleDocument('valid_id', setValidIdFile, 'validIdFile')}>
                <Text style={styles.btnSecondaryText}>{validIdFile ? 'Replace Valid ID' : 'Upload Valid ID'}</Text>
              </TouchableOpacity>
              {validIdFile ? <Text style={styles.fileNameText} numberOfLines={1}>{validIdFile.name}</Text> : null}
              {errors.validIdFile ? <Text style={styles.errorSmall}>{errors.validIdFile}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Birth Certificate</Text>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => void pickSingleDocument('birth_cert', setBirthCertFile, 'birthCertFile')}>
                <Text style={styles.btnSecondaryText}>{birthCertFile ? 'Replace Birth Certificate' : 'Upload Birth Certificate'}</Text>
              </TouchableOpacity>
              {birthCertFile ? <Text style={styles.fileNameText} numberOfLines={1}>{birthCertFile.name}</Text> : null}
              {errors.birthCertFile ? <Text style={styles.errorSmall}>{errors.birthCertFile}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Hospital Referral (Optional)</Text>
              <Text style={styles.streetHint}>Families may optionally provide a referral from a hospital.</Text>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => void pickSingleDocument('hospital_referral', setHospitalReferralFile)}>
                <Text style={styles.btnSecondaryText}>{hospitalReferralFile ? 'Replace Referral' : 'Upload Referral'}</Text>
              </TouchableOpacity>
              {hospitalReferralFile ? <Text style={styles.fileNameText} numberOfLines={1}>{hospitalReferralFile.name}</Text> : null}
            </View>

            <View style={styles.termsRow}>
              <TouchableOpacity
                onPress={() => setField('agreeToTerms', !formData.agreeToTerms)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: formData.agreeToTerms }}
              >
                <View style={[styles.checkbox, formData.agreeToTerms && styles.checkboxOn]}>
                  {formData.agreeToTerms ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
                </View>
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>
                  Privacy Policy
                </Text>{' '}
                and{' '}
                <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>
                  Terms
                </Text>
              </Text>
            </View>
            {errors.agreeToTerms ? <Text style={[styles.errorSmall, styles.errorCenter]}>{errors.agreeToTerms}</Text> : null}
            {errors.submit ? <Text style={[styles.errorSmall, styles.errorCenter]}>{errors.submit}</Text> : null}

            <TouchableOpacity
              style={[styles.btnPrimary, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.btnPrimaryText}>{submitting ? 'Submitting…' : 'Submit Admission'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={saveDraft}>
              <Text style={styles.btnSecondaryText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={clearForm}>
              <Text style={styles.btnSecondaryText}>Reset Form</Text>
            </TouchableOpacity>
          </View>
      </ScrollView>

      <Modal visible={showRelationshipModal} transparent animationType="fade" onRequestClose={() => setShowRelationshipModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowRelationshipModal(false)}>
          <View style={styles.reasonSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.reasonSheetTitle}>Relationship to Resident</Text>
            {RELATIONSHIP_OPTIONS.filter((opt) => opt.value).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.reasonOption}
                onPress={() => {
                  setField('relationshipToResident', opt.value);
                  setShowRelationshipModal(false);
                }}
              >
                <Text style={styles.reasonOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showTermsModal} transparent animationType="slide" onRequestClose={() => setShowTermsModal(false)}>
        <View style={styles.termsOverlay}>
          <View style={styles.termsCard}>
            <TouchableOpacity style={styles.termsClose} onPress={() => setShowTermsModal(false)} hitSlop={12}>
              <Ionicons name="close" size={26} color="#0F172A" />
            </TouchableOpacity>
            <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsScrollContent}>
              <Text style={styles.termsH1}>TERMS AND CONDITIONS</Text>
              <Text style={styles.termsSub}>Clinic Admission and Resident Management System</Text>
              <TermsSection
                title="1. Acceptance of Terms"
                body="By accessing, registering, or using this application and web system (“the System”), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the System immediately."
              />
              <TermsSection
                title="2. Purpose of the System"
                body="The System is designed to facilitate admission processing, patient record management, scheduling, monitoring, and communication between the clinic, patients, and authorized guardians."
              />
              <TermsSection
                title="3. User Eligibility and Accounts"
                body="Users must provide accurate and complete information during registration and admission application. Guardians submitting applications on behalf of patients confirm they are legally authorized to provide the patient’s information."
              />
              <TermsSection
                title="4. Data Collection and Privacy"
                body="The System collects personal and health-related information necessary for admission processing, monitoring, and care coordination. By using the System, you consent to the storage and processing of submitted information within the secure clinic database."
              />
              <TermsSection
                title="5. Accuracy of Information"
                body="Users agree to provide truthful, current, and complete information. Submission of false, misleading, or incomplete data may result in delayed admission processing, suspension of account access, or rejection of applications."
              />
              <TermsSection
                title="6. Communication and Notification"
                body="The System may send notifications regarding admission status, schedules, updates, and relevant announcements. These notifications are informational and should not be interpreted as medical advice or emergency instructions."
              />
              <TermsSection
                title="7. System Availability"
                body="The clinic will make reasonable efforts to maintain continuous system availability. However, temporary interruptions may occur due to maintenance, updates, technical issues, or network conditions."
              />
              <TermsSection
                title="8. Acceptable Use"
                body="Users agree not to misuse the System. Prohibited actions include unauthorized access, attempting to alter records without permission, uploading harmful content, sharing accounts, or interfering with system operations."
              />
              <TermsSection
                title="9. Record Access and Confidentiality"
                body="Resident records are confidential and may only be accessed by authorized staff and the registered resident or guardian."
              />
              <TermsSection
                title="10. Limitation of Liability"
                body="The System is intended to support administrative processes. The clinic is not responsible for decisions made solely based on system information without consultation with qualified healthcare professionals."
              />
              <TermsSection
                title="11. Modifications to Terms"
                body="The clinic reserves the right to modify these Terms and Conditions at any time. Continued use of the System after updates indicates acceptance of the revised terms."
              />
              <TermsSection
                title="12. Termination of Access"
                body="The clinic may suspend or terminate access if users violate these Terms, misuse the System, or compromise security or patient confidentiality."
              />
              <TermsSection
                title="13. Contact Information"
                body="For questions, corrections to records, or concerns regarding these Terms, users may contact the clinic administration through the official communication channels provided within the System."
              />
            </ScrollView>
            <TouchableOpacity
              style={styles.termsAgreeBtn}
              onPress={() => {
                setField('agreeToTerms', true);
                setShowTermsModal(false);
              }}
            >
              <Text style={styles.termsAgreeBtnText}>I agree to the Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Application Submitted!</Text>
            <Text style={styles.successBody}>Admission request submitted successfully.</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setShowSuccessModal(false);
                router.navigate(TAB_ROUTES.home);
              }}
            >
              <Text style={styles.btnPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TermsSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.termsBlock}>
      <Text style={styles.termsH3}>{title}</Text>
      <Text style={styles.termsP}>{body}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  placeholder,
  icon,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, error ? styles.inputShellError : null]}>
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
      {error ? <Text style={styles.errorSmall}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  headerBack: {
    paddingVertical: 4,
    marginRight: 8,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F54E25',
  },
  headerWelcomeLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  notifModalRoot: {
    flex: 1,
  },
  notifModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  notificationsDropdown: {
    position: 'absolute',
    width: Math.min(340, width - 32),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  notificationsDropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notificationsDropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2559',
  },
  notificationsDropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  notificationsDropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  notificationDismiss: { fontSize: 18, lineHeight: 18, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 2 },
  scrollContent: {
    paddingHorizontal: isCompactScreen ? 14 : 20,
    paddingTop: 16,
  },
  saveBanner: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  saveBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F54E25',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F54E25',
    borderRadius: 999,
  },
  cardSub: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748B',
  },
  checklistHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  checklistLabel: {
    fontSize: 13,
    color: '#475569',
  },
  checklistStatus: {
    fontSize: 13,
    fontWeight: '700',
  },
  checklistPending: {
    color: '#94A3B8',
  },
  checklistDone: {
    color: '#16A34A',
  },
  admissionIntro: {
    marginBottom: 14,
  },
  admissionIntroKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  admissionIntroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  admissionIntroSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  requirementsCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFBF7',
    borderWidth: 1,
    borderColor: 'rgba(245, 78, 37, 0.15)',
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B2559',
    marginBottom: 6,
  },
  requirementsBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  fileNameText: {
    marginTop: 8,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  birthdayHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -6,
    marginBottom: 12,
  },
  formBlock: {
    marginTop: 4,
  },
  addressSection: {
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  addressKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  addressSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  addressRestored: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    marginBottom: 10,
  },
  fetchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  fetchBannerText: { flex: 1, fontSize: 12, color: '#991B1B' },
  fetchDismiss: { fontSize: 12, fontWeight: '700', color: '#F54E25' },
  streetHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 2,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: isCompactScreen ? 14 : 15,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minHeight: isCompactScreen ? 48 : 52,
    paddingHorizontal: isCompactScreen ? 12 : 14,
  },
  inputShellError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: isCompactScreen ? 15 : 16,
    color: '#1E293B',
    paddingVertical: 12,
  },
  dateInputText: {
    flex: 1,
    fontSize: isCompactScreen ? 15 : 16,
    color: '#1E293B',
    paddingVertical: 12,
    textAlign: 'left',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  errorSmall: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
    marginLeft: 4,
  },
  errorCenter: {
    textAlign: 'center',
    marginLeft: 0,
  },
  dateIosModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateIosBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dateIosSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    maxHeight: '92%',
    width: '100%',
  },
  dateIosPickerWrap: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dateIosPicker: {
    width: width,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  dateIosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dateIosHeaderSide: {
    flex: 1,
    justifyContent: 'center',
  },
  dateIosHeaderSideEnd: {
    alignItems: 'flex-end',
  },
  dateIosTitle: {
    flex: 2,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  dateIosHeaderBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    paddingHorizontal: 8,
  },
  dateIosHeaderBtnPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F54E25',
    paddingHorizontal: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#F54E25',
    borderColor: '#F54E25',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  termsLink: {
    color: '#F54E25',
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: '#F54E25',
    borderRadius: 14,
    paddingVertical: isCompactScreen ? 14 : 16,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#FFF4F1',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondaryText: {
    color: '#F54E25',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  reasonSheet: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  reasonSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  reasonOption: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  reasonOptionText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
  },
  termsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  termsCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  termsClose: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 2,
  },
  termsScroll: {
    maxHeight: '78%',
    marginTop: 48,
  },
  termsScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  termsH1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  termsSub: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    fontWeight: '500',
  },
  termsBlock: {
    marginBottom: 20,
  },
  termsH3: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  termsP: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
  },
  termsAgreeBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    backgroundColor: '#F54E25',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  termsAgreeBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
});
