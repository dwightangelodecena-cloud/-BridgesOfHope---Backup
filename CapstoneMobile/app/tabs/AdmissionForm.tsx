import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appendActivityFeed } from '../../lib/activityFeed';
import {
  uploadAdmissionDocumentsMobile,
  type PickedAdmissionFile,
} from '../../lib/admissionDocumentUploadMobile';
import {
  insertAdmissionRequest,
  patchAdmissionRequestGender,
} from '../../lib/admissionRequestInsert';
import * as DocumentPicker from 'expo-document-picker';
import { notificationTextMobile } from '../../lib/familyNotificationsMobile';
import { useFamilyNotificationsState } from '../../lib/useFamilyNotificationsMobile';
import {
  ADMISSION_FORM_SUBTITLE,
  ADMISSION_FORM_TITLE,
  ADMISSION_REQUIREMENTS_NOTE,
  PATIENT_GENDER_OPTIONS,
  REASON_FOR_ADMISSION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  validatePatientBirthDate,
  validatePatientGender,
  validateReasonForAdmission,
} from '../../lib/admissionFormConfig';
import { LoginField } from '../../components/auth/LoginField';
import { ScalePressable } from '../../components/auth/ScalePressable';

const C = {
  orange: '#F54E25',
  orangeLight: '#FF6A3D',
  orangeDark: '#E8441A',
  navy: '#1A2B4A',
  muted: '#64748B',
  white: '#FFFFFF',
};
function formatIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  patientBirthDate: string;
  patientGender: string;
  reasonForAdmission: string;
  relationshipToResident: string;
  agreeToTerms: boolean;
};

const emptyForm: FormData = {
  patientLastName: '',
  patientFirstName: '',
  patientBirthDate: '',
  patientGender: '',
  reasonForAdmission: '',
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
  const [submittedRequestId, setSubmittedRequestId] = useState('');
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [birthDateModal, setBirthDateModal] = useState(false);
  const [birthDateDraft, setBirthDateDraft] = useState(() => new Date(2000, 0, 1));
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
        { key: 'patientBirthDate' as const, label: 'Date of Birth' },
        { key: 'patientGender' as const, label: 'Gender' },
        { key: 'reasonForAdmission' as const, label: 'Reason for Admission' },
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
    if (field.key === 'reasonForAdmission') {
      return !validateReasonForAdmission(formData.reasonForAdmission);
    }
    if (field.key === 'patientGender') {
      return !validatePatientGender(formData.patientGender);
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
    const birthDateError = validatePatientBirthDate(formData.patientBirthDate);
    if (birthDateError) next.patientBirthDate = birthDateError;
    const genderError = validatePatientGender(formData.patientGender);
    if (genderError) next.patientGender = genderError;
    const reasonError = validateReasonForAdmission(formData.reasonForAdmission);
    if (reasonError) next.reasonForAdmission = reasonError;
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

      const formSnapshot = {
        patientLastName: formData.patientLastName.trim(),
        patientFirstName: formData.patientFirstName.trim(),
        patientBirthDate: formData.patientBirthDate.trim().slice(0, 10),
        patientGender: formData.patientGender.trim(),
        reasonForAdmission: formData.reasonForAdmission.trim(),
        relationshipToResident: formData.relationshipToResident,
        relationshipLabel,
        hasHospitalReferral: Boolean(hospitalReferralFile),
      };
      const patientBirthDate = formData.patientBirthDate.trim().slice(0, 10);
      const patientGender = formData.patientGender.trim();
      const reasonForAdmission = formData.reasonForAdmission.trim();
      const extendedRow = {
        family_id: user.id,
        guardian_full_name: guardianProfile.fullName.trim(),
        guardian_email: guardianProfile.email.trim(),
        guardian_phone: guardianProfile.phone.trim(),
        patient_name: patientFull,
        patient_last_name: formData.patientLastName.trim(),
        patient_first_name: formData.patientFirstName.trim(),
        patient_birth_date: patientBirthDate,
        patient_gender: patientGender,
        reason_for_admission: reasonForAdmission,
        status: 'processing',
        form_data: formSnapshot,
      };
      const coreRow = {
        family_id: user.id,
        guardian_full_name: guardianProfile.fullName.trim(),
        guardian_email: guardianProfile.email.trim(),
        guardian_phone: guardianProfile.phone.trim(),
        patient_name: patientFull,
        patient_last_name: formData.patientLastName.trim(),
        patient_first_name: formData.patientFirstName.trim(),
        patient_birth_date: patientBirthDate,
        patient_gender: patientGender,
        reason_for_admission: reasonForAdmission,
        status: 'processing',
      };
      const minimalRow = {
        family_id: user.id,
        guardian_full_name: guardianProfile.fullName.trim(),
        guardian_email: guardianProfile.email.trim(),
        guardian_phone: guardianProfile.phone.trim(),
        patient_name: patientFull,
        patient_birth_date: patientBirthDate,
        patient_gender: patientGender,
        reason_for_admission: reasonForAdmission,
        status: 'processing',
      };

      const insertResult = await insertAdmissionRequest([extendedRow, coreRow, minimalRow]);
      if (!insertResult.ok) {
        setErrors({ submit: insertResult.errorMessage });
        return;
      }
      await patchAdmissionRequestGender(insertResult.id, patientGender);

      const uploadResult = await uploadAdmissionDocumentsMobile(filesToUpload, user.id, insertResult.id);
      if (!uploadResult.ok) {
        setErrors({ submit: uploadResult.errorMessage });
        return;
      }

      const { error: patchErr } = await supabase
        .from('admission_requests')
        .update({
          attached_files: uploadResult.files,
          form_data: formSnapshot,
          patient_birth_date: patientBirthDate,
          patient_gender: patientGender,
          reason_for_admission: reasonForAdmission,
        })
        .eq('id', insertResult.id);
      if (patchErr) {
        setErrors({ submit: 'Request was submitted but documents could not be linked. Please contact support.' });
        return;
      }

      await appendActivityFeed(`Admission request submitted for ${patientFull}. Pending admin review.`, {
        familyId: user.id,
      });
      setValidIdFile(null);
      setBirthCertFile(null);
      setHospitalReferralFile(null);
      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setSubmittedRequestId(String(insertResult.id));
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

  const reasonDisplay =
    REASON_FOR_ADMISSION_OPTIONS.find((o) => o.value === formData.reasonForAdmission)?.label
    || 'Select reason for admission';

  const genderDisplay =
    PATIENT_GENDER_OPTIONS.find((o) => o.value === formData.patientGender)?.label
    || 'Select gender';

  const openBirthDatePicker = () => {
    setBirthDateDraft(
      formData.patientBirthDate
        ? new Date(`${formData.patientBirthDate}T12:00:00`)
        : new Date(2000, 0, 1)
    );
    setBirthDateModal(true);
  };

  const birthDateDisplay = formData.patientBirthDate || 'Select date of birth';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
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
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrandTitle}>Admission</Text>
          <Text style={styles.headerWelcomeLine} numberOfLines={1}>
            New resident intake
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setShowNotifications((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={18} color={C.white} />
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

      <View style={styles.heroBand}>
        <LinearGradient
          colors={['#0B1528', '#152238', '#2A1A28']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBandWash} />
        <View style={styles.heroBandInner}>
          <LinearGradient colors={[C.orangeLight, C.orange, C.orangeDark]} style={styles.heroIcon}>
            <Ionicons name="clipboard-outline" size={24} color="#fff" />
          </LinearGradient>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>ADMISSION WORKFLOW</Text>
            <Text style={styles.heroTitle}>{ADMISSION_FORM_TITLE}</Text>
            <Text style={styles.heroSub}>{ADMISSION_FORM_SUBTITLE}</Text>
          </View>
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
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.saveBannerText}>{saveBanner}</Text>
            </View>
          ) : null}

          <View style={styles.requirementsCard}>
            <View style={styles.requirementsHeader}>
              <Ionicons name="information-circle-outline" size={18} color={C.orange} />
              <Text style={styles.requirementsTitle}>Before you submit</Text>
            </View>
            <Text style={styles.requirementsBody}>{ADMISSION_REQUIREMENTS_NOTE}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Form completion</Text>
              <View style={styles.percentPill}>
                <Text style={styles.percentText}>{progressPercent}%</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[C.orangeLight, C.orange, C.orangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(progressPercent, 4)}%` }]}
              />
            </View>
            <Text style={styles.cardSub}>
              {completedFields} of {requiredFields.length} required fields completed
            </Text>
            <View style={styles.checklistWrap}>
              {requiredFields.map((field) => {
                const done = isFieldDone(field);
                return (
                  <View key={field.key} style={[styles.checkChip, done && styles.checkChipDone]}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={13}
                      color={done ? '#16A34A' : '#94A3B8'}
                    />
                    <Text style={[styles.checkChipText, done && styles.checkChipTextDone]} numberOfLines={1}>
                      {field.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Resident information</Text>

            <LoginField
              label="Resident last name"
              icon="person-outline"
              placeholder="Resident's last name"
              value={formData.patientLastName}
              onChangeText={(t) => setField('patientLastName', t)}
              error={!!errors.patientLastName}
              autoCapitalize="words"
            />
            {errors.patientLastName ? <Text style={styles.errorSmall}>{errors.patientLastName}</Text> : null}

            <LoginField
              label="Resident first name"
              icon="person-outline"
              placeholder="Resident's first name"
              value={formData.patientFirstName}
              onChangeText={(t) => setField('patientFirstName', t)}
              error={!!errors.patientFirstName}
              autoCapitalize="words"
            />
            {errors.patientFirstName ? <Text style={styles.errorSmall}>{errors.patientFirstName}</Text> : null}

            <SelectField
              label="Date of birth"
              icon="calendar-outline"
              value={birthDateDisplay}
              placeholder={!formData.patientBirthDate}
              error={errors.patientBirthDate}
              onPress={openBirthDatePicker}
            />

            <SelectField
              label="Gender"
              icon="male-female-outline"
              value={genderDisplay}
              placeholder={!formData.patientGender}
              error={errors.patientGender}
              onPress={() => setShowGenderModal(true)}
            />

            <SelectField
              label="Reason for admission"
              icon="medical-outline"
              value={reasonDisplay}
              placeholder={!formData.reasonForAdmission}
              error={errors.reasonForAdmission}
              onPress={() => setShowReasonModal(true)}
            />

            <SelectField
              label="Relationship to resident"
              icon="people-outline"
              value={relationshipDisplay}
              placeholder={!formData.relationshipToResident}
              error={errors.relationshipToResident}
              onPress={() => setShowRelationshipModal(true)}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.docsHeader}>
              <LinearGradient colors={['#FFF7ED', '#FFEDD5']} style={styles.docsBadge}>
                <Ionicons name="folder-open-outline" size={18} color="#EA580C" />
              </LinearGradient>
              <View style={styles.docsHeaderCopy}>
                <Text style={styles.docsTitle}>Required documents</Text>
                <Text style={styles.docsSub}>Upload clear photos or PDF files</Text>
              </View>
            </View>

            <UploadCard
              title="Valid ID"
              required
              fileName={validIdFile?.name}
              error={errors.validIdFile}
              onPress={() => void pickSingleDocument('valid_id', setValidIdFile, 'validIdFile')}
            />

            <UploadCard
              title="Birth certificate"
              required
              fileName={birthCertFile?.name}
              error={errors.birthCertFile}
              onPress={() => void pickSingleDocument('birth_cert', setBirthCertFile, 'birthCertFile')}
            />

            <UploadCard
              title="Hospital referral"
              optional
              fileName={hospitalReferralFile?.name}
              hint="Optional — families may provide a referral from a hospital."
              onPress={() => void pickSingleDocument('hospital_referral', setHospitalReferralFile)}
            />
          </View>

          <View style={styles.termsCard}>
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setField('agreeToTerms', !formData.agreeToTerms)}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: formData.agreeToTerms }}
            >
              <View style={[styles.checkbox, formData.agreeToTerms && styles.checkboxOn]}>
                {formData.agreeToTerms ? <Ionicons name="checkmark" size={12} color="#FFF" /> : null}
              </View>
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
            </TouchableOpacity>
            {errors.agreeToTerms ? <Text style={[styles.errorSmall, styles.errorCenter]}>{errors.agreeToTerms}</Text> : null}
            {errors.submit ? <Text style={[styles.errorSmall, styles.errorCenter]}>{errors.submit}</Text> : null}
          </View>

          <ScalePressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.ctaWrap, submitting && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={[C.orangeLight, C.orange, C.orangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <View style={styles.ctaInner}>
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                <Text style={styles.ctaText}>{submitting ? 'Submitting…' : 'Submit admission'}</Text>
              </View>
            </LinearGradient>
          </ScalePressable>

          <View style={styles.secondaryActions}>
            <ScalePressable onPress={saveDraft} style={styles.btnSecondary}>
              <Ionicons name="save-outline" size={16} color={C.orange} />
              <Text style={styles.btnSecondaryText}>Save draft</Text>
            </ScalePressable>
            <ScalePressable onPress={clearForm} style={styles.btnSecondary}>
              <Ionicons name="refresh-outline" size={16} color={C.orange} />
              <Text style={styles.btnSecondaryText}>Reset form</Text>
            </ScalePressable>
          </View>
      </ScrollView>

      <Modal visible={showRelationshipModal} transparent animationType="slide" onRequestClose={() => setShowRelationshipModal(false)}>
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setShowRelationshipModal(false)} />
          <View style={[styles.reasonSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reasonSheetTitle}>Relationship to resident</Text>
            {RELATIONSHIP_OPTIONS.filter((opt) => opt.value).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.reasonOption,
                  formData.relationshipToResident === opt.value && styles.reasonOptionActive,
                ]}
                onPress={() => {
                  setField('relationshipToResident', opt.value);
                  setShowRelationshipModal(false);
                }}
              >
                <Text
                  style={[
                    styles.reasonOptionText,
                    formData.relationshipToResident === opt.value && styles.reasonOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showReasonModal} transparent animationType="slide" onRequestClose={() => setShowReasonModal(false)}>
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setShowReasonModal(false)} />
          <View style={[styles.reasonSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reasonSheetTitle}>Reason for admission</Text>
            {REASON_FOR_ADMISSION_OPTIONS.filter((opt) => opt.value).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.reasonOption,
                  formData.reasonForAdmission === opt.value && styles.reasonOptionActive,
                ]}
                onPress={() => {
                  setField('reasonForAdmission', opt.value);
                  setShowReasonModal(false);
                }}
              >
                <Text
                  style={[
                    styles.reasonOptionText,
                    formData.reasonForAdmission === opt.value && styles.reasonOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showGenderModal} transparent animationType="slide" onRequestClose={() => setShowGenderModal(false)}>
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setShowGenderModal(false)} />
          <View style={[styles.reasonSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reasonSheetTitle}>Gender</Text>
            {PATIENT_GENDER_OPTIONS.filter((opt) => opt.value).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.reasonOption,
                  formData.patientGender === opt.value && styles.reasonOptionActive,
                ]}
                onPress={() => {
                  setField('patientGender', opt.value);
                  setShowGenderModal(false);
                }}
              >
                <Text
                  style={[
                    styles.reasonOptionText,
                    formData.patientGender === opt.value && styles.reasonOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && birthDateModal ? (
        <DateTimePicker
          value={birthDateDraft}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(ev, date) => {
            setBirthDateModal(false);
            if (ev.type !== 'set' || !date) return;
            setField('patientBirthDate', formatIsoDate(date));
          }}
        />
      ) : null}

      {/* @react-native-community/datetimepicker has no web implementation, so the
          Android/iOS branches below never render anything on web — fall back to the
          browser's native <input type="date">, which gives a real calendar/picker UI. */}
      <Modal visible={Platform.OS === 'web' && birthDateModal} transparent animationType="fade" onRequestClose={() => setBirthDateModal(false)}>
        <View style={styles.dateIosModalRoot}>
          <Pressable style={styles.dateIosBackdrop} onPress={() => setBirthDateModal(false)} />
          <View style={[styles.dateIosSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.dateIosHeader}>
              <View style={styles.dateIosHeaderSide} />
              <Text style={styles.dateIosTitle}>Date of birth</Text>
              <View style={[styles.dateIosHeaderSide, styles.dateIosHeaderSideEnd]}>
                <TouchableOpacity onPress={() => setBirthDateModal(false)}>
                  <Text style={styles.dateIosHeaderBtnPrimary}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.dateIosPickerWrap}>
              {React.createElement('input', {
                type: 'date',
                autoFocus: true,
                value: formData.patientBirthDate || '',
                max: formatIsoDate(new Date()),
                onChange: (e: { target: { value: string } }) => {
                  if (e.target.value) setField('patientBirthDate', e.target.value);
                },
                style: {
                  width: '100%',
                  fontSize: 16,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                },
              } as React.ComponentProps<'input'>)}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Platform.OS === 'ios' && birthDateModal} transparent animationType="slide">
        <View style={styles.dateIosModalRoot}>
          <Pressable style={styles.dateIosBackdrop} onPress={() => setBirthDateModal(false)} />
          <View style={[styles.dateIosSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.dateIosHeader}>
              <View style={styles.dateIosHeaderSide}>
                <TouchableOpacity onPress={() => setBirthDateModal(false)}>
                  <Text style={styles.dateIosHeaderBtn}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.dateIosTitle}>Date of birth</Text>
              <View style={[styles.dateIosHeaderSide, styles.dateIosHeaderSideEnd]}>
                <TouchableOpacity
                  onPress={() => {
                    setField('patientBirthDate', formatIsoDate(birthDateDraft));
                    setBirthDateModal(false);
                  }}
                >
                  <Text style={styles.dateIosHeaderBtnPrimary}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.dateIosPickerWrap}>
              <DateTimePicker
                value={birthDateDraft}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={new Date()}
                style={styles.dateIosPicker}
                onChange={(_, d) => {
                  if (d) setBirthDateDraft(d);
                }}
              />
            </View>
          </View>
        </View>
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
            <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>Application submitted!</Text>
            <Text style={styles.successBody}>
              Your admission request was sent successfully. Next, let us know when you&apos;d like to meet with Bridges of Hope.
            </Text>
            <ScalePressable
              onPress={() => {
                setShowSuccessModal(false);
                router.push({
                  pathname: TAB_ROUTES.admissionMeetingRequest,
                  params: submittedRequestId ? { requestId: submittedRequestId } : {},
                } as never);
              }}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={[C.orangeLight, C.orange, C.orangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Request a meeting time</Text>
              </LinearGradient>
            </ScalePressable>
            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                router.navigate(TAB_ROUTES.home as never);
              }}
              style={styles.successSkipBtn}
            >
              <Text style={styles.successSkipTxt}>I&apos;ll do this later</Text>
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

function SelectField({
  label,
  icon,
  value,
  placeholder,
  error,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  placeholder?: boolean;
  error?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectShell, error ? styles.inputShellError : null]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.selectIconBox}>
          <Ionicons name={icon} size={18} color={C.muted} />
        </View>
        <Text style={[styles.selectText, placeholder && styles.placeholderText]} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={18} color={C.muted} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorSmall}>{error}</Text> : null}
    </View>
  );
}

function UploadCard({
  title,
  required,
  optional,
  fileName,
  hint,
  error,
  onPress,
}: {
  title: string;
  required?: boolean;
  optional?: boolean;
  fileName?: string;
  hint?: string;
  error?: string;
  onPress: () => void;
}) {
  const uploaded = Boolean(fileName);
  return (
    <View style={styles.uploadWrap}>
      {hint ? <Text style={styles.uploadHint}>{hint}</Text> : null}
      <ScalePressable onPress={onPress} style={styles.uploadCard}>
        <View style={[styles.uploadIcon, uploaded && styles.uploadIconDone]}>
          <Ionicons
            name={uploaded ? 'document-attach' : 'cloud-upload-outline'}
            size={20}
            color={uploaded ? '#16A34A' : C.orange}
          />
        </View>
        <View style={styles.uploadCopy}>
          <View style={styles.uploadTitleRow}>
            <Text style={styles.uploadTitle}>{title}</Text>
            {required ? <Text style={styles.uploadBadge}>Required</Text> : null}
            {optional ? <Text style={styles.uploadBadgeOptional}>Optional</Text> : null}
          </View>
          <Text style={styles.uploadSub} numberOfLines={1}>
            {uploaded ? fileName : 'Tap to upload photo or PDF'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.orange} />
      </ScalePressable>
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
    minHeight: 52,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF3',
    ...Platform.select({
      web: { boxShadow: '0 1px 8px rgba(15, 23, 42, 0.06)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.orange,
    letterSpacing: -0.2,
  },
  headerWelcomeLine: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(245, 78, 37, 0.35)' },
      default: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  heroBand: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: 'relative',
  },
  heroBandWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(74, 40, 50, 0.4)',
    borderTopLeftRadius: 80,
  },
  heroBandInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    zIndex: 1,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FF8A65',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
    fontWeight: '500',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  saveBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.navy,
  },
  percentPill: {
    backgroundColor: 'rgba(245, 78, 37, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 78, 37, 0.15)',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.orange,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E8EDF3',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  cardSub: {
    marginTop: 8,
    fontSize: 12,
    color: C.muted,
    fontWeight: '500',
  },
  checklistWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '100%',
  },
  checkChipDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    flexShrink: 1,
  },
  checkChipTextDone: {
    color: '#166534',
  },
  requirementsCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF7F4',
    borderWidth: 1,
    borderColor: 'rgba(245, 78, 37, 0.15)',
  },
  requirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.navy,
  },
  requirementsBody: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  docsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  docsBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  docsHeaderCopy: { flex: 1 },
  docsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 2,
  },
  docsSub: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },
  uploadWrap: { marginBottom: 10 },
  uploadHint: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 8,
    lineHeight: 16,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 78, 37, 0.2)',
    backgroundColor: '#FFF7F4',
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 78, 37, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconDone: {
    backgroundColor: '#DCFCE7',
  },
  uploadCopy: { flex: 1, minWidth: 0 },
  uploadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.navy,
  },
  uploadBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: C.orange,
    backgroundColor: 'rgba(245, 78, 37, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  uploadBadgeOptional: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  uploadSub: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '500',
  },
  termsCard: {
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 14,
    marginBottom: 16,
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      web: {},
      default: {
        shadowColor: C.orangeDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
      },
    }),
  },
  cta: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
    marginBottom: 8,
  },
  selectShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  selectIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: C.navy,
    fontWeight: '500',
    paddingVertical: 12,
  },
  inputShellError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
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
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
    fontWeight: '500',
  },
  termsLink: {
    color: C.orange,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF7F4',
    borderWidth: 1,
    borderColor: 'rgba(245, 78, 37, 0.2)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnSecondaryText: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 21, 40, 0.45)',
  },
  reasonSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  reasonSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  reasonOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  reasonOptionActive: {
    backgroundColor: '#FFF7F4',
    borderColor: 'rgba(245, 78, 37, 0.25)',
  },
  reasonOptionText: {
    fontSize: 15,
    color: C.navy,
    textAlign: 'center',
    fontWeight: '500',
  },
  reasonOptionTextActive: {
    color: C.orange,
    fontWeight: '800',
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
    fontSize: 19,
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
    backgroundColor: 'rgba(11, 21, 40, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  successSkipBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  successSkipTxt: { fontSize: 13, fontWeight: '700', color: C.muted },
});
