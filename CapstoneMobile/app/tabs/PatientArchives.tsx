import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const AVATAR_PALETTE = [
  { bg: '#E0E7FF', color: '#4338CA' },
  { bg: '#FFE4D6', color: '#C2410C' },
  { bg: '#F3E8FF', color: '#7E22CE' },
  { bg: '#DCFCE7', color: '#15803D' },
] as const;

// Same title treatment as the shared FamilyMobilePageHeader (FamilyHeaderBrand): orange
// gradient text on web, flat brand orange on native — keeps this page's header on-theme
// with Home/Reports/etc. even though it needs its own back-button layout.
const webGradientTitleStyle =
  Platform.OS === 'web'
    ? ({
        backgroundImage: 'linear-gradient(165deg, #FF8A3D 0%, #F5761E 30%, #F54E25 65%, #EA3E12 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      } as const)
    : null;

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
        <TouchableOpacity onPress={goBack} style={styles.headerBack} hitSlop={12} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={19} color={C.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, webGradientTitleStyle]} numberOfLines={1}>Patient Archives</Text>
          <View style={styles.headerSubRow}>
            <Ionicons name="archive" size={9} color={C.orange} />
            <Text style={styles.headerSub} numberOfLines={1}>Archived Records</Text>
          </View>
        </View>
        <LinearGradient
          colors={['#FF8A5C', '#F54E25']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBadge}
        >
          <Ionicons name="archive" size={18} color="#FFFFFF" />
          {!loading ? (
            <View style={styles.headerBadgeCount}>
              <Text style={styles.headerBadgeCountTxt}>{residents.length}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="information-circle" size={18} color={C.orange} />
          </View>
          <Text style={styles.infoText}>
            Discharged residents are kept here for reference. Their weekly reports are still available to view.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
        ) : residents.length === 0 ? (
          <View style={styles.panel}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="archive-outline" size={26} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No archived residents</Text>
            <Text style={styles.emptyBody}>Residents appear here once they&apos;ve been discharged.</Text>
          </View>
        ) : (
          residents.map((p, idx) => {
            const avatar = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
            const statusLine = [p.status, p.concern].filter(Boolean).join(' · ');
            return (
              <LinearGradient
                key={p.id}
                colors={['#FFFFFF', '#FFF3EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.avatarTxt, { color: avatar.color }]}>{initials(p.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <View style={styles.dischargedBadge}>
                      <Ionicons name="exit-outline" size={12} color="#9A3412" />
                      <Text style={styles.dischargedBadgeTxt}>Discharged {formatDate(p.dischargedAt)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRows}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                    <Text style={styles.metaRowText}>
                      Admitted <Text style={styles.metaRowStrong}>{formatDate(p.admittedAt)}</Text>
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="bed-outline" size={14} color="#94A3B8" />
                    <Text style={styles.metaRowText}>
                      Room <Text style={styles.metaRowStrong}>{p.room || '—'}</Text>
                    </Text>
                  </View>
                  {statusLine ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="pulse-outline" size={14} color="#94A3B8" />
                      <Text style={styles.metaRowText} numberOfLines={1}>
                        Final status <Text style={styles.metaRowStrong}>{statusLine}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.reportsBtn}
                  activeOpacity={0.88}
                  onPress={() =>
                    router.push({ pathname: TAB_ROUTES.weeklyReport, params: { patientId: p.id, patientName: p.name } } as never)
                  }
                >
                  <Ionicons name="document-text-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.reportsBtnTxt}>View weekly reports</Text>
                  <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            );
          })
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
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      },
      android: { elevation: 3 },
    }),
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F0851F', letterSpacing: -0.4 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  headerSub: { fontSize: 10.5, fontWeight: '700', color: '#334155', letterSpacing: 0.4, textTransform: 'uppercase' },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  headerBadgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.navy,
    borderWidth: 2,
    borderColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeCountTxt: { fontSize: 9.5, fontWeight: '900', color: '#FFFFFF' },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7F4',
    borderWidth: 1,
    borderColor: '#FFE1D3',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  infoText: { flex: 1, fontSize: 12.5, color: '#7C4A32', lineHeight: 18, fontWeight: '600' },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(233,237,247,0.85)',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: C.muted, lineHeight: 19, textAlign: 'center' },
  card: {
    borderRadius: 18,
    borderLeftWidth: 4,
    borderLeftColor: C.orange,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 2 },
    }),
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarTxt: { fontSize: 14, fontWeight: '900' },
  name: { fontSize: 15.5, fontWeight: '800', color: C.navy },
  dischargedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  dischargedBadgeTxt: { fontSize: 10.5, fontWeight: '800', color: '#9A3412' },
  metaRows: {
    gap: 8,
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRowText: { flex: 1, fontSize: 12.5, color: '#64748B', fontWeight: '600' },
  metaRowStrong: { color: C.navy, fontWeight: '800' },
  reportsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.orange,
    borderRadius: 12,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  reportsBtnTxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});
