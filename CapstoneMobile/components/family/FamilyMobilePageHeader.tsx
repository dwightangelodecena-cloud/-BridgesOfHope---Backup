import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { KalingaLogoMark } from './KalingaLogoMark';
import { FamilyHeaderBrand, FamilyPageTitleBrand } from './FamilyHeaderBrand';
import { FamilyHeaderAvatarMobile } from './FamilyHeaderAvatarMobile';
import { NotificationsPanel, getNotifVisual } from './NotificationsPanel';
import { NotificationDetailSheet } from './NotificationDetailSheet';
import { NotificationAnnouncementModal } from './NotificationAnnouncementModal';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useFamilyNotificationsInbox, type InboxItem } from '../../lib/useFamilyNotificationsInbox';
import { isAnnouncementNotification, notificationTarget, type NotificationTarget } from '../../lib/notificationRouting';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { relativeTime } from '../../lib/notificationVisuals';
import { BH } from '../../theme/tokens';

const NOTIF_PANEL_WIDTH = Math.min(Dimensions.get('window').width - 32, 360);

type Props = {
  /** Page title — inner pages use unified title brand (no subtitle on mobile). */
  title?: string;
  /** @deprecated Subtitles are not shown on mobile; use in-page hero copy instead. */
  subtitle?: string;
  /** Home dashboard: full Kalinga brand. Other pages: pass `title`. */
  showLogo?: boolean;
  /** Scroll main page content to top (tap brand / title area). */
  onBrandPress?: () => void;
  /** Renders with a transparent background — for screens placing the header over a hero image. */
  transparent?: boolean;
};

/**
 * Unified family mobile header — home brand or page title brand, always with accent line.
 */
export function FamilyMobilePageHeader({
  title,
  showLogo = true,
  onBrandPress,
  transparent = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { userId, initials } = useFamilyUserMobile();
  const notif = useFamilyNotificationsInbox(userId);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  /** Tapped dropdown item without a destination screen — shown in the detail sheet. */
  const [notifDetailItem, setNotifDetailItem] = useState<InboxItem | null>(null);
  /** Tapped announcement — shown as the live announcement popup. */
  const [notifAnnouncementItem, setNotifAnnouncementItem] = useState<InboxItem | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const onProfile = () => {
    // Avoid re-navigating to Profile when it's already the active screen —
    // expo-router would dispatch an unhandled `POP_TO_TOP` action.
    if (pathname === TAB_ROUTES.profile) return;
    router.navigate(TAB_ROUTES.profile as never);
  };
  const isHomeBrand = showLogo && !title;

  const visibleNotifItems = notif.items.filter((i) => !dismissedIds.has(i.id)).slice(0, 6);

  const dismissItem = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const clearAllNotifs = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const item of notif.items) next.add(item.id);
      return next;
    });
    for (const item of notif.items) void notif.markRead(item);
  };

  const openFullNotifications = () => {
    setNotifDropdownOpen(false);
    setNotifOpen(true);
  };

  const goToTarget = (target: NotificationTarget) => {
    setNotifDetailItem(null);
    router.push({ pathname: target.pathname, params: target.params ?? {} } as never);
  };

  /**
   * Tap a dropdown row: announcements open the live popup, notifications about a screen go
   * straight there, and anything else opens its detail sheet.
   */
  const openNotification = (item: InboxItem) => {
    void notif.markRead(item);
    setNotifDropdownOpen(false);
    if (isAnnouncementNotification(item)) {
      setNotifAnnouncementItem(item);
      return;
    }
    const target = notificationTarget(item);
    if (target) {
      goToTarget(target);
      return;
    }
    setNotifDetailItem(item);
  };

  const closeFullNotifications = () => setNotifOpen(false);

  return (
    <>
      <Modal
        visible={notifDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifDropdownOpen(false)}
      >
        <View style={styles.notifRoot}>
          <Pressable style={styles.notifBackdrop} onPress={() => setNotifDropdownOpen(false)} />
          <View style={[styles.notifPanel, { top: insets.top + 46, right: 16 }]}>
            <View style={styles.notifHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.notifTitle}>Notifications</Text>
                <View style={styles.notifSubRow}>
                  {notif.unreadCount > 0 ? <View style={styles.notifSubDot} /> : null}
                  <Text style={styles.notifSub}>
                    {notif.unreadCount > 0 ? `${notif.unreadCount} unread` : "You're all caught up"}
                  </Text>
                </View>
              </View>
              {visibleNotifItems.length > 0 ? (
                <TouchableOpacity
                  onPress={clearAllNotifs}
                  style={styles.clearAllBtn}
                  accessibilityRole="button"
                  hitSlop={6}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearAll}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {visibleNotifItems.length === 0 ? (
              <View style={styles.notifEmptyWrap}>
                <Text style={styles.notifEmptyTitle}>No new notifications</Text>
                <Text style={styles.notifEmpty}>Updates about admissions and visits will show up here.</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.notifScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {visibleNotifItems.map((item, idx) => {
                  const cfg = getNotifVisual(item);
                  const hasTarget = notificationTarget(item) != null;
                  const showSnippet = Boolean(item.body) && item.body !== item.title;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openNotification(item)}
                      style={({ pressed }) => [
                        styles.notifRow,
                        idx > 0 && styles.notifRowDivider,
                        !item.isRead && styles.notifRowUnread,
                        pressed && styles.notifRowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.body}`}
                      accessibilityHint={hasTarget ? 'Opens the related page' : 'Opens the notification'}
                    >
                      <View style={styles.notifRowTop}>
                        {!item.isRead ? <View style={[styles.notifUnreadDot, { backgroundColor: cfg.accent }]} /> : null}
                        <Text style={[styles.notifRowTitle, !item.isRead && styles.notifRowTitleUnread]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.notifRowTime}>{relativeTime(item.createdAt)}</Text>
                        <TouchableOpacity
                          onPress={() => dismissItem(item.id)}
                          accessibilityRole="button"
                          accessibilityLabel="Remove notification"
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                          style={styles.notifDismissBtn}
                        >
                          <Ionicons name="close" size={14} color={BH.slate400} />
                        </TouchableOpacity>
                      </View>
                      {showSnippet ? (
                        <Text style={styles.notifRowSnippet} numberOfLines={2}>
                          {item.body}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={openFullNotifications}
              style={styles.notifShowMore}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={styles.notifShowMoreTxt}>See all notifications</Text>
              <Ionicons name="arrow-forward" size={14} color={BH.brand} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={notifOpen}
        animationType="slide"
        onRequestClose={closeFullNotifications}
      >
        <NotificationsPanel userId={userId} onClose={closeFullNotifications} />
      </Modal>

      <NotificationDetailSheet
        item={notifDetailItem}
        onClose={() => setNotifDetailItem(null)}
        onNavigate={goToTarget}
      />
      {notifAnnouncementItem ? (
        <NotificationAnnouncementModal
          key={notifAnnouncementItem.id}
          userId={userId}
          item={notifAnnouncementItem}
          onClose={() => setNotifAnnouncementItem(null)}
        />
      ) : null}

      <View style={[styles.headerShell, transparent && styles.headerShellTransparent]}>
        <View style={[styles.bar, transparent && styles.barTransparent, { paddingTop: Math.max(insets.top, 8) }]}>
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
              style={[styles.notifyBtn, notif.unreadCount > 0 && styles.notifyBtnActiveShadow]}
              onPress={() => {
                setNotifDropdownOpen((prev) => {
                  if (prev) return false;
                  void notif.reload();
                  return true;
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={
                notif.unreadCount > 0
                  ? `Notifications, ${notif.unreadCount} unread`
                  : 'Notifications'
              }
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {notif.unreadCount > 0 ? (
                <LinearGradient
                  colors={['#FF8A3D', '#F5761E', '#F54E25', '#EA3E12']}
                  locations={[0, 0.3, 0.65, 1]}
                  start={{ x: 0.37, y: 0.02 }}
                  end={{ x: 0.63, y: 0.98 }}
                  style={styles.notifyBtnFill}
                >
                  <Ionicons name="notifications" size={17} color={BH.brandContrast} />
                </LinearGradient>
              ) : (
                <View style={[styles.notifyBtnFill, styles.notifyBtnIdle]}>
                  <Ionicons name="notifications" size={17} color={BH.slate500} />
                </View>
              )}
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
  headerShellTransparent: {
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
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
  barTransparent: { backgroundColor: 'transparent' },
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
  notifyBtnFill: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unread: soft colour glow on the outer tile — draws the eye only when
  // there's something to see. The gradient fill itself lives in notifyBtnFill.
  notifyBtnActiveShadow: {
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
  notifRoot: { flex: 1 },
  notifBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  notifPanel: {
    position: 'absolute',
    width: NOTIF_PANEL_WIDTH,
    maxHeight: 460,
    backgroundColor: BH.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BH.border,
    overflow: 'hidden',
    shadowColor: BH.slate900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  notifHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BH.slate100,
  },
  notifTitle: { fontSize: 16, fontWeight: '900', color: BH.textStrong, letterSpacing: -0.2 },
  notifSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  notifSubDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BH.brand },
  notifSub: { fontSize: 11.5, fontWeight: '600', color: BH.textMuted },
  clearAllBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BH.slate100,
  },
  clearAll: { fontSize: 11.5, fontWeight: '800', color: BH.slate600 },
  notifEmptyWrap: { paddingHorizontal: 16, paddingVertical: 22, alignItems: 'center' },
  notifEmptyTitle: { fontSize: 14, fontWeight: '800', color: BH.textStrong },
  notifEmpty: { fontSize: 12, color: BH.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  notifScroll: { maxHeight: 340 },
  notifRow: { paddingHorizontal: 16, paddingVertical: 12 },
  notifRowDivider: { borderTopWidth: 1, borderTopColor: BH.slate100 },
  notifRowUnread: { backgroundColor: '#FFFBF8' },
  notifRowPressed: { backgroundColor: BH.slate50 },
  notifRowTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  notifRowTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: BH.slate600 },
  notifRowTitleUnread: { fontWeight: '800', color: BH.textStrong },
  notifRowTime: { fontSize: 11, fontWeight: '600', color: BH.textSubtle },
  notifDismissBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  notifRowSnippet: { fontSize: 12.5, color: BH.textMuted, lineHeight: 17, marginTop: 3 },
  notifShowMore: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: BH.slate100,
    backgroundColor: BH.surface2,
  },
  notifShowMoreTxt: { fontSize: 13, fontWeight: '800', color: BH.brand },
});
