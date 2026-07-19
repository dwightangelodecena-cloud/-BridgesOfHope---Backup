import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
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
      <FamilyMobilePageHeader title="Request Management" onBrandPress={scrollToTop} />

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
          style={[styles.hubCard, styles.hubCardFirst]}
          onPress={() => router.navigate(TAB_ROUTES.admission)}
          activeOpacity={0.9}
        >
          <View style={[styles.hubIcon, { backgroundColor: '#F54E25' }]}>
            <Ionicons name="clipboard" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.hubTextCol}>
            <Text style={styles.hubTitle}>Admission request</Text>
            <Text style={styles.hubDesc}>Full intake form with address and patient details.</Text>
            <View style={styles.hubBadge}>
              <Text style={styles.hubBadgeText}>{pendingAdmissions} pending</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#A3AED0" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hubCard}
          onPress={() => router.navigate(TAB_ROUTES.discharge)}
          activeOpacity={0.9}
        >
          <View style={[styles.hubIcon, { backgroundColor: '#2B31ED' }]}>
            <Ionicons name="log-out-outline" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.hubTextCol}>
            <Text style={styles.hubTitle}>Discharge request</Text>
            <Text style={styles.hubDesc}>Plan pickup, escort, medications, and follow-up care.</Text>
            <View style={[styles.hubBadge, { backgroundColor: '#EEF2FF' }]}>
              <Text style={[styles.hubBadgeText, { color: '#3730A3' }]}>{pendingDischarges} pending</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#A3AED0" />
        </TouchableOpacity>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={20} color="#3758D5" />
          <Text style={styles.noteText}>
            Patient lists and weekly report details live under Patient Details and Reports in the menu bar.
          </Text>
        </View>

        {visibleSubmitted.length > 0 ? (
          <View style={[styles.noteCard, { backgroundColor: '#FFFFFF', borderColor: '#E9EDF7', flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={styles.sectionTitle}>Submitted Admission Requests</Text>
            {visibleSubmitted.map((row) => {
              const formData = (row.form_data || {}) as Record<string, unknown>;
              const files = parseAttachedFiles(row.attached_files);
              const st = admissionStatusLabel(row.status);
              const inReview = String(row.status || '').toLowerCase() === 'in_review';
              const statusKey = String(row.status || '').toLowerCase();
              const statusColor =
                statusKey === 'approved' || statusKey === 'accepted'
                  ? '#16A34A'
                  : statusKey === 'declined' || statusKey === 'rejected'
                    ? '#DC2626'
                    : statusKey === 'in_review'
                      ? '#D97706'
                      : '#92400E';
              return (
                <View key={String(row.id)} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestName} numberOfLines={1}>{String(row.patient_name || 'Resident')}</Text>
                    <View style={[styles.hubBadge, { backgroundColor: `${statusColor}22` }]}>
                      <Text style={[styles.hubBadgeText, { color: statusColor }]}>{st}</Text>
                    </View>
                  </View>
                  {row.meeting_date ? (
                    <Text style={styles.requestMeta}>
                      Meeting with BOH: {String(row.meeting_date)}
                      {row.meeting_time ? ` at ${String(row.meeting_time)}` : ''}
                    </Text>
                  ) : null}
                  {row.required_document_notes && inReview ? (
                    <Text style={[styles.requestMeta, { color: '#B45309' }]}>
                      Required: {String(row.required_document_notes)}
                    </Text>
                  ) : null}
                  <Text style={styles.requestMeta}>
                    Reason: {String(formData.reasonForAdmission || row.reason_for_admission || '—')}
                  </Text>
                  <Text style={styles.requestMeta}>
                    Gender: {String(formData.patientGender || row.patient_gender || '—')}
                  </Text>
                  <Text style={styles.requestMeta}>
                    Birthday: {String(formData.patientBirthday || row.patient_birth_date || '—')}
                  </Text>
                  {files.length > 0 ? (
                    <Text style={styles.requestMeta}>Attached files: {files.map((f) => f.name).join(', ')}</Text>
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
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <FamilyWebMobileNav active="progress" />
      <FamilyFloatingChat />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  hubTextCol: { flex: 1, minWidth: 0 },
  hubTitle: { fontSize: 17, fontWeight: '800', color: '#1B2559' },
  hubDesc: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4, lineHeight: 18 },
  hubBadge: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  hubBadgeText: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#DCE7FF',
  },
  noteText: { flex: 1, fontSize: 13, color: '#3758D5', fontWeight: '600', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1B2559', marginBottom: 10 },
  requestCard: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  requestName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1B2559' },
  requestMeta: { fontSize: 12, color: '#475569', lineHeight: 18, marginBottom: 2 },
  uploadBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#F54E25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
