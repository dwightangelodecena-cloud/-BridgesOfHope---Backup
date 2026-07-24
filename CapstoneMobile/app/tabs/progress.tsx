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
import { useRouter } from 'expo-router';
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
import * as DocumentPicker from 'expo-document-picker';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
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
      const [{ data: aRows }, { data: dRows }, admissionRows] = await Promise.all([
        supabase.from('admission_requests').select('id').eq('family_id', user.id).in('status', [...FAMILY_ACTIVE_ADMISSION_STATUSES]),
        supabase.from('discharge_requests').select('id').eq('family_id', user.id).eq('status', 'pending'),
        fetchFamilyAdmissionRequests(user.id),
      ]);
      const ac = (aRows || []).filter((r) => uiAdmissionRequestFromRow(r as Record<string, unknown>)).length;
      const dc = (dRows || []).filter((r) => uiDischargeRequestFromRow(r as Record<string, unknown>)).length;
      setPendingAdmissions(ac);
      setPendingDischarges(dc);
      setSubmittedAdmissions(admissionRows);
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

  const visibleSubmitted = visibleFamilyAdmissionRequests(submittedAdmissions, familyUserId);

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

        <TouchableOpacity
          style={[styles.hubCard, styles.hubCardFirst, { borderLeftWidth: 4, borderLeftColor: '#F54E25' }]}
          onPress={() => router.navigate(TAB_ROUTES.admission)}
          activeOpacity={0.9}
        >
          <View style={[styles.hubIcon, { backgroundColor: '#F54E25' }]}>
            <Image
              source={require('../../assets/images/admission.png')}
              style={styles.hubIconImage}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>
          <View style={styles.hubTextCol}>
            <Text style={styles.hubTitle}>Admission Request</Text>
            <Text style={styles.hubDesc}>Full intake form with address and patient details.</Text>
            <View style={styles.hubBadge}>
              <Ionicons name="time-outline" size={12} color="#92400E" />
              <Text style={styles.hubBadgeText}>{pendingAdmissions} pending</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#A3AED0" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hubCard, { borderLeftWidth: 4, borderLeftColor: '#2B31ED' }]}
          onPress={() => router.navigate(TAB_ROUTES.discharge)}
          activeOpacity={0.9}
        >
          <View style={[styles.hubIcon, { backgroundColor: '#2B31ED' }]}>
            <Image
              source={require('../../assets/images/dismiss.png')}
              style={styles.hubIconImage}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>
          <View style={styles.hubTextCol}>
            <Text style={styles.hubTitle}>Discharge Request</Text>
            <Text style={styles.hubDesc}>Plan pickup, escort, medications, and follow-up care.</Text>
            <View style={[styles.hubBadge, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="time-outline" size={12} color="#3730A3" />
              <Text style={[styles.hubBadgeText, { color: '#3730A3' }]}>{pendingDischarges} pending</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#A3AED0" />
        </TouchableOpacity>

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
                <View style={styles.reqListHeaderIconWrap}>
                  <Ionicons name="clipboard" size={16} color="#4F46E5" />
                </View>
                <Text style={styles.reqListHeaderTitle}>Submitted Admission Requests</Text>
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
              const avatar = REQUEST_AVATAR_PALETTE[idx % REQUEST_AVATAR_PALETTE.length];
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
                    <Text style={styles.requestName} numberOfLines={1}>
                      {String(row.patient_name || 'Resident')}
                    </Text>
                    {row.meeting_date ? (
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="calendar-outline" size={15} color="#64748B" />
                        <Text style={styles.requestMeta} numberOfLines={1}>
                          <Text style={styles.requestMetaLabel}>Meeting with BOH: </Text>
                          {String(row.meeting_date)}
                          {row.meeting_time ? ` at ${String(row.meeting_time)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.requestMetaRow}>
                      <Ionicons name="document-text-outline" size={15} color="#64748B" />
                      <Text style={styles.requestMeta} numberOfLines={1}>
                        <Text style={styles.requestMetaLabel}>Reason: </Text>
                        {String(formData.reasonForAdmission || row.reason_for_admission || '—')}
                      </Text>
                    </View>
                    <View style={styles.requestMetaRow}>
                      <Ionicons name={genderIcon(gender)} size={15} color="#64748B" />
                      <Text style={styles.requestMeta} numberOfLines={1}>
                        <Text style={styles.requestMetaLabel}>Gender: </Text>
                        {gender || '—'}
                      </Text>
                    </View>
                    <View style={styles.requestMetaRow}>
                      <Ionicons name="calendar-outline" size={15} color="#64748B" />
                      <Text style={styles.requestMeta} numberOfLines={1}>
                        <Text style={styles.requestMetaLabel}>Birthday: </Text>
                        {String(formData.patientBirthday || row.patient_birth_date || '—')}
                      </Text>
                    </View>
                    {row.required_document_notes && inReview ? (
                      <Text style={[styles.requestMeta, { color: '#B45309', marginTop: 3 }]}>
                        Required: {String(row.required_document_notes)}
                      </Text>
                    ) : null}
                    {files.length > 0 ? (
                      <Text style={styles.requestMeta} numberOfLines={1}>
                        Attached files: {files.map((f) => f.name).join(', ')}
                      </Text>
                    ) : null}
                    {inReview && !row.documents_complete ? (
                      <TouchableOpacity
                        style={[styles.uploadBtn, uploadingRequestId === String(row.id) && { opacity: 0.7 }]}
                        onPress={() => void uploadSupplementalDocuments(String(row.id))}
                        disabled={uploadingRequestId === String(row.id)}
                      >
                        <Text style={styles.uploadBtnText}>
                          {uploadingRequestId === String(row.id) ? 'Uploading…' : 'Upload additional documents'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}1A`, borderColor: `${statusColor}33` }]}>
                    <Text style={[styles.statusPillTxt, { color: statusColor }]}>{st}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
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
  notifModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
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
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  hubCardFirst: { marginTop: 0 },
  hubIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubIconImage: { width: 26, height: 26 },
  hubTextCol: { flex: 1, minWidth: 0 },
  hubTitle: { fontSize: 17, fontWeight: '800', color: '#1B2559' },
  hubDesc: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4, lineHeight: 18 },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hubBadgeText: { fontSize: 11, fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.3 },
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
    marginBottom: 4,
  },
  reqListHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  reqListHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reqListHeaderTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1B2559' },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  viewAllTxt: { fontSize: 12.5, fontWeight: '800', color: '#F54E25' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  requestRowPressed: { opacity: 0.7 },
  requestRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F3FA' },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  requestAvatarTxt: { fontSize: 12, fontWeight: '800' },
  requestName: { fontSize: 14, fontWeight: '800', color: '#1B2559' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  requestMeta: { fontSize: 12, color: '#64748B', fontWeight: '500', lineHeight: 16 },
  requestMetaLabel: { fontWeight: '700', color: '#334155' },
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
