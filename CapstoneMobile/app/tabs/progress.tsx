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
import {
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '../../lib/dbMappers';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [pendingAdmissions, setPendingAdmissions] = useState(0);
  const [pendingDischarges, setPendingDischarges] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    if (!isSupabaseConfigured()) {
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
        setPendingAdmissions(0);
        setPendingDischarges(0);
        return;
      }
      const [{ data: aRows }, { data: dRows }] = await Promise.all([
        supabase.from('admission_requests').select('id').eq('family_id', user.id).eq('status', 'pending'),
        supabase.from('discharge_requests').select('id').eq('family_id', user.id).eq('status', 'pending'),
      ]);
      const ac = (aRows || []).filter((r) => uiAdmissionRequestFromRow(r as Record<string, unknown>)).length;
      const dc = (dRows || []).filter((r) => uiDischargeRequestFromRow(r as Record<string, unknown>)).length;
      setPendingAdmissions(ac);
      setPendingDischarges(dc);
    } catch {
      setPendingAdmissions(0);
      setPendingDischarges(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

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
        /* ignore */
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const first = (displayName || 'Family User').trim().split(/\s+/)[0];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#F8F9FD' }]}>
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

      <View style={styles.mobileTopBar}>
        <KalingaLogoMark size={40} />
        <Text style={styles.topTitle}>Request Management</Text>
        <View style={styles.mobileTopBarRight}>
          <TouchableOpacity
            style={styles.headerNotifyBtn}
            onPress={() => setShowNotifications((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAvatar}
            onPress={() => router.navigate(TAB_ROUTES.profile)}
            accessibilityLabel="Profile"
          >
            <Text style={styles.headerAvatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.welcomeLine} numberOfLines={1}>
          Welcome Back, {first}
        </Text>
        <Text style={styles.sub}>
          Submit admission requests, request discharge, and track pending items—same tools as the family web portal.
        </Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.loadingText}>Loading queue…</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.hubCard}
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
  scrollContent: { paddingHorizontal: 18, paddingTop: 16 },
  welcomeLine: { fontSize: 22, fontWeight: '800', color: '#1B2559' },
  sub: { fontSize: 14, color: '#64748B', fontWeight: '600', marginTop: 8, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  loadingText: { color: '#64748B', fontWeight: '700' },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
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
});
