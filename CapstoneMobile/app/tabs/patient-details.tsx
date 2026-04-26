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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

export default function PatientDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [userInitials, setUserInitials] = useState('FU');
  const [displayName, setDisplayName] = useState('Family User');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UIPatient | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPatients([]);
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });
      if (error) {
        console.warn('[patient-details]', error.message);
        setPatients([]);
        return;
      }
      setPatients(
        (data || [])
          .map((r) => uiPatientFromRow(r as unknown as PatientRow))
          .filter((x): x is UIPatient => x != null)
      );
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user;
        let resolved =
          (u?.user_metadata?.full_name as string | undefined)?.trim() ||
          [u?.user_metadata?.first_name, u?.user_metadata?.last_name].filter(Boolean).join(' ').trim() ||
          'Family User';
        if (u?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', u.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) resolved = profileRow.full_name.trim();
        }
        if (mounted) {
          setDisplayName(resolved);
          setUserInitials(deriveInitials(resolved));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const first = (displayName || 'Family User').trim().split(/\s+/)[0];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#F8F9FD' }]}>
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.notifRoot}>
          <Pressable style={styles.notifBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={[styles.notifPanel, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notifTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notifTitle}>Notifications</Text>
            </View>
            {NOTIFICATION_ITEMS.map((t) => (
              <View key={t} style={styles.notifRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notifText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color="#1B2559" />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          Patient Details
        </Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => setShowNotifications((v) => !v)}>
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.navigate(TAB_ROUTES.profile)}>
            <Text style={styles.avatarTxt}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.welcome}>Welcome Back, {first}</Text>
        <Text style={styles.sub}>Patients currently linked to your family account.</Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.loadingTxt}>Loading patients…</Text>
          </View>
        ) : patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              {isSupabaseConfigured()
                ? 'No active patients found. After an admission is approved, patient records appear here.'
                : 'Configure Supabase to load patient records.'}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.navigate(TAB_ROUTES.admission)}>
              <Text style={styles.primaryBtnTxt}>Admission request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          patients.map((p) => (
            <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelected(p)} activeOpacity={0.9}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={22} color="#A3AED0" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta}>Admitted {p.date || '—'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#A3AED0" />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Recovery progress</Text>
                <Text style={styles.progressPct}>{p.progress}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${p.progress}%` }]} />
              </View>
              <Text style={styles.statusLine}>Clinical status: {p.status || '—'}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailOverlay}>
          <Pressable style={styles.detailBackdrop} onPress={() => setSelected(null)} />
          <View style={[styles.detailSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selected?.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.detailRow}>
                <Text style={styles.detailK}>Admission: </Text>
                {selected?.date || '—'}
              </Text>
              <Text style={styles.detailRow}>
                <Text style={styles.detailK}>Progress: </Text>
                {selected?.progress ?? 0}%
              </Text>
              <Text style={styles.detailRow}>
                <Text style={styles.detailK}>Status: </Text>
                {selected?.status || '—'}
              </Text>
              <Text style={styles.detailRow}>
                <Text style={styles.detailK}>Primary concern: </Text>
                {selected?.reason || '—'}
              </Text>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => {
                  const id = selected?.id;
                  const name = selected?.name;
                  setSelected(null);
                  if (id) {
                    router.push({
                      pathname: TAB_ROUTES.weeklyReport,
                      params: { patientId: id, patientName: name || '' },
                    } as never);
                  }
                }}
              >
                <Text style={styles.linkBtnTxt}>Open weekly report activity</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FamilyWebMobileNav active="none" />
      <FamilyFloatingChat />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    gap: 8,
  },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#F54E25', textAlign: 'center' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  notifRoot: { flex: 1 },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  notifPanel: {
    position: 'absolute',
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
    elevation: 10,
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  notifTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  notifRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  notifText: { flex: 1, fontSize: 13, color: '#334155' },
  scroll: { paddingHorizontal: 18, paddingTop: 14 },
  welcome: { fontSize: 20, fontWeight: '800', color: '#1B2559' },
  sub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 6, marginBottom: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  loadingTxt: { color: '#64748B', fontWeight: '700' },
  emptyCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  emptyTxt: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#F54E25',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F7FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  name: { fontSize: 17, fontWeight: '800', color: '#1B2559' },
  meta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  progressPct: { fontSize: 12, fontWeight: '800', color: '#1B2559' },
  track: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#4318FF', borderRadius: 8 },
  statusLine: { marginTop: 10, fontSize: 12, color: '#475569', fontWeight: '600' },
  detailOverlay: { flex: 1, justifyContent: 'flex-end' },
  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#1B2559', flex: 1, marginRight: 12 },
  detailRow: { fontSize: 14, color: '#334155', marginBottom: 10, lineHeight: 22 },
  detailK: { fontWeight: '800', color: '#1B2559' },
  linkBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFF1EB', borderRadius: 12 },
  linkBtnTxt: { color: '#C2410C', fontWeight: '800', fontSize: 14 },
});
