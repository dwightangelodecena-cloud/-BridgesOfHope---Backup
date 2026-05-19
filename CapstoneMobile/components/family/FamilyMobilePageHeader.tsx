import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KalingaLogoMark } from './KalingaLogoMark';
import { FamilyHeaderAvatarMobile } from './FamilyHeaderAvatarMobile';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useFamilyNotificationsMobile } from '../../lib/useFamilyNotificationsMobileHook';
import { TAB_ROUTES } from '../../lib/navigationConfig';

type Props = {
  /** Page title (web desktop header). On mobile, shown when `showLogo` is false. */
  title?: string;
  subtitle?: string;
  /** Default true — Kalinga logo on the left like web mobile top bar. */
  showLogo?: boolean;
};

/**
 * Unified family header for Capstone Mobile — matches web FamilyPageHeader behavior.
 */
export function FamilyMobilePageHeader({ title, subtitle, showLogo = true }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, initials } = useFamilyUserMobile();
  const notif = useFamilyNotificationsMobile(userId);

  const onProfile = () => router.navigate(TAB_ROUTES.profile as never);

  return (
    <>
      <Modal
        visible={notif.open}
        transparent
        animationType="fade"
        onRequestClose={notif.close}
      >
        <View style={styles.notifRoot}>
          <Pressable style={styles.notifBackdrop} onPress={notif.close} />
          <View style={[styles.notifPanel, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notifHead}>
              <View style={styles.notifTitleRow}>
                <Ionicons name="notifications" size={16} color="#F54E25" />
                <Text style={styles.notifTitle}>Notifications</Text>
              </View>
              {notif.items.length > 0 ? (
                <TouchableOpacity onPress={() => void notif.clearAll()} accessibilityRole="button">
                  <Text style={styles.clearAll}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {notif.items.length === 0 ? (
              <Text style={styles.notifEmpty}>No notifications.</Text>
            ) : (
              <ScrollView style={styles.notifScroll} keyboardShouldPersistTaps="handled">
                {notif.items.map((item, idx) => (
                  <View key={item.id || `n-${idx}`} style={styles.notifRow}>
                    <Ionicons name="checkmark-circle" size={15} color="#6366F1" style={{ marginTop: 2 }} />
                    <Text style={styles.notifText}>{notif.notificationDisplayText(item)}</Text>
                    <TouchableOpacity
                      onPress={() => notif.removeItem(item, idx)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove notification"
                    >
                      <Text style={styles.notifDismiss}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
        {showLogo && !title ? (
          <KalingaLogoMark size={44} />
        ) : (
          <View style={styles.titleBlock}>
            {title ? <Text style={styles.title}>{title}</Text> : <KalingaLogoMark size={40} />}
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.notifyBtn}
            onPress={notif.toggle}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <FamilyHeaderAvatarMobile userId={userId} initials={initials} onPress={onProfile} size={36} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  titleBlock: { flex: 1, minWidth: 0, paddingRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#F54E25' },
  subtitle: { fontSize: 13, fontWeight: '500', color: '#64748B', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifRoot: { flex: 1 },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  notifPanel: {
    position: 'absolute',
    width: Math.min(360, 340),
    maxHeight: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  notifHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  clearAll: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  notifScroll: { maxHeight: 280 },
  notifEmpty: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  notifText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  notifDismiss: { fontSize: 16, color: '#94A3B8', paddingHorizontal: 4 },
});
