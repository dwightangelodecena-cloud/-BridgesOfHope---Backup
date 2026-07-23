import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KalingaLogoMark } from './KalingaLogoMark';
import { FamilyHeaderBrand, FamilyPageTitleBrand } from './FamilyHeaderBrand';
import { FamilyHeaderAvatarMobile } from './FamilyHeaderAvatarMobile';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useFamilyNotificationsInbox } from '../../lib/useFamilyNotificationsInbox';
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
  const notif = useFamilyNotificationsInbox(userId);

  const onProfile = () => router.navigate(TAB_ROUTES.profile as never);
  const openNotifications = () => router.navigate(TAB_ROUTES.notifications as never);
  const isHomeBrand = showLogo && !title;

  return (
    <>
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
              onPress={openNotifications}
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
            <FamilyHeaderAvatarMobile
              userId={userId}
              initials={initials}
              onPress={onProfile}
              size={34}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            />
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
