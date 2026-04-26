import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appendActivityFeed } from '../../lib/activityFeed';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;

type PatientOpt = { id: string; name: string };

const REASON_CATEGORIES = [
  'Treatment program completed',
  'Medical recommendation',
  'Family request',
  'Other',
] as const;

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
  const [preferredDate, setPreferredDate] = useState(() => formatIsoDate(new Date()));
  const [pickupAuthorized, setPickupAuthorized] = useState('');
  const [followUpPhone, setFollowUpPhone] = useState('');
  const [escortName, setEscortName] = useState('');
  const [escortRelation, setEscortRelation] = useState('');
  const [escortContact, setEscortContact] = useState('');
  const [destinationAfterDischarge, setDestinationAfterDischarge] = useState('');
  const [followUpClinic, setFollowUpClinic] = useState('');
  const [medicationPlan, setMedicationPlan] = useState('');
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

  const validate = () => {
    const next: Record<string, string> = {};
    if (!selectedPatientId) next.selectedPatientId = 'Please select a patient.';
    if (!reasonCategory) next.reasonCategory = 'Please select a reason.';
    if (reasonCategory === 'Other' && !reasonCategoryOther.trim()) {
      next.reasonCategoryOther = 'Please specify the other reason.';
    }
    if (!reasonDetails.trim() || reasonDetails.trim().length < 15) {
      next.reasonDetails = 'Reason details must be at least 15 characters.';
    }
    if (!escortName.trim()) next.escortName = 'Authorized escort name is required.';
    if (!escortContact.trim()) next.escortContact = 'Escort contact number is required.';
    if (!destinationAfterDischarge.trim()) {
      next.destinationAfterDischarge = 'Discharge destination is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const canSubmit = useMemo(() => {
    if (!selectedPatientId || !reasonCategory || !escortName.trim() || !escortContact.trim()) return false;
    if (!destinationAfterDischarge.trim()) return false;
    if (!reasonDetails.trim() || reasonDetails.trim().length < 15) return false;
    if (reasonCategory === 'Other' && !reasonCategoryOther.trim()) return false;
    return true;
  }, [
    selectedPatientId,
    reasonCategory,
    reasonCategoryOther,
    reasonDetails,
    escortName,
    escortContact,
    destinationAfterDischarge,
  ]);

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
        reasonCategory === 'Other' && reasonCategoryOther?.trim()
          ? `Other Reason Category: ${reasonCategoryOther.trim()}`
          : '',
        otherInfo?.trim() ? `Additional Notes: ${otherInfo.trim()}` : '',
        escortName?.trim() ? `Authorized Escort: ${escortName.trim()}` : '',
        escortRelation?.trim() ? `Escort Relationship: ${escortRelation.trim()}` : '',
        escortContact?.trim() ? `Escort Contact: ${escortContact.trim()}` : '',
        destinationAfterDischarge?.trim() ? `Discharge Destination: ${destinationAfterDischarge.trim()}` : '',
        followUpClinic?.trim() ? `Follow-up Clinic/Doctor: ${followUpClinic.trim()}` : '',
        medicationPlan?.trim() ? `Medication Plan: ${medicationPlan.trim()}` : '',
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
        `Discharge request submitted for ${selectedPatient.name}. Awaiting admin review.`,
        { familyId: user.id }
      );

      Alert.alert('Success', 'Discharge request submitted and sent to the admin queue.');
      setSelectedPatientId('');
      setReasonCategory('');
      setReasonCategoryOther('');
      setReasonDetails('');
      setPreferredDate(formatIsoDate(new Date()));
      setPickupAuthorized('');
      setFollowUpPhone('');
      setEscortName('');
      setEscortRelation('');
      setEscortContact('');
      setDestinationAfterDischarge('');
      setFollowUpClinic('');
      setMedicationPlan('');
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

  const displayPreferred = preferredDate || formatIsoDate(new Date());

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.navigate(TAB_ROUTES.progress)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discharge</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.formTitle}>Discharge Request Form</Text>
          <Text style={styles.formSubtitle}>Submit discharge endorsement and follow-up details.</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Select Patient *</Text>
            <TouchableOpacity
              style={[styles.inputContainer, errors.selectedPatientId ? styles.inputError : null]}
              onPress={() => setPatientModalVisible(true)}
            >
              <Ionicons name="person-outline" size={20} color="#AAA" style={styles.icon} />
              <Text style={[styles.pickerText, !selectedPatient && { color: '#AAA' }]}>
                {selectedPatient ? selectedPatient.name : 'Select admitted patient'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
            {errors.selectedPatientId ? <Text style={styles.errorSmall}>{errors.selectedPatientId}</Text> : null}
          </View>

          {!patients.length ? (
            <Text style={styles.emptyPatients}>No admitted patients available for discharge request.</Text>
          ) : null}

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Reason Category *</Text>
            <TouchableOpacity
              style={[styles.inputContainer, errors.reasonCategory ? styles.inputError : null]}
              onPress={() => setReasonModalVisible(true)}
            >
              <Ionicons name="list-outline" size={20} color="#AAA" style={styles.icon} />
              <Text style={[styles.pickerText, !reasonCategory && { color: '#AAA' }]}>
                {reasonCategory || 'Select reason'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
            {errors.reasonCategory ? <Text style={styles.errorSmall}>{errors.reasonCategory}</Text> : null}
          </View>

          {reasonCategory === 'Other' ? (
            <InputField
              label="Specify Other Reason *"
              placeholder="Type reason"
              icon="create-outline"
              value={reasonCategoryOther}
              onChangeText={(t) => {
                setReasonCategoryOther(t);
                clearFieldError('reasonCategoryOther');
              }}
            />
          ) : null}
          {errors.reasonCategoryOther ? <Text style={styles.errorSmall}>{errors.reasonCategoryOther}</Text> : null}

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Preferred Discharge Date</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={openPreferredDatePicker}>
              <Ionicons name="calendar-outline" size={20} color="#AAA" style={styles.icon} />
              <Text style={[styles.pickerText, !preferredDate && { color: '#AAA' }]}>{displayPreferred}</Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <InputField
            label="Authorized Pickup"
            placeholder="Name or role authorized for pickup"
            icon="people-outline"
            value={pickupAuthorized}
            onChangeText={setPickupAuthorized}
          />

          <InputField
            label="Follow-up Phone"
            placeholder="Contact for follow-up"
            icon="call-outline"
            keyboardType="phone-pad"
            value={followUpPhone}
            onChangeText={setFollowUpPhone}
          />

          <InputField
            label="Authorized Escort Name *"
            placeholder="Who will accompany the patient?"
            icon="people-outline"
            value={escortName}
            onChangeText={(t) => {
              setEscortName(t);
              clearFieldError('escortName');
            }}
            error={errors.escortName}
          />

          <InputField
            label="Escort Relationship"
            placeholder="Ex. Mother, Brother, Spouse"
            icon="person-outline"
            value={escortRelation}
            onChangeText={setEscortRelation}
          />

          <InputField
            label="Escort Contact Number *"
            placeholder="Contact number"
            icon="call-outline"
            keyboardType="phone-pad"
            value={escortContact}
            onChangeText={(t) => {
              setEscortContact(t);
              clearFieldError('escortContact');
            }}
            error={errors.escortContact}
          />

          <InputField
            label="Destination After Discharge *"
            placeholder="Home address or receiving facility"
            icon="location-outline"
            value={destinationAfterDischarge}
            onChangeText={(t) => {
              setDestinationAfterDischarge(t);
              clearFieldError('destinationAfterDischarge');
            }}
            error={errors.destinationAfterDischarge}
          />

          <InputField
            label="Follow-up Clinic / Doctor"
            placeholder="Clinic or physician for follow-up"
            icon="business-outline"
            value={followUpClinic}
            onChangeText={setFollowUpClinic}
          />

          <InputField
            label="Medication Plan (Summary)"
            placeholder="List medications, dosage, and reminders"
            icon="medkit-outline"
            value={medicationPlan}
            onChangeText={setMedicationPlan}
          />

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Belongings Checklist</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <Ionicons name="briefcase-outline" size={20} color="#AAA" style={[styles.icon, { marginTop: 15 }]} />
              <TextInput
                placeholder="List released belongings, documents, and medications."
                placeholderTextColor="#AAA"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={belongingsChecklist}
                onChangeText={setBelongingsChecklist}
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Reason Details *</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer, errors.reasonDetails ? styles.inputError : null]}>
              <Ionicons name="document-text-outline" size={20} color="#AAA" style={[styles.icon, { marginTop: 15 }]} />
              <TextInput
                placeholder="At least 15 characters describing the discharge context."
                placeholderTextColor="#AAA"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                value={reasonDetails}
                onChangeText={(t) => {
                  setReasonDetails(t);
                  clearFieldError('reasonDetails');
                }}
              />
            </View>
            {errors.reasonDetails ? <Text style={styles.errorSmall}>{errors.reasonDetails}</Text> : null}
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Other Information</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#AAA" style={[styles.icon, { marginTop: 15 }]} />
              <TextInput
                placeholder="Any other notes for the care team"
                placeholderTextColor="#AAA"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={otherInfo}
                onChangeText={setOtherInfo}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || !canSubmit) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={reasonModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setReasonModalVisible(false)} activeOpacity={1}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select reason</Text>
            {REASON_CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.optionItem}
                onPress={() => {
                  setReasonCategory(item);
                  if (item !== 'Other') setReasonCategoryOther('');
                  clearFieldError('reasonCategory');
                  setReasonModalVisible(false);
                }}
              >
                <Text style={styles.optionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={patientModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPatientModalVisible(false)} activeOpacity={1}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select patient</Text>
            {patients.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.optionItem}
                onPress={() => {
                  setSelectedPatientId(p.id);
                  clearFieldError('selectedPatientId');
                  setPatientModalVisible(false);
                }}
              >
                <Text style={styles.optionText}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
          <Pressable style={styles.modalOverlayLight} onPress={() => setPrefDateModal(false)} />
          <View style={[styles.dateIosSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.dateIosHeader}>
              <TouchableOpacity onPress={() => setPrefDateModal(false)}>
                <Text style={styles.dateIosBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.dateIosTitle}>Preferred date</Text>
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

function InputField({
  label,
  placeholder,
  icon,
  keyboardType = 'default',
  value,
  onChangeText,
  error,
}: {
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <Ionicons name={icon} size={20} color="#AAA" style={styles.icon} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#AAA"
          style={styles.input}
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
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
  flexContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF7',
  },
  backButton: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F54E25',
  },
  scrollContent: {
    paddingHorizontal: isCompactScreen ? 14 : 18,
    paddingBottom: 40,
    paddingTop: 14,
  },
  formTitle: {
    fontSize: isCompactScreen ? 22 : 24,
    fontWeight: '800',
    color: '#1B2559',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  emptyPatients: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: isCompactScreen ? 12 : 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    minHeight: isCompactScreen ? 50 : 56,
    paddingHorizontal: isCompactScreen ? 12 : 15,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  textAreaContainer: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: isCompactScreen ? 13 : 14,
    color: '#000',
  },
  textArea: {
    paddingTop: 15,
    textAlignVertical: 'top',
  },
  pickerText: {
    fontSize: 14,
    color: '#0F172A',
    flex: 1,
  },
  errorSmall: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  optionItem: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
  submitButton: {
    backgroundColor: '#F54E25',
    height: isCompactScreen ? 52 : 56,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
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
    color: '#F54E25',
  },
});
