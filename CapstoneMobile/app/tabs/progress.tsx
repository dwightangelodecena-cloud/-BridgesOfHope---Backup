import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '../../lib/dbMappers';
import { FAMILY_ACTIVE_ADMISSION_STATUSES, admissionStatusLabel, parseAttachedFiles } from '../../lib/admissionWorkflow';
import {
  fetchFamilyAdmissionRequests,
  visibleFamilyAdmissionRequests,
} from '../../lib/familyAdmissionRequests';
import {
  uploadAdmissionDocumentsMobile,
  type PickedAdmissionFile,
} from '../../lib/admissionDocumentUploadMobile';
import { appendFamilyNotificationsIfNewMobile } from '../../lib/familyNotificationsMobile';
import { fetchDischargedPatientIdentity } from '../../lib/dischargedPatientsMobile';
import { subscribeToTableChanges } from '../../lib/realtimeMobile';
import * as DocumentPicker from 'expo-document-picker';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
/** "2026-10-21" → "Tue, Oct 21, 2026"; anything unparseable is returned as-is. */
function formatRequestDate(raw: unknown, withWeekday = true): string {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', {
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "09:00" / "09:00:00" → "9:00 AM"; anything else is returned as-is. */
function formatRequestTime(raw: unknown): string {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  return new Date(2000, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Whole years since a YYYY-MM-DD birthday, or null. */
function ageFromBirthday(raw: unknown): number | null {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const born = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

const REQUEST_AVATAR_PALETTE = [
  { bg: '#FEE2E2', color: '#DC2626' },
  { bg: '#DCFCE7', color: '#16A34A' },
  { bg: '#F3E8FF', color: '#7E22CE' },
  { bg: '#DBEAFE', color: '#1D4ED8' },
] as const;

function genderIcon(gender: string): keyof typeof Ionicons.glyphMap {
  const v = gender.trim().toLowerCase();
  if (v.startsWith('m')) return 'male';
  if (v.startsWith('f')) return 'female';
  return 'male-female-outline';
}

function formatSubmittedAt(value: unknown): string {
  const s = String(value || '');
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} • ${time}`;
}

function admissionStatusColor(status: unknown): string {
  const statusKey = String(status || '').toLowerCase();
  if (statusKey === 'approved' || statusKey === 'accepted') return '#16A34A';
  if (statusKey === 'declined' || statusKey === 'rejected') return '#DC2626';
  if (statusKey === 'in_review') return '#D97706';
  return '#92400E';
}

function describeAdmissionRequest(row: Record<string, unknown>) {
  const formData = (row.form_data || {}) as Record<string, unknown>;
  const files = parseAttachedFiles(row.attached_files);
  const st = admissionStatusLabel(row.status);
  const inReview = String(row.status || '').toLowerCase() === 'in_review';
  const statusColor = admissionStatusColor(row.status);
  const gender = String(formData.patientGender || row.patient_gender || '');
  const reason = String(formData.reasonForAdmission || row.reason_for_admission || '—');
  const birthday = String(formData.patientBirthday || row.patient_birth_date || '—');
  const submittedAt = formatSubmittedAt(row.created_at);
  return { formData, files, st, inReview, statusColor, gender, reason, birthday, submittedAt };
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const [familyUserId, setFamilyUserId] = useState('');
  const [pendingAdmissions, setPendingAdmissions] = useState(0);
  const [pendingDischarges, setPendingDischarges] = useState(0);
  const [submittedAdmissions, setSubmittedAdmissions] = useState<Record<string, unknown>[]>([]);
  const [dischargedNames, setDischargedNames] = useState<Set<string>>(new Set());
  const [uploadingRequestId, setUploadingRequestId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);

  const loadCounts = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setFamilyUserId('');
      setPendingAdmissions(0);
      setPendingDischarges(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setFamilyUserId('');
        setPendingAdmissions(0);
        setPendingDischarges(0);
        setSubmittedAdmissions([]);
        return;
      }
      setFamilyUserId(user.id);
      const [{ data: aRows }, { data: dRows }, admissionRows, discharged] = await Promise.all([
        supabase.from('admission_requests').select('id').eq('family_id', user.id).in('status', [...FAMILY_ACTIVE_ADMISSION_STATUSES]),
        supabase.from('discharge_requests').select('id').eq('family_id', user.id).eq('status', 'pending'),
        fetchFamilyAdmissionRequests(user.id),
        fetchDischargedPatientIdentity(user.id),
      ]);
      const ac = (aRows || []).filter((r) => uiAdmissionRequestFromRow(r as Record<string, unknown>)).length;
      const dc = (dRows || []).filter((r) => uiDischargeRequestFromRow(r as Record<string, unknown>)).length;
      setPendingAdmissions(ac);
      setPendingDischarges(dc);
      setSubmittedAdmissions(admissionRows);
      setDischargedNames(discharged.names);
    } catch {
      setFamilyUserId('');
      setPendingAdmissions(0);
      setPendingDischarges(0);
      setSubmittedAdmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  // Live-refresh while Requests is open — e.g. admin approves/rejects an admission or discharge
  // request elsewhere — instead of only refetching on tab focus.
  useEffect(() => {
    if (!familyUserId) return undefined;
    const unsubAdmission = subscribeToTableChanges(
      `requests-admission-${familyUserId}`,
      'admission_requests',
      `family_id=eq.${familyUserId}`,
      () => void loadCounts()
    );
    const unsubDischarge = subscribeToTableChanges(
      `requests-discharge-${familyUserId}`,
      'discharge_requests',
      `family_id=eq.${familyUserId}`,
      () => void loadCounts()
    );
    return () => {
      unsubAdmission();
      unsubDischarge();
    };
  }, [familyUserId, loadCounts]);

  const visibleSubmitted = visibleFamilyAdmissionRequests(submittedAdmissions, familyUserId).filter(
    (r) => !dischargedNames.has(String((r as Record<string, unknown>).patient_name || '').trim().toLowerCase())
  );

  // Opened from a notification (e.g. "documents needed", "pre-admission summary ready"):
  // open that request's detail sheet once its row has loaded, then drop the param so
  // returning to this tab later doesn't reopen it.
  const { requestId: requestIdParam } = useLocalSearchParams<{ requestId?: string }>();
  const wantedRequestId = String(requestIdParam || '');
  const [openedRequestId, setOpenedRequestId] = useState('');
  if (!wantedRequestId && openedRequestId) setOpenedRequestId('');
  if (wantedRequestId && openedRequestId !== wantedRequestId) {
    const row = submittedAdmissions.find((r) => String(r.id) === wantedRequestId);
    if (row) {
      setOpenedRequestId(wantedRequestId);
      setSelectedRequest(row);
    }
  }
  useEffect(() => {
    if (wantedRequestId && openedRequestId === wantedRequestId) {
      router.setParams({ requestId: undefined } as never);
    }
  }, [wantedRequestId, openedRequestId, router]);

  const uploadSupplementalDocuments = async (requestId: string) => {
    if (!requestId || !familyUserId) return;
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled) return;
    const picked: PickedAdmissionFile[] = (result.assets || []).map((a) => ({
      uri: a.uri,
      name: a.name || 'document',
      mimeType: a.mimeType,
      size: a.size,
    }));
    setUploadingRequestId(requestId);
    try {
      const uploadResult = await uploadAdmissionDocumentsMobile(picked, familyUserId, requestId);
      if (!uploadResult.ok) {
        Alert.alert('Upload failed', uploadResult.errorMessage);
        return;
      }
      const existing = submittedAdmissions.find((r) => String(r.id) === requestId);
      const tagged = uploadResult.files.map((file) => ({ ...file, isSupplemental: true }));
      const merged = [...parseAttachedFiles(existing?.attached_files), ...tagged];
      await supabase.from('admission_requests').update({ attached_files: merged }).eq('id', requestId);
      const rows = await fetchFamilyAdmissionRequests(familyUserId);
      setSubmittedAdmissions(rows);
      setSelectedRequest((prev) => {
        if (!prev || String(prev.id) !== requestId) return prev;
        return rows.find((r) => String(r.id) === requestId) || prev;
      });
      await appendFamilyNotificationsIfNewMobile(
        [{ id: `adm-docs-${requestId}-${Date.now()}`, text: 'Additional documents uploaded for your admission request.' }],
        familyUserId
      );
    } finally {
      setUploadingRequestId('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: '#F8F9FD' }]}>
      <LinearGradient
        colors={['#FFEEE0', '#FDF9F5', '#F8F9FD']}
        locations={[0, 0.4, 1]}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <FamilyMobilePageHeader title="Request Management" onBrandPress={scrollToTop} transparent />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.loadingText}>Loading queue…</Text>
          </View>
        ) : null}

        <View style={styles.hubHeadRow}>
          <Text style={styles.hubHead}>Start a request</Text>
          {pendingAdmissions + pendingDischarges > 0 ? (
            <Text style={styles.hubHeadSub}>{pendingAdmissions + pendingDischarges} pending review</Text>
          ) : null}
        </View>
        <View style={styles.hubList}>
          {[
            {
              key: 'admission',
              title: 'Admission',
              desc: 'Intake form for a new resident',
              image: require('../../assets/images/admission.png'),
              accent: '#F54E25',
              tint: '#FFF1EB',
              pending: pendingAdmissions,
              route: TAB_ROUTES.admission,
            },
            {
              key: 'discharge',
              title: 'Discharge',
              desc: 'Plan pickup and follow-up care',
              image: require('../../assets/images/dismiss.png'),
              accent: '#4338CA',
              tint: '#EEF2FF',
              pending: pendingDischarges,
              route: TAB_ROUTES.discharge,
            },
          ].map((hub, idx) => (
            <Pressable
              key={hub.key}
              style={({ pressed }) => [styles.hubRow, idx > 0 && styles.hubRowDivider, pressed && styles.hubRowPressed]}
              onPress={() => router.navigate(hub.route)}
              accessibilityRole="button"
              accessibilityLabel={`New ${hub.title.toLowerCase()} request. ${hub.pending} pending.`}
            >
              <View style={[styles.hubIcon, { backgroundColor: hub.tint }]}>
                <Image source={hub.image} style={styles.hubIconImage} resizeMode="contain" tintColor={hub.accent} />
              </View>
              <View style={styles.hubText}>
                <Text style={styles.hubTitle} numberOfLines={1}>
                  {hub.title} request
                </Text>
                <Text style={styles.hubDesc} numberOfLines={1}>
                  {hub.desc}
                </Text>
              </View>
              {hub.pending > 0 ? (
                <View style={styles.hubPending}>
                  <Text style={styles.hubPendingTxt}>{hub.pending}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </Pressable>
          ))}
        </View>

        <View style={styles.noteCard}>
          <View style={styles.noteIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color="#F54E25" />
          </View>
          <Text style={styles.noteText}>
            Patient lists and weekly report details live under{' '}
            <Text style={styles.noteTextStrong}>Patient Details</Text> and{' '}
            <Text style={styles.noteTextStrong}>Reports</Text> in the menu bar.
          </Text>
          <View style={styles.noteDecoWrap}>
            <Image
              source={require('../../assets/images/sticky-notes.png')}
              style={styles.noteDecoImage}
              resizeMode="contain"
            />
            <View style={styles.noteDecoBadge}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {visibleSubmitted.length > 0 ? (
          <View style={styles.listCard}>
            <View style={styles.reqListHeaderRow}>
              <View style={styles.reqListHeaderLeft}>
                <Text style={styles.reqListHeaderTitle} numberOfLines={1}>
                  Admission requests
                </Text>
                <Text style={styles.reqListHeaderSub}>
                  {visibleSubmitted.length} submitted · tap a request for details
                </Text>
              </View>
              <Pressable
                style={styles.viewAllRow}
                onPress={() => router.navigate(TAB_ROUTES.patientDetails)}
                accessibilityRole="button"
                accessibilityLabel="View all patient details"
              >
                <Text style={styles.viewAllTxt}>View all</Text>
                <Ionicons name="chevron-forward" size={14} color="#F54E25" />
              </Pressable>
            </View>
            {visibleSubmitted.map((row, idx) => {
              const { formData, files, st, inReview, statusColor, gender } = describeAdmissionRequest(row);
              const statusKey = String(row.status || '').toLowerCase();
              const avatar = REQUEST_AVATAR_PALETTE[idx % REQUEST_AVATAR_PALETTE.length];
              const birthdayRaw = formData.patientBirthday || row.patient_birth_date;
              const age = ageFromBirthday(birthdayRaw);
              return (
                <Pressable
                  key={String(row.id)}
                  style={({ pressed }) => [
                    styles.requestRow,
                    idx < visibleSubmitted.length - 1 && styles.requestRowDivider,
                    pressed && styles.requestRowPressed,
                  ]}
                  onPress={() => setSelectedRequest(row)}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${String(row.patient_name || 'resident')}`}
                >
                  <View style={[styles.requestAvatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.requestAvatarTxt, { color: avatar.color }]}>
                      {deriveInitials(String(row.patient_name || ''))}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.requestTopRow}>
                      <Text style={styles.requestName} numberOfLines={1}>
                        {String(row.patient_name || 'Resident')}
                      </Text>
                      <View
                        style={[styles.statusPill, { backgroundColor: `${statusColor}1A`, borderColor: `${statusColor}33` }]}
                      >
                        <Text style={[styles.statusPillTxt, { color: statusColor }]}>{st}</Text>
                      </View>
                    </View>

                    <Text style={styles.requestSummary} numberOfLines={1}>
                      {[
                        String(formData.reasonForAdmission || row.reason_for_admission || '').trim(),
                        gender,
                        age != null ? `${age} yrs` : formatRequestDate(birthdayRaw, false),
                      ]
                        .filter(Boolean)
                        .join('  ·  ') || 'No details yet'}
                    </Text>

                    {row.meeting_date ? (
                      <View style={styles.meetingChip}>
                        <Text style={styles.meetingChipLabel}>MEETING</Text>
                        <Text style={styles.meetingChipValue} numberOfLines={1}>
                          {formatRequestDate(row.meeting_date)}
                          {row.meeting_time ? ` · ${formatRequestTime(row.meeting_time)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {statusKey === 'processing' && row.meeting_date && !row.meeting_confirmed_by_family ? (
                      <Text style={styles.requestNotice}>Waiting for your confirmation</Text>
                    ) : null}

                    {row.required_document_notes && inReview ? (
                      <View style={styles.requiredBox}>
                        <Text style={styles.requiredLabel}>Required documents</Text>
                        <Text style={styles.requiredTxt}>{String(row.required_document_notes)}</Text>
                      </View>
                    ) : null}
                    {files.length > 0 ? (
                      <Text style={styles.requestFiles} numberOfLines={1}>
                        {files.length === 1 ? '1 file attached' : `${files.length} files attached`}
                      </Text>
                    ) : null}

                    {statusKey === 'processing' ||
                    statusKey === 'awaiting_schedule_review' ||
                    statusKey === 'awaiting_guardian_response' ? (
                      <TouchableOpacity
                        style={styles.rowActionBtn}
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push({
                            pathname: TAB_ROUTES.admissionMeetingRequest,
                            params: { requestId: String(row.id) },
                          } as never)
                        }
                      >
                        <Text style={styles.rowActionTxt}>
                          {statusKey === 'awaiting_guardian_response'
                            ? 'Respond to suggested meeting time'
                            : row.preferred_meeting_date
                              ? 'View / update your meeting request'
                              : 'Request a meeting time'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {inReview && !row.documents_complete ? (
                      <TouchableOpacity
                        style={[styles.rowActionBtn, uploadingRequestId === String(row.id) && { opacity: 0.7 }]}
                        activeOpacity={0.85}
                        onPress={() => void uploadSupplementalDocuments(String(row.id))}
                        disabled={uploadingRequestId === String(row.id)}
                      >
                        <Text style={styles.rowActionTxt}>
                          {uploadingRequestId === String(row.id) ? 'Uploading…' : 'Upload additional documents'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!selectedRequest}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRequest(null)}
      >
        <Pressable style={styles.centerModalBackdrop} onPress={() => setSelectedRequest(null)}>
          <Pressable style={styles.centerModalCard} onPress={() => {}}>
            <View style={styles.centerModalHandle} />
            <View style={styles.centerModalHeader}>
              <View style={styles.centerModalHeaderLeft}>
                <View style={styles.centerModalIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color="#F54E25" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.centerModalTitle} numberOfLines={1}>
                    {String(selectedRequest?.patient_name || 'Resident')}
                  </Text>
                  <Text style={styles.centerModalSubtitle}>Admission request details</Text>
                </View>
              </View>
              <Pressable
                style={styles.centerModalCloseBtn}
                onPress={() => setSelectedRequest(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>
            {!selectedRequest ? null : (() => {
            const { formData, files, st, inReview, statusColor, gender, reason, birthday, submittedAt } =
              describeAdmissionRequest(selectedRequest);
            return (
              <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.statusPill, styles.detailStatusPill, { backgroundColor: `${statusColor}1A`, borderColor: `${statusColor}33` }]}>
                  <Text style={[styles.statusPillTxt, { color: statusColor }]}>{st}</Text>
                </View>

                {selectedRequest.vitals_recorded_at ? (
                  <View
                    style={{
                      backgroundColor: '#FFF7F4',
                      borderWidth: 1,
                      borderColor: '#FFD9CC',
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Ionicons name="pulse-outline" size={16} color="#C2410C" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#9A3412' }}>Medical Assessment</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {[
                        ['Weight', selectedRequest.vitals_weight],
                        ['Height', selectedRequest.vitals_height],
                        ['BP', selectedRequest.vitals_bp],
                        ['PR', selectedRequest.vitals_pr],
                        ['RR', selectedRequest.vitals_rr],
                        ['Temperature', selectedRequest.vitals_temperature],
                        ['BMI', selectedRequest.vitals_bmi],
                        ['SPO2', selectedRequest.vitals_spo2],
                      ].map(([label, val]) => (
                        <View key={String(label)} style={{ minWidth: '22%' }}>
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' }}>{String(label)}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#78350F', marginTop: 2 }}>{String(val || '—')}</Text>
                        </View>
                      ))}
                    </View>
                    {selectedRequest.pre_admission_summary ? (
                      <Text style={{ fontSize: 12.5, color: '#78350F', lineHeight: 18, marginTop: 12 }}>
                        {String(selectedRequest.pre_admission_summary)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {selectedRequest.meeting_date ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Meeting with BOH: </Text>
                      {String(selectedRequest.meeting_date)}
                      {selectedRequest.meeting_time ? ` at ${String(selectedRequest.meeting_time)}` : ''}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color="#64748B" />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Reason: </Text>
                    {reason}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name={genderIcon(gender)} size={16} color="#64748B" />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Gender: </Text>
                    {gender || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Birthday: </Text>
                    {birthday}
                  </Text>
                </View>
                {submittedAt ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#64748B" />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Submitted: </Text>
                      {submittedAt}
                    </Text>
                  </View>
                ) : null}
                {selectedRequest.required_document_notes && inReview ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
                    <Text style={[styles.detailText, { color: '#B45309' }]}>
                      <Text style={[styles.detailLabel, { color: '#B45309' }]}>Required: </Text>
                      {String(selectedRequest.required_document_notes)}
                    </Text>
                  </View>
                ) : null}
                {files.length > 0 ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="attach-outline" size={16} color="#64748B" />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Attached files: </Text>
                      {files.map((f) => f.name).join(', ')}
                    </Text>
                  </View>
                ) : null}
                {inReview && !selectedRequest.documents_complete ? (
                  <TouchableOpacity
                    style={[
                      styles.uploadBtn,
                      styles.detailUploadBtn,
                      uploadingRequestId === String(selectedRequest.id) && { opacity: 0.7 },
                    ]}
                    onPress={() => void uploadSupplementalDocuments(String(selectedRequest.id))}
                    disabled={uploadingRequestId === String(selectedRequest.id)}
                  >
                    <Text style={styles.uploadBtnText}>
                      {uploadingRequestId === String(selectedRequest.id) ? 'Uploading…' : 'Upload additional documents'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <FamilyWebMobileNav active="progress" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    gap: 8,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2559',
  },
  mobileTopBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerNotifyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  notifModalRoot: { flex: 1 },
  notifModalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  notificationsDropdown: {
    position: 'absolute',
    width: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 16,
    elevation: 12,
  },
  notificationsDropdownTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  notificationsDropdownTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  notificationsDropdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  notificationsDropdownText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  notificationDismiss: { fontSize: 18, lineHeight: 18, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 2 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  loadingText: { color: '#64748B', fontWeight: '700' },
  hubHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  hubHead: { fontSize: 16, fontWeight: '900', color: '#1B2559', letterSpacing: -0.2 },
  hubHeadSub: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  hubList: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hubRowDivider: { borderTopWidth: 1, borderTopColor: '#F1F3FA' },
  hubRowPressed: { backgroundColor: '#F8FAFC' },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubIconImage: { width: 22, height: 22 },
  hubText: { flex: 1, minWidth: 0 },
  hubTitle: { fontSize: 15.5, fontWeight: '800', color: '#1B2559' },
  hubDesc: { fontSize: 12.5, color: '#64748B', fontWeight: '600', marginTop: 2 },
  hubPending: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubPendingTxt: { fontSize: 12, fontWeight: '900', color: '#92400E' },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noteIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noteText: { flex: 1, fontSize: 13, color: '#7C4A26', fontWeight: '600', lineHeight: 18 },
  noteTextStrong: { color: '#F54E25', fontWeight: '800' },
  noteDecoWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  noteDecoImage: { width: 40, height: 40 },
  noteDecoBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  reqListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3FA',
  },
  reqListHeaderLeft: { flex: 1, minWidth: 0 },
  reqListHeaderSub: { fontSize: 11.5, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  reqListHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#1B2559', letterSpacing: -0.2 },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  viewAllTxt: { fontSize: 12.5, fontWeight: '800', color: '#F54E25' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  requestRowPressed: { opacity: 0.7 },
  requestRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F3FA' },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  requestAvatarTxt: { fontSize: 13, fontWeight: '800' },
  requestTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1B2559' },
  requestSummary: { fontSize: 12.5, color: '#64748B', fontWeight: '600', marginTop: 3 },
  meetingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F4F7FE',
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  meetingChipLabel: { fontSize: 9.5, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.6 },
  meetingChipValue: { flexShrink: 1, fontSize: 12.5, fontWeight: '800', color: '#1B2559' },
  requestNotice: { fontSize: 11.5, fontWeight: '700', color: '#B45309', marginTop: 6 },
  requiredBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  requiredLabel: { fontSize: 10, fontWeight: '900', color: '#92400E', letterSpacing: 0.4, textTransform: 'uppercase' },
  requiredTxt: { fontSize: 12.5, color: '#78350F', fontWeight: '600', marginTop: 2, lineHeight: 17 },
  requestFiles: { fontSize: 11.5, color: '#94A3B8', fontWeight: '600', marginTop: 8 },
  rowActionBtn: {
    marginTop: 10,
    backgroundColor: '#F54E25',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rowActionTxt: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillTxt: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.2 },
  uploadBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#F54E25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  detailBody: { padding: 18, paddingBottom: 28 },
  detailStatusPill: { alignSelf: 'flex-start', marginBottom: 16, paddingHorizontal: 12, paddingVertical: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  detailText: { flex: 1, fontSize: 13.5, color: '#475569', fontWeight: '500', lineHeight: 19 },
  detailLabel: { fontWeight: '800', color: '#1B2559' },
  detailUploadBtn: { marginTop: 20, alignSelf: 'stretch', alignItems: 'center' },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 16,
  },
  centerModalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginTop: 10,
    marginBottom: 4,
  },
  centerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  centerModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  centerModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  centerModalTitle: { fontSize: 15.5, fontWeight: '800', color: '#1B2559' },
  centerModalSubtitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  centerModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
