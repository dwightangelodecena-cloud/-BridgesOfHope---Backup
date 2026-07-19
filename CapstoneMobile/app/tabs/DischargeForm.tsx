import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appendActivityFeed } from '../../lib/activityFeed';
import {
  FAMILY_DISCHARGE_TYPE,
  FAMILY_TEMPORARY_REASON_CATEGORIES,
} from '../../lib/dischargeRequestTypesMobile';
import { LoginField } from '../../components/auth/LoginField';
import { ScalePressable } from '../../components/auth/ScalePressable';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;

const C = {
  orange: '#F54E25',
  orangeLight: '#FF6A3D',
  orangeDark: '#E8441A',
  navy: '#1A2B4A',
  muted: '#64748B',
  white: '#FFFFFF',
};

type PatientOpt = { id: string; name: string };

const BASE_REQUIRED_COUNT = 6;

function formatIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DischargeForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonCategoryOther, setReasonCategoryOther] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [pickupAuthorized, setPickupAuthorized] = useState('');
  const [followUpPhone, setFollowUpPhone] = useState('');
  const [escortName, setEscortName] = useState('');
  const [escortRelation, setEscortRelation] = useState('');
  const [escortContact, setEscortContact] = useState('');
  const [destinationAfterDischarge, setDestinationAfterDischarge] = useState('');
  const [belongingsChecklist, setBelongingsChecklist] = useState('');
  const [otherInfo, setOtherInfo] = useState('');

  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [prefDateModal, setPrefDateModal] = useState(false);
  const [prefDateDraft, setPrefDateDraft] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedPatient = useMemo(
    () => patients.find((p) => String(p.id) === String(selectedPatientId)),
    [patients, selectedPatientId]
  );

  const loadPatients = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setPatients([]);
      return;
    }
    const { data } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('family_id', user.id)
      .is('discharged_at', null)
      .order('admitted_at', { ascending: false });
    setPatients((data || []).map((r) => ({ id: String(r.id), name: String(r.full_name || '') })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPatients();
    }, [loadPatients])
  );

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isFieldDone = useCallback(
    (key: string) => {
      switch (key) {
        case 'selectedPatientId':
          return Boolean(selectedPatientId);
        case 'reasonCategory':
          return Boolean(reasonCategory);
        case 'reasonCategoryOther':
          return reasonCategory !== 'Other' || Boolean(reasonCategoryOther.trim());
        case 'reasonDetails':
          return reasonDetails.trim().length >= 15;
        case 'escortName':
          return Boolean(escortName.trim());
        case 'escortContact':
          return Boolean(escortContact.trim());
        case 'destinationAfterDischarge':
          return Boolean(destinationAfterDischarge.trim());
        default:
          return false;
      }
    },
    [
      selectedPatientId,
      reasonCategory,
      reasonCategoryOther,
      reasonDetails,
      escortName,
      escortContact,
      destinationAfterDischarge,
    ]
  );

  const requiredFieldCount = reasonCategory === 'Other' ? BASE_REQUIRED_COUNT + 1 : BASE_REQUIRED_COUNT;

  const completedFields = useMemo(() => {
    const keys = [
      'selectedPatientId',
      'reasonCategory',
      ...(reasonCategory === 'Other' ? (['reasonCategoryOther'] as const) : []),
      'reasonDetails',
      'escortName',
      'escortContact',
      'destinationAfterDischarge',
    ];
    return keys.filter((k) => isFieldDone(k)).length;
  }, [isFieldDone, reasonCategory]);

  const progressPercent = useMemo(
    () => Math.round((completedFields / requiredFieldCount) * 100),
    [completedFields, requiredFieldCount]
  );

  const validate = () => {
    const next: Record<string, string> = {};
    if (!selectedPatientId) {
      next.selectedPatientId = 'Please choose which family member this request is for.';
    }
    if (!reasonCategory) {
      next.reasonCategory = 'Please choose the option that best matches your situation.';
    }
    if (reasonCategory === 'Other' && !reasonCategoryOther.trim()) {
      next.reasonCategoryOther = 'Please briefly describe the reason.';
    }
    if (!reasonDetails.trim() || reasonDetails.trim().length < 15) {
      next.reasonDetails =
        'Please add a bit more detail (at least 15 characters) so staff can understand your request.';
    }
    if (!escortName.trim()) {
      next.escortName = 'Please enter the name of the person who will pick up your family member.';
    }
    if (!escortContact.trim()) {
      next.escortContact = 'Please enter a phone number for the person who will pick them up.';
    }
    if (!destinationAfterDischarge.trim()) {
      next.destinationAfterDischarge =
        'Please tell us where they will stay during this temporary leave (for example your home).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const canSubmit = useMemo(
    () => completedFields === requiredFieldCount,
    [completedFields, requiredFieldCount]
  );

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Missing information', 'Please correct the highlighted fields.');
      return;
    }
    if (!selectedPatient) return;

    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Supabase not configured',
        'Cannot submit discharge request because Supabase credentials are missing.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        Alert.alert('Not signed in', 'Please sign in first to submit a discharge request.');
        return;
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      const bundledOtherInfo = [
        reasonCategory === 'Other' && reasonCategoryOther.trim()
          ? `Other Reason Category: ${reasonCategoryOther.trim()}`
          : '',
        otherInfo?.trim() ? `Additional Notes: ${otherInfo.trim()}` : '',
        escortName?.trim() ? `Authorized Escort: ${escortName.trim()}` : '',
        escortRelation?.trim() ? `Escort Relationship: ${escortRelation.trim()}` : '',
        escortContact?.trim() ? `Escort Contact: ${escortContact.trim()}` : '',
        destinationAfterDischarge?.trim() ? `Discharge Destination: ${destinationAfterDischarge.trim()}` : '',
        belongingsChecklist?.trim() ? `Belongings Checklist: ${belongingsChecklist.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const familyName =
        profileRow?.full_name?.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        'Family User';
      const familyEmail = user.email || null;
      const familyPhone =
        profileRow?.phone?.trim() ||
        (user.user_metadata?.phone as string | undefined)?.trim() ||
        null;

      const dischargePayload = {
        patient_id: selectedPatient.id,
        family_id: user.id,
        family_name: familyName,
        guardian_email: familyEmail,
        guardian_phone: familyPhone,
        discharge_type: FAMILY_DISCHARGE_TYPE,
        reason_category: reasonCategory,
        reason_details: reasonDetails.trim(),
        preferred_discharge_date: preferredDate.trim() || null,
        pickup_authorized: pickupAuthorized.trim() || null,
        follow_up_phone: followUpPhone.trim() || null,
        other_info: bundledOtherInfo || null,
        status: 'pending',
      };

      let { error } = await supabase.from('discharge_requests').insert(dischargePayload);
      if (error) {
        ({ error } = await supabase.from('discharge_requests').insert({
          patient_id: selectedPatient.id,
          family_id: user.id,
          reason_category: reasonCategory,
          reason_details: reasonDetails.trim(),
          preferred_discharge_date: preferredDate.trim() || null,
          pickup_authorized: pickupAuthorized.trim() || null,
          follow_up_phone: followUpPhone.trim() || null,
          other_info: bundledOtherInfo || null,
          status: 'pending',
        }));
      }

      if (error) {
        Alert.alert('Submission failed', error.message || 'Could not submit discharge request.');
        return;
      }

      await appendActivityFeed(
        `Temporary discharge request submitted for ${selectedPatient.name}. Awaiting admin review.`,
        { familyId: user.id }
      );

      Alert.alert('Success', 'Temporary discharge request submitted and sent to the admin queue.');
      setSelectedPatientId('');
      setReasonCategory('');
      setReasonCategoryOther('');
      setReasonDetails('');
      setPreferredDate('');
      setPickupAuthorized('');
      setFollowUpPhone('');
      setEscortName('');
      setEscortRelation('');
      setEscortContact('');
      setDestinationAfterDischarge('');
      setBelongingsChecklist('');
      setOtherInfo('');
      setErrors({});
      router.replace(TAB_ROUTES.home);
    } catch (e) {
      Alert.alert('Submission failed', String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPreferredDatePicker = () => {
    setPrefDateDraft(preferredDate ? new Date(`${preferredDate}T12:00:00`) : new Date());
    setPrefDateModal(true);
  };

  const displayPreferred = preferredDate || 'Select start date';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.navigate(TAB_ROUTES.progress)}
          style={styles.headerBack}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrandTitle}>Discharge</Text>
          <Text style={styles.headerWelcomeLine} numberOfLines={1}>
            Temporary leave request
          </Text>
        </View>
        <View style={styles.headerSpacer} />
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
            <Ionicons name="exit-outline" size={24} color="#fff" />
          </LinearGradient>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>FAMILY REQUEST</Text>
            <Text style={styles.heroTitle}>Temporary discharge</Text>
            <Text style={styles.heroSub}>
              Short-term leave only — your family member is expected to return after this leave.
            </Text>
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
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="information-circle-outline" size={18} color={C.orange} />
            <Text style={styles.noticeTitle}>Before you submit</Text>
          </View>
          <Text style={styles.noticeBody}>
            This form is for temporary leave only. All escort and destination details help our care team
            review your request safely.
          </Text>
        </View>

        <View style={styles.progressCard}>
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
            {completedFields} of {requiredFieldCount} required fields completed
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <SelectField
            label="Which family member is this for?"
            icon="person-outline"
            value={selectedPatient?.name || 'Choose someone currently admitted'}
            placeholder={!selectedPatient}
            error={errors.selectedPatientId}
            onPress={() => setPatientModalVisible(true)}
          />

          {!patients.length ? (
            <Text style={styles.emptyPatients}>
              No one in your family is listed as admitted right now, so a temporary discharge request
              cannot be submitted yet.
            </Text>
          ) : null}
        </View>

        {selectedPatientId ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Reason & timing</Text>

              <SelectField
                label="What best describes your reason?"
                icon="list-outline"
                value={reasonCategory || 'Choose one'}
                placeholder={!reasonCategory}
                error={errors.reasonCategory}
                onPress={() => setReasonModalVisible(true)}
              />

              {reasonCategory === 'Other' ? (
                <>
                  <LoginField
                    label="Describe your reason"
                    icon="create-outline"
                    placeholder="Brief description"
                    value={reasonCategoryOther}
                    onChangeText={(t) => {
                      setReasonCategoryOther(t);
                      clearFieldError('reasonCategoryOther');
                    }}
                    error={!!errors.reasonCategoryOther}
                  />
                  {errors.reasonCategoryOther ? (
                    <Text style={styles.errorSmall}>{errors.reasonCategoryOther}</Text>
                  ) : null}
                </>
              ) : null}

              <SelectField
                label="Preferred start date of temporary leave"
                icon="calendar-outline"
                value={displayPreferred}
                placeholder={!preferredDate}
                onPress={openPreferredDatePicker}
              />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Pickup & contact</Text>

              <LoginField
                label="Who is allowed to pick them up?"
                icon="people-outline"
                placeholder="e.g. parent, spouse"
                value={pickupAuthorized}
                onChangeText={setPickupAuthorized}
              />

              <LoginField
                label="Best phone number to reach you"
                icon="call-outline"
                placeholder="Your follow-up number"
                keyboardType="phone-pad"
                value={followUpPhone}
                onChangeText={setFollowUpPhone}
              />

              <LoginField
                label="Name of person picking them up"
                icon="person-outline"
                placeholder="Full name"
                value={escortName}
                onChangeText={(t) => {
                  setEscortName(t);
                  clearFieldError('escortName');
                }}
                error={!!errors.escortName}
              />
              {errors.escortName ? <Text style={styles.errorSmall}>{errors.escortName}</Text> : null}

              <LoginField
                label="That person's relationship to your family member"
                icon="heart-outline"
                placeholder="e.g. mother, partner"
                value={escortRelation}
                onChangeText={setEscortRelation}
              />

              <LoginField
                label="Pickup person's phone number"
                icon="call-outline"
                placeholder="Mobile or landline"
                keyboardType="phone-pad"
                value={escortContact}
                onChangeText={(t) => {
                  setEscortContact(t);
                  clearFieldError('escortContact');
                }}
                error={!!errors.escortContact}
              />
              {errors.escortContact ? <Text style={styles.errorSmall}>{errors.escortContact}</Text> : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Leave details</Text>

              <LoginField
                label="Where will they stay during this temporary leave?"
                icon="location-outline"
                placeholder="Home or relative's address"
                value={destinationAfterDischarge}
                onChangeText={(t) => {
                  setDestinationAfterDischarge(t);
                  clearFieldError('destinationAfterDischarge');
                }}
                error={!!errors.destinationAfterDischarge}
              />
              {errors.destinationAfterDischarge ? (
                <Text style={styles.errorSmall}>{errors.destinationAfterDischarge}</Text>
              ) : null}

              <AreaField
                label="Important items going home"
                icon="briefcase-outline"
                placeholder="Clothing, IDs, meds, etc."
                value={belongingsChecklist}
                onChangeText={setBelongingsChecklist}
              />

              <AreaField
                label="Tell us more about your request"
                icon="document-text-outline"
                placeholder="Timing, circumstances, details…"
                value={reasonDetails}
                onChangeText={(t) => {
                  setReasonDetails(t);
                  clearFieldError('reasonDetails');
                }}
                error={!!errors.reasonDetails}
              />
              {errors.reasonDetails ? <Text style={styles.errorSmall}>{errors.reasonDetails}</Text> : null}

              <AreaField
                label="Anything else we should know?"
                icon="chatbox-ellipses-outline"
                placeholder="Optional"
                value={otherInfo}
                onChangeText={setOtherInfo}
              />
            </View>
          </>
        ) : null}

        <ScalePressable
          onPress={handleSubmit}
          disabled={isSubmitting || !canSubmit || !selectedPatientId}
          style={[styles.ctaWrap, (isSubmitting || !canSubmit || !selectedPatientId) && { opacity: 0.75 }]}
        >
          <LinearGradient
            colors={[C.orangeLight, C.orange, C.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.ctaInner}>
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                <Text style={styles.ctaText}>Submit request</Text>
              </View>
            )}
          </LinearGradient>
        </ScalePressable>
      </ScrollView>

      <Modal visible={reasonModalVisible} transparent animationType="slide" onRequestClose={() => setReasonModalVisible(false)}>
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setReasonModalVisible(false)} />
          <View style={[styles.reasonSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reasonSheetTitle}>What best describes your reason?</Text>
            {FAMILY_TEMPORARY_REASON_CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.reasonOption, reasonCategory === item && styles.reasonOptionActive]}
                onPress={() => {
                  setReasonCategory(item);
                  if (item !== 'Other') setReasonCategoryOther('');
                  clearFieldError('reasonCategory');
                  clearFieldError('reasonCategoryOther');
                  setReasonModalVisible(false);
                }}
              >
                <Text style={[styles.reasonOptionText, reasonCategory === item && styles.reasonOptionTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={patientModalVisible} transparent animationType="slide" onRequestClose={() => setPatientModalVisible(false)}>
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setPatientModalVisible(false)} />
          <View style={[styles.reasonSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reasonSheetTitle}>Which family member is this for?</Text>
            {patients.length === 0 ? (
              <Text style={styles.sheetEmpty}>No admitted residents found.</Text>
            ) : (
              patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.reasonOption, selectedPatientId === p.id && styles.reasonOptionActive]}
                  onPress={() => {
                    setSelectedPatientId(p.id);
                    clearFieldError('selectedPatientId');
                    setPatientModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.reasonOptionText,
                      selectedPatientId === p.id && styles.reasonOptionTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && prefDateModal ? (
        <DateTimePicker
          value={prefDateDraft}
          mode="date"
          display="default"
          onChange={(ev, date) => {
            setPrefDateModal(false);
            if (ev.type !== 'set' || !date) return;
            setPreferredDate(formatIsoDate(date));
          }}
        />
      ) : null}

      <Modal visible={Platform.OS === 'ios' && prefDateModal} transparent animationType="slide">
        <View style={styles.dateModalRoot}>
          <Pressable style={styles.sheetModalBackdrop} onPress={() => setPrefDateModal(false)} />
          <View style={[styles.dateIosSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.dateIosHeader}>
              <TouchableOpacity onPress={() => setPrefDateModal(false)}>
                <Text style={styles.dateIosBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.dateIosTitle}>Preferred start date</Text>
              <TouchableOpacity
                onPress={() => {
                  setPreferredDate(formatIsoDate(prefDateDraft));
                  setPrefDateModal(false);
                }}
              >
                <Text style={styles.dateIosBtnPrimary}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={prefDateDraft}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(_, d) => {
                if (d) setPrefDateDraft(d);
              }}
            />
          </View>
        </View>
      </Modal>
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
  placeholder: boolean;
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

function AreaField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  error,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.areaShell, error ? styles.inputShellError : null]}>
        <View style={styles.selectIconBox}>
          <Ionicons name={icon} size={18} color={C.muted} />
        </View>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          style={styles.areaInput}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={value}
          onChangeText={onChangeText}
          {...Platform.select({
            web: { outlineStyle: 'none' as const },
            default: {},
          })}
        />
      </View>
    </View>
  );
}

const cardShadow = Platform.select({
  web: { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)' },
  default: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerCenter: { flex: 1, minWidth: 0 },
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
  headerSpacer: { width: 40 },
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
    alignItems: 'center',
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
  scrollContent: {
    paddingHorizontal: isCompactScreen ? 14 : 20,
    paddingTop: 16,
  },
  noticeCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  noticeBody: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
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
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  emptyPatients: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 8,
    marginTop: -4,
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  selectShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    minHeight: 54,
    paddingRight: 14,
    backgroundColor: '#F8FAFC',
  },
  selectIconBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: C.navy,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  areaShell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    minHeight: 110,
    paddingRight: 14,
    paddingTop: 10,
    backgroundColor: '#F8FAFC',
  },
  areaInput: {
    flex: 1,
    fontSize: 15,
    color: C.navy,
    fontWeight: '500',
    lineHeight: 21,
    minHeight: 88,
    paddingTop: 4,
  },
  inputShellError: {
    borderColor: '#DC2626',
  },
  errorSmall: {
    marginTop: -8,
    marginBottom: 8,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
    ...Platform.select({
      web: { boxShadow: '0 6px 20px rgba(245, 78, 37, 0.3)' },
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
  sheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  reasonSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '70%',
  },
  reasonSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  sheetEmpty: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 14,
    paddingVertical: 20,
  },
  reasonOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  reasonOptionActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  reasonOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.navy,
    textAlign: 'center',
  },
  reasonOptionTextActive: {
    color: C.orange,
    fontWeight: '800',
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateIosSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  dateIosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateIosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateIosBtn: {
    fontSize: 16,
    color: '#64748B',
  },
  dateIosBtnPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: C.orange,
  },
});
