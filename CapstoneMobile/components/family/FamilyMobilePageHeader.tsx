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
import { BH } from '../../theme/tokens';

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
          <View style={[styles.notifPanel, { top: insets.top + 46, right: 16 }]}>
            <View style={styles.notifHead}>
              <View style={styles.notifTitleRow}>
                <Ionicons name="notifications" size={16} color={BH.brand} />
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
                    <Ionicons name="checkmark-circle" size={15} color={BH.indigo500} style={{ marginTop: 2 }} />
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
              <KalingaLogoMark size={38} variant="boxed" />
            )}
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.notifyBtn, notif.unreadCount > 0 ? styles.notifyBtnActive : styles.notifyBtnIdle]}
              onPress={notif.toggle}
              accessibilityRole="button"
              accessibilityLabel={
                notif.unreadCount > 0
                  ? `Notifications, ${notif.unreadCount} unread`
                  : 'Notifications'
              }
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="notifications"
                size={17}
                color={notif.unreadCount > 0 ? BH.brandContrast : BH.slate500}
              />
              {notif.unreadCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {notif.unreadCount > 9 ? '9+' : String(notif.unreadCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <View style={styles.avatarWrap}>
              <FamilyHeaderAvatarMobile
                userId={userId}
                initials={initials}
                onPress={onProfile}
                size={34}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              />
              {isHomeBrand ? <View style={styles.avatarStatusDot} /> : null}
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: BH.surface,
    // No hard border — the diffuse shadow alone carries the separation from
    // content below, for a lighter, "floating" feel.
    ...Platform.select({
      ios: {
        shadowColor: BH.slate900,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 14,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 48,
    backgroundColor: BH.surface,
  },
  brandArea: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative' },
  avatarStatusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notifyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  // Unread: strong brand fill + soft colour glow — draws the eye only when
  // there's something to see.
  notifyBtnActive: {
    backgroundColor: BH.brand,
    ...Platform.select({
      ios: {
        shadowColor: BH.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  // Idle: quiet neutral tile — no glow, minimal visual weight.
  notifyBtnIdle: {
    backgroundColor: BH.slate100,
  },
  notifRoot: { flex: 1 },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  notifPanel: {
    position: 'absolute',
    width: Math.min(360, 340),
    maxHeight: 360,
    backgroundColor: BH.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BH.border,
    padding: 18,
    shadowColor: BH.slate900,
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
  notifTitle: { fontSize: 15, fontWeight: '800', color: BH.slate900 },
  clearAll: { fontSize: 12, fontWeight: '700', color: BH.slate400 },
  notifScroll: { maxHeight: 280 },
  notifEmpty: { fontSize: 12, fontWeight: '600', color: BH.slate400 },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  notifText: { flex: 1, fontSize: 13, color: BH.slate700, lineHeight: 18 },
  notifDismiss: { fontSize: 16, color: BH.slate400, paddingHorizontal: 4 },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BH.navy,
    borderWidth: 2,
    borderColor: BH.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: BH.brandContrast,
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
