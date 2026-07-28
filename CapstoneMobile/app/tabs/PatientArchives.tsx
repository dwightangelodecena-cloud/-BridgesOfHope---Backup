import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const C = {
  orange: '#F54E25',
  navy: '#1A2B4A',
  muted: '#64748B',
  border: '#E2E8F0',
};

type ArchivedPatient = {
  id: string;
  name: string;
  admittedAt: string;
  dischargedAt: string;
  status: string;
  concern: string;
  room: string;
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PatientArchives() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<ArchivedPatient[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setResidents([]);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setResidents([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, admitted_at, discharged_at, clinical_status, primary_concern, room_code')
      .eq('family_id', user.id)
      .not('discharged_at', 'is', null)
      .order('discharged_at', { ascending: false });
    setResidents(
      (data || []).map((r) => ({
        id: String(r.id),
        name: String(r.full_name || 'Resident'),
        admittedAt: String(r.admitted_at || ''),
        dischargedAt: String(r.discharged_at || ''),
        status: String(r.clinical_status || ''),
        concern: String(r.primary_concern || ''),
        room: String(r.room_code || ''),
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate(TAB_ROUTES.patientDetails as never));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Archives</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.subtitle}>
          Discharged residents are kept here for reference. Their weekly reports are still available to view.
        </Text>

        {loading ? (
          <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
        ) : residents.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.emptyTitle}>No archived residents</Text>
            <Text style={styles.emptyBody}>Residents appear here once they&apos;ve been discharged.</Text>
          </View>
        ) : (
          residents.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{initials(p.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.dischargedBadge}>
                    <Ionicons name="exit-outline" size={12} color="#9A3412" />
                    <Text style={styles.dischargedBadgeTxt}>Discharged {formatDate(p.dischargedAt)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Admitted</Text>
                  <Text style={styles.metaValue}>{formatDate(p.admittedAt)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Room</Text>
                  <Text style={styles.metaValue}>{p.room || '—'}</Text>
                </View>
                <View style={[styles.metaItem, { flexBasis: '100%' }]}>
                  <Text style={styles.metaLabel}>Final status / concern</Text>
                  <Text style={styles.metaValue}>{[p.status, p.concern].filter(Boolean).join(' · ') || '—'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.reportsBtn}
                onPress={() =>
                  router.push({ pathname: TAB_ROUTES.weeklyReport, params: { patientId: p.id, patientName: p.name } } as never)
                }
              >
                <Ionicons name="document-text-outline" size={15} color={C.orange} />
                <Text style={styles.reportsBtnTxt}>View weekly reports</Text>
                <Ionicons name="chevron-forward" size={15} color={C.orange} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBack: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  subtitle: { fontSize: 12.5, color: C.muted, lineHeight: 18, marginBottom: 14 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(233,237,247,0.85)',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: C.muted, lineHeight: 19 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    padding: 16,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarTxt: { fontSize: 13, fontWeight: '800', color: C.navy },
  name: { fontSize: 15, fontWeight: '800', color: C.navy },
  dischargedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  dischargedBadgeTxt: { fontSize: 10.5, fontWeight: '800', color: '#9A3412' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metaItem: { flexBasis: '45%' },
  metaLabel: { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { fontSize: 13, fontWeight: '700', color: C.navy, marginTop: 2 },
  reportsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF7F4',
    borderWidth: 1,
    borderColor: '#FFD9CC',
    borderRadius: 12,
    paddingVertical: 11,
  },
  reportsBtnTxt: { fontSize: 13, fontWeight: '800', color: C.orange },
});
