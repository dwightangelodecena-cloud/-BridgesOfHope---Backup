import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFamilyNotificationsInbox, type InboxItem } from '../../lib/useFamilyNotificationsInbox';
import { isAnnouncementNotification, type NotificationTarget } from '../../lib/notificationRouting';
import {
  NOTIF_GROUPS,
  dateGroupLabel,
  getNotifVisual,
  notifGroup,
  relativeTime,
} from '../../lib/notificationVisuals';
import { useActiveAnnouncements } from '../../lib/useActiveAnnouncements';
import { NotificationDetailSheet } from './NotificationDetailSheet';
import { NotificationAnnouncementModal } from './NotificationAnnouncementModal';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

// Kept for existing importers (header dropdown).
export { getNotifVisual, type NotifVisual } from '../../lib/notificationVisuals';

const SECTION_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];

type NotificationsPanelProps = {
  userId: string;
  onClose: () => void;
};

export function NotificationsPanel({ userId, onClose }: NotificationsPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inbox = useFamilyNotificationsInbox(userId);
  const { all: activeAnnouncements } = useActiveAnnouncements(userId);
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);
  const [announcementItem, setAnnouncementItem] = useState<InboxItem | null>(null);

  useEffect(() => {
    void inbox.markAllLegacyRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announcementImageById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activeAnnouncements) if (a.imageUrl) map.set(a.id, a.imageUrl);
    return map;
  }, [activeAnnouncements]);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of inbox.items) {
      const g = notifGroup(item);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'All', count: inbox.items.length },
      { key: 'unread', label: 'Unread', count: inbox.unreadCount },
      ...NOTIF_GROUPS.filter((g) => counts.has(g.key)).map((g) => ({ ...g, count: counts.get(g.key) ?? 0 })),
    ];
  }, [inbox.items, inbox.unreadCount]);

  const filtered = useMemo(() => {
    if (filter === 'all') return inbox.items;
    if (filter === 'unread') return inbox.items.filter((i) => !i.isRead);
    return inbox.items.filter((i) => notifGroup(i) === filter);
  }, [inbox.items, filter]);

  const sections = useMemo(() => {
    const bySection = new Map<string, InboxItem[]>();
    for (const item of filtered) {
      const label = dateGroupLabel(item.createdAt);
      if (!bySection.has(label)) bySection.set(label, []);
      bySection.get(label)!.push(item);
    }
    return SECTION_ORDER.filter((s) => bySection.has(s)).map((s) => ({ title: s, items: bySection.get(s)! }));
  }, [filtered]);

  const openItem = (item: InboxItem) => {
    void inbox.markRead(item);
    if (isAnnouncementNotification(item)) setAnnouncementItem(item);
    else setDetailItem(item);
  };

  const navigateTo = (target: NotificationTarget) => {
    setDetailItem(null);
    onClose();
    router.push({ pathname: target.pathname, params: target.params ?? {} } as never);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await inbox.reload();
    setRefreshing(false);
  };

  const activeChip = chips.find((c) => c.key === filter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBack} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="arrow-back" size={20} color={BH.textStrong} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Notifications
          </Text>
          <View style={styles.headerSubRow}>
            {inbox.unreadCount > 0 ? <View style={styles.headerSubDot} /> : null}
            <Text style={styles.headerSub} numberOfLines={1}>
              {inbox.unreadCount > 0 ? `${inbox.unreadCount} unread` : "You're all caught up"}
            </Text>
          </View>
        </View>
        {inbox.unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => void inbox.markAllRead()}
            style={styles.markAllBtn}
            hitSlop={8}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
          >
            <Ionicons name="checkmark-done" size={15} color={BH.brand700} />
            <Text style={styles.markAllTxt} numberOfLines={1}>
              Mark all read
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {inbox.items.length > 0 ? (
        <View style={styles.chipsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {chips.map((chip) => {
              const active = chip.key === filter;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setFilter(chip.key)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{chip.label}</Text>
                  {chip.count > 0 ? (
                    <View style={[styles.chipCount, active && styles.chipCountActive]}>
                      <Text style={[styles.chipCountTxt, active && styles.chipCountTxtActive]}>{chip.count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {inbox.loading ? (
        <ActivityIndicator color={BH.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BH.brand} colors={[BH.brand]} />}
        >
          {sections.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={filter === 'unread' ? 'checkmark-done-circle-outline' : 'notifications-off-outline'}
                  size={34}
                  color={BH.slate400}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'unread'
                  ? "You're all caught up"
                  : filter === 'all'
                    ? 'No notifications yet'
                    : `No ${activeChip?.label.toLowerCase() ?? ''} notifications`}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'all'
                  ? 'Updates about admissions, visits and your resident will appear here.'
                  : 'Try another filter to see the rest of your notifications.'}
              </Text>
              {filter !== 'all' ? (
                <Pressable onPress={() => setFilter('all')} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnTxt}>Show all</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCard}>
                  {section.items.map((item, idx) => {
                    const cfg = getNotifVisual(item);
                    const thumb = item.relatedId ? announcementImageById.get(item.relatedId) : undefined;
                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.row,
                          idx > 0 && styles.rowDivider,
                          !item.isRead && styles.rowUnread,
                          pressed && styles.rowPressed,
                        ]}
                        onPress={() => openItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.body}`}
                      >
                        {thumb ? <Image source={{ uri: thumb }} style={styles.rowThumb} /> : null}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.rowTop}>
                            {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: cfg.accent }]} /> : null}
                            <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
                          </View>
                          {item.body && item.body !== item.title ? (
                            <Text style={styles.rowSnippet} numberOfLines={2}>
                              {item.body}
                            </Text>
                          ) : null}
                          <Text style={[styles.rowPill, { color: cfg.color, backgroundColor: cfg.bg }]}>{cfg.label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <NotificationDetailSheet item={detailItem} onClose={() => setDetailItem(null)} onNavigate={navigateTo} />
      {announcementItem ? (
        <NotificationAnnouncementModal
          key={announcementItem.id}
          userId={userId}
          item={announcementItem}
          onClose={() => setAnnouncementItem(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BH.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: BH.surface,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BH.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: BH.textStrong, letterSpacing: -0.2 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  headerSubDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BH.brand },
  headerSub: { fontSize: 12, fontWeight: '600', color: BH.textMuted },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: BH.brandSurface,
    borderWidth: 1,
    borderColor: BH.brandSurfaceBorder,
    flexShrink: 0,
  },
  markAllTxt: { fontSize: 12, fontWeight: '800', color: BH.brand700 },
  chipsBar: { backgroundColor: BH.surface, borderBottomWidth: 1, borderBottomColor: BH.border },
  chipsContent: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: BH.slate100,
  },
  chipActive: { backgroundColor: BH.textStrong },
  chipTxt: { fontSize: 12.5, fontWeight: '700', color: BH.slate600 },
  chipTxtActive: { color: '#FFFFFF' },
  chipCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: BH.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  chipCountTxt: { fontSize: 10.5, fontWeight: '800', color: BH.slate600 },
  chipCountTxtActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 14, paddingTop: 6 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: BH.textSubtle,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: BH.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BH.border,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: BH.slate100 },
  rowUnread: { backgroundColor: '#FFFBF8' },
  rowPressed: { backgroundColor: BH.slate50 },
  rowThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: BH.brandSurface },
  unreadDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: BH.slate600 },
  rowTitleUnread: { fontWeight: '800', color: BH.textStrong },
  rowTime: { fontSize: 11, fontWeight: '600', color: BH.textSubtle },
  rowSnippet: { fontSize: 13, color: BH.textMuted, marginTop: 3, lineHeight: 18 },
  rowPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BH.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: BH.textStrong, textAlign: 'center' },
  emptySub: { fontSize: 13, color: BH.textMuted, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: BH.brandSurface,
  },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: BH.brand700 },
});
