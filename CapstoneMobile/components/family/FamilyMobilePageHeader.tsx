import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KalingaLogoMark } from './KalingaLogoMark';
import { FamilyHeaderBrand, FamilyPageTitleBrand } from './FamilyHeaderBrand';
import { FamilyHeaderAvatarMobile } from './FamilyHeaderAvatarMobile';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useFamilyNotificationsMobile } from '../../lib/useFamilyNotificationsMobileHook';
import { TAB_ROUTES } from '../../lib/navigationConfig';

type Props = {
  /** Page title — inner pages use unified title brand (no subtitle on mobile). */
  title?: string;
  /** @deprecated Subtitles are not shown on mobile; use in-page hero copy instead. */
  subtitle?: string;
  /** Home dashboard: full Kalinga brand. Other pages: pass `title`. */
  showLogo?: boolean;
  /** Scroll main page content to top (tap brand / title area). */
  onBrandPress?: () => void;
};

/**
 * Unified family mobile header — home brand or page title brand, always with accent line.
 */
export function FamilyMobilePageHeader({
  title,
  showLogo = true,
  onBrandPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, initials } = useFamilyUserMobile();
  const notif = useFamilyNotificationsMobile(userId);

  const onProfile = () => router.navigate(TAB_ROUTES.profile as never);
  const isHomeBrand = showLogo && !title;

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

      <View style={styles.headerShell}>
        <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
          <TouchableOpacity
            style={styles.brandArea}
            onPress={onBrandPress}
            disabled={!onBrandPress}
            activeOpacity={onBrandPress ? 0.82 : 1}
            accessibilityRole={onBrandPress ? 'button' : undefined}
            accessibilityLabel={onBrandPress ? 'Scroll to top' : undefined}
          >
            {isHomeBrand ? (
              <FamilyHeaderBrand />
            ) : title ? (
              <FamilyPageTitleBrand title={title} />
            ) : (
              <KalingaLogoMark size={44} variant="boxed" />
            )}
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.notifyBtn}
              onPress={notif.toggle}
              accessibilityRole="button"
              accessibilityLabel={
                notif.unreadCount > 0
                  ? `Notifications, ${notif.unreadCount} unread`
                  : 'Notifications'
              }
              activeOpacity={0.88}
            >
              <Ionicons name="notifications" size={18} color="#FFFFFF" />
              {notif.unreadCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {notif.unreadCount > 9 ? '9+' : String(notif.unreadCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <FamilyHeaderAvatarMobile userId={userId} initials={initials} onPress={onProfile} size={36} />
          </View>
        </View>
        <View style={styles.themeAccent} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
  },
  brandArea: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
    justifyContent: 'center',
  },
  themeAccent: {
    height: 2,
    backgroundColor: 'rgba(245, 78, 37, 0.45)',
    marginHorizontal: 20,
    marginBottom: -1,
    borderRadius: 2,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
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
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1B2559',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' },
      default: {},
    }),
  },
});
