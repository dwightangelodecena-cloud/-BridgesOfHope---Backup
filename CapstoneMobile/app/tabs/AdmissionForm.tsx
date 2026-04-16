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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appendActivityFeed } from '../../lib/activityFeed';
import { PsgcSearchableSelect } from '../../components/PsgcSearchableSelect';
import { usePsgcAddressCascade } from '../../hooks/usePsgcAddressCascade';
import {
  getAddressStorageKey,
  loadAddressDraft,
  saveAddressDraft,
} from '../../lib/addressPersistence';

const { width } = Dimensions.get('window');

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

const DRAFT_KEY = 'bh_admission_draft';

type FormData = {
  fullName: string;
  email: string;
  phoneNumber: string;
  province: string;
  municipalityCity: string;
  street: string;
  barangay: string;
  patientName: string;
  patientBirthday: string;
  reasonForAdmission: string;
  agreeToTerms: boolean;
};

const emptyForm: FormData = {
  fullName: '',
  email: '',
  phoneNumber: '',
  province: '',
  municipalityCity: '',
  street: '',
  barangay: '',
  patientName: '',
  patientBirthday: '',
  reasonForAdmission: '',
  agreeToTerms: false,
};

const REASON_OPTIONS = ['Substance Abuse', 'Non-Substance Abuse'] as const;

export default function AdmissionForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveBanner, setSaveBanner] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  /** iOS only: draft while modal is open so Cancel does not overwrite the field */
  const [iosDraftBirthDate, setIosDraftBirthDate] = useState(() => new Date(2000, 0, 1));
  const [submitting, setSubmitting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');

  const requiredFields = useMemo(
    () =>
      [
        { key: 'fullName' as const, label: 'Full Name' },
        { key: 'email' as const, label: 'Email Address' },
        { key: 'phoneNumber' as const, label: 'Phone Number' },
        { key: 'province' as const, label: 'Province' },
        { key: 'municipalityCity' as const, label: 'Municipality/City' },
        { key: 'barangay' as const, label: 'Barangay' },
        { key: 'street' as const, label: 'Street' },
        { key: 'patientName' as const, label: 'Patient Name' },
        { key: 'patientBirthday' as const, label: 'Patient Birthday' },
        { key: 'reasonForAdmission' as const, label: 'Reason for Admission' },
      ] as const,
    []
  );

  const completedFields = requiredFields.filter((f) => String(formData[f.key]).trim()).length;
  const progressPercent = Math.round((completedFields / requiredFields.length) * 100);

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
    hydrateFromSaved,
  } = usePsgcAddressCascade({ cityFieldKey: 'municipalityCity' });

  const psgcCodesRef = useRef({
    provinceCode: '',
    provinceKind: 'province',
    cityCode: '',
    barangayCode: '',
  });
  const [addressRestored, setAddressRestored] = useState(false);
  const psgcKey = getAddressStorageKey('admission');

  useEffect(() => {
    if (loadingProvinces) return;
    let cancelled = false;
    (async () => {
      const saved = await loadAddressDraft(psgcKey);
      if (!saved?.provinceCode || cancelled) return;
      const ok = await hydrateFromSaved(
        {
          provinceCode: saved.provinceCode!,
          provinceKind: (saved.provinceKind as 'province' | 'region') || 'province',
          cityCode: saved.cityCode,
          barangayCode: saved.barangayCode,
          province: saved.province,
          street: saved.street,
        },
        setFormData
      );
      if (!ok || cancelled) return;
      psgcCodesRef.current = {
        provinceCode: saved.provinceCode!,
        provinceKind: saved.provinceKind || 'province',
        cityCode: saved.cityCode || '',
        barangayCode: saved.barangayCode || '',
      };
      setAddressRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadingProvinces, psgcKey, hydrateFromSaved]);

  useEffect(() => {
    const p = provinceOptions.find((o) => o.name === formData.province);
    if (p) {
      psgcCodesRef.current.provinceCode = p.code;
      psgcCodesRef.current.provinceKind = p.kind || 'province';
    }
  }, [formData.province, provinceOptions]);

  useEffect(() => {
    const c = cityOptions.find((o) => o.name === formData.municipalityCity);
    if (c) psgcCodesRef.current.cityCode = c.code;
  }, [formData.municipalityCity, cityOptions]);

  useEffect(() => {
    const b = barangayOptions.find((o) => o.name === formData.barangay);
    if (b) psgcCodesRef.current.barangayCode = b.code;
  }, [formData.barangay, barangayOptions]);

  useEffect(() => {
    if (!formData.province.trim()) return;
    const t = setTimeout(() => {
      void saveAddressDraft(psgcKey, {
        province: formData.province.trim(),
        city: formData.municipalityCity.trim(),
        barangay: formData.barangay.trim(),
        street: formData.street.trim(),
        provinceCode: psgcCodesRef.current.provinceCode,
        provinceKind: psgcCodesRef.current.provinceKind,
        cityCode: psgcCodesRef.current.cityCode,
        barangayCode: psgcCodesRef.current.barangayCode,
      });
    }, 450);
    return () => clearTimeout(t);
  }, [psgcKey, formData.province, formData.municipalityCity, formData.barangay, formData.street]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as Partial<FormData> & { middleInitial?: string };
          const { middleInitial: _omitMi, ...draft } = parsed;
          setFormData((prev) => ({ ...prev, ...draft, agreeToTerms: Boolean(parsed.agreeToTerms) }));
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
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        let resolved =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'Family User';
        if (user?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) resolved = profileRow.full_name.trim();
        }
        if (mounted) {
          setDisplayName(resolved);
          setUserInitials(deriveInitials(resolved));
        }
      } catch {
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
    if (!formData.fullName.trim()) next.fullName = 'Full name is required';
    if (!formData.email.trim()) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Invalid email format';
    if (!formData.phoneNumber.trim()) next.phoneNumber = 'Phone number is required';
    if (!formData.province.trim()) next.province = 'Province is required';
    if (!formData.municipalityCity.trim()) next.municipalityCity = 'Municipality/City is required';
    if (!formData.street.trim()) next.street = 'Street is required';
    else if (formData.street.trim().length < 2) next.street = 'Enter a valid street (at least 2 characters)';
    if (!formData.barangay.trim()) next.barangay = 'Barangay is required';
    if (!formData.patientName.trim()) next.patientName = 'Patient name is required';
    if (!formData.patientBirthday) next.patientBirthday = 'Birthday is required';
    if (!formData.reasonForAdmission) next.reasonForAdmission = 'Please select a reason';
    if (!formData.agreeToTerms) next.agreeToTerms = 'You must agree to the terms';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData]);

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

      const extendedRow = {
        family_id: user.id,
        guardian_full_name: formData.fullName.trim(),
        guardian_email: formData.email.trim(),
        guardian_phone: formData.phoneNumber.trim(),
        guardian_province: formData.province.trim(),
        guardian_municipality_city: formData.municipalityCity.trim(),
        guardian_street: formData.street.trim(),
        guardian_barangay: formData.barangay.trim(),
        patient_name: formData.patientName.trim(),
        patient_birth_date: formData.patientBirthday,
        reason_for_admission: formData.reasonForAdmission,
      };

      let { error } = await supabase.from('admission_requests').insert(extendedRow);

      if (
        error &&
        /column|schema cache|does not exist|PGRST204/i.test(error.message)
      ) {
        const minimalRow = {
          family_id: user.id,
          guardian_full_name: formData.fullName.trim(),
          guardian_email: formData.email.trim(),
          guardian_phone: formData.phoneNumber.trim(),
          patient_name: formData.patientName.trim(),
          patient_birth_date: formData.patientBirthday,
          reason_for_admission: formData.reasonForAdmission,
        };
        ({ error } = await supabase.from('admission_requests').insert(minimalRow));
      }

      if (error) {
        setErrors({ submit: error.message || 'Could not submit request.' });
        return;
      }

      await appendActivityFeed(
        `Admission request submitted for ${formData.patientName.trim()}. Pending admin review.`,
        { familyId: user.id }
      );
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

  const birthDateValue = useMemo(() => {
    if (!formData.patientBirthday?.trim()) return new Date(2000, 0, 1);
    const parsed = new Date(`${formData.patientBirthday.trim()}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date(2000, 0, 1) : parsed;
  }, [formData.patientBirthday]);

  const displayBirthday = formData.patientBirthday
    ? (() => {
        const [y, m, d] = formData.patientBirthday.split('-');
        return m && d && y ? `${m}/${d}/${y}` : formData.patientBirthday;
      })()
    : '';

  const formatDateToISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const openBirthdayPicker = () => {
    if (Platform.OS === 'ios') {
      setIosDraftBirthDate(birthDateValue);
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const onAndroidDateChange = (_event: { type?: string }, date?: Date) => {
    setShowDatePicker(false);
    if (_event?.type === 'dismissed' || !date) return;
    setField('patientBirthday', formatDateToISO(date));
  };

  const iosDatePickerDisplay =
    Platform.OS === 'ios' && parseFloat(String(Platform.Version)) >= 14 ? 'inline' : 'spinner';

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
            {NOTIFICATION_ITEMS.map((item) => (
              <View key={item} style={styles.notificationsDropdownRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notificationsDropdownText}>{item}</Text>
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
            Welcome back, {displayName}
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
              const done = Boolean(String(formData[field.key]).trim());
              return (
                <View key={field.key} style={styles.checklistRow}>
                  <Text style={styles.checklistLabel}>{field.label}</Text>
                  <Text style={[styles.checklistStatus, done ? styles.checklistDone : styles.checklistPending]}>
                    {done ? 'Done' : 'Pending'}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.checklistFooter}>Estimated review: 1-3 business days after submission.</Text>
          </View>

          <View style={styles.formBlock}>
            <LabeledInput
              label="Full Name"
              placeholder="Your full name"
              icon="person-outline"
              value={formData.fullName}
              onChangeText={(t) => setField('fullName', t)}
              error={errors.fullName}
            />
            <LabeledInput
              label="Email Address"
              placeholder="Email address"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(t) => setField('email', t)}
              error={errors.email}
            />
            <LabeledInput
              label="Phone Number"
              placeholder="Contact number"
              icon="call-outline"
              keyboardType="phone-pad"
              value={formData.phoneNumber}
              onChangeText={(t) => setField('phoneNumber', t)}
              error={errors.phoneNumber}
            />
            <View style={styles.addressSection}>
              <Text style={styles.addressKicker}>Guardian address</Text>
              <Text style={styles.addressTitle}>Philippine address</Text>
              <Text style={styles.addressSub}>
                PSGC-backed lists. Complete each step before the next unlocks.
              </Text>
              {addressRestored ? (
                <Text style={styles.addressRestored}>Last address on this device was restored.</Text>
              ) : null}
              {fetchError ? (
                <View style={styles.fetchBanner}>
                  <Text style={styles.fetchBannerText}>{fetchError}</Text>
                  <TouchableOpacity onPress={() => setFetchError('')}>
                    <Text style={styles.fetchDismiss}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <PsgcSearchableSelect
                label="Province"
                description="Type to filter."
                icon="location-outline"
                options={provinceOptions}
                valueName={formData.province}
                onSelect={(opt) => {
                  void onProvinceSelected(opt, setFormData);
                  setErrors((e) => {
                    const n = { ...e };
                    delete n.province;
                    return n;
                  });
                }}
                disabled={loadingProvinces}
                loading={loadingProvinces}
                placeholder={loadingProvinces ? 'Loading provinces…' : 'Choose Province'}
                emptyText="No province matched."
                errorText={errors.province || ''}
              />
              <PsgcSearchableSelect
                label="City / Municipality"
                description="Loads after province."
                icon="business-outline"
                options={cityOptions}
                valueName={formData.municipalityCity}
                onSelect={(opt) => {
                  void onCitySelected(opt, setFormData);
                  setErrors((e) => {
                    const n = { ...e };
                    delete n.municipalityCity;
                    return n;
                  });
                }}
                disabled={!formData.province.trim() || loadingCities}
                loading={loadingCities}
                placeholder={
                  !formData.province.trim()
                    ? 'Choose Province First'
                    : loadingCities
                      ? 'Loading cities…'
                      : 'Choose City / Municipality'
                }
                emptyText={loadingCities ? 'Loading…' : 'No match in this province.'}
                errorText={errors.municipalityCity || ''}
              />
              <PsgcSearchableSelect
                label="Barangay"
                description="Loads after city."
                icon="pin-outline"
                options={barangayOptions}
                valueName={formData.barangay}
                onSelect={(opt) => {
                  onBarangaySelected(opt, setFormData);
                  setErrors((e) => {
                    const n = { ...e };
                    delete n.barangay;
                    return n;
                  });
                }}
                disabled={!formData.municipalityCity.trim() || loadingBarangays}
                loading={loadingBarangays}
                placeholder={
                  !formData.municipalityCity.trim()
                    ? 'Choose City First'
                    : loadingBarangays
                      ? 'Loading barangays…'
                      : 'Choose Barangay'
                }
                emptyText={loadingBarangays ? 'Loading…' : 'No barangay matched.'}
                errorText={errors.barangay || ''}
              />
              <LabeledInput
                label="Street / Building Line"
                placeholder="Enter block, lot, street, or building (e.g. Blk 2 Lot 15)"
                icon="navigate-outline"
                value={formData.street}
                onChangeText={(t) => setField('street', t)}
                error={errors.street}
              />
              <Text style={styles.streetHint}>
                Block, lot, street, building, or subdivision (not in the lists above).
              </Text>
            </View>
            <LabeledInput
              label="Patient Name"
              placeholder="Patient's full name"
              icon="person-outline"
              value={formData.patientName}
              onChangeText={(t) => setField('patientName', t)}
              error={errors.patientName}
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Patient Birthday</Text>
              <TouchableOpacity
                style={[styles.inputShell, errors.patientBirthday ? styles.inputShellError : null]}
                onPress={openBirthdayPicker}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text
                  style={[styles.dateInputText, !formData.patientBirthday && styles.placeholderText]}
                >
                  {formData.patientBirthday ? displayBirthday : 'MM/DD/YYYY'}
                </Text>
              </TouchableOpacity>
              {errors.patientBirthday ? <Text style={styles.errorSmall}>{errors.patientBirthday}</Text> : null}
            </View>

            {Platform.OS === 'android' && showDatePicker ? (
              <DateTimePicker
                value={birthDateValue}
                mode="date"
                display="default"
                onChange={onAndroidDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            ) : null}

            <Modal
              visible={Platform.OS === 'ios' && showDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.dateIosModalRoot}>
                <Pressable style={styles.dateIosBackdrop} onPress={() => setShowDatePicker(false)} />
                <View style={[styles.dateIosSheet, { paddingBottom: insets.bottom + 12 }]}>
                  <View style={styles.dateIosHeader}>
                    <View style={styles.dateIosHeaderSide}>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel date selection"
                      >
                        <Text style={styles.dateIosHeaderBtn}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dateIosTitle}>Date of birth</Text>
                    <View style={[styles.dateIosHeaderSide, styles.dateIosHeaderSideEnd]}>
                      <TouchableOpacity
                        onPress={() => {
                          setField('patientBirthday', formatDateToISO(iosDraftBirthDate));
                          setShowDatePicker(false);
                        }}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Confirm date"
                      >
                        <Text style={styles.dateIosHeaderBtnPrimary}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.dateIosPickerWrap}>
                    <DateTimePicker
                      value={iosDraftBirthDate}
                      mode="date"
                      display={iosDatePickerDisplay as 'inline' | 'spinner'}
                      themeVariant="light"
                      style={styles.dateIosPicker}
                      onChange={(_, date) => {
                        if (date) setIosDraftBirthDate(date);
                      }}
                      maximumDate={new Date()}
                      minimumDate={new Date(1900, 0, 1)}
                    />
                  </View>
                </View>
              </View>
            </Modal>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Reason for Admission</Text>
              <TouchableOpacity
                style={[styles.inputShell, errors.reasonForAdmission ? styles.inputShellError : null]}
                onPress={() => setShowReasonModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="clipboard-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text style={[styles.dateInputText, !formData.reasonForAdmission && styles.placeholderText]}>
                  {formData.reasonForAdmission || 'Select Reason'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {errors.reasonForAdmission ? <Text style={styles.errorSmall}>{errors.reasonForAdmission}</Text> : null}
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

      <Modal visible={showReasonModal} transparent animationType="fade" onRequestClose={() => setShowReasonModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowReasonModal(false)}>
          <View style={styles.reasonSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.reasonSheetTitle}>Select Reason</Text>
            {REASON_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.reasonOption}
                onPress={() => {
                  setField('reasonForAdmission', opt);
                  setShowReasonModal(false);
                }}
              >
                <Text style={styles.reasonOptionText}>{opt}</Text>
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
              <Text style={styles.termsSub}>Clinic Admission and Patient Management System</Text>
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
                body="Patient records are confidential and may only be accessed by authorized staff and the registered patient or guardian."
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
            <Text style={styles.successBody}>Your request has been sent to the admin for approval.</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
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
  checklistFooter: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
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
    fontSize: 15,
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
    minHeight: 52,
    paddingHorizontal: 14,
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
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 12,
  },
  dateInputText: {
    flex: 1,
    fontSize: 16,
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
    paddingVertical: 16,
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
