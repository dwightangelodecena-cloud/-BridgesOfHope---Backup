import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Modal, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { useFamilyNotificationsInbox, type InboxItem } from '../../lib/useFamilyNotificationsInbox';
import { fetchAnnouncementById, type DbAnnouncement } from '../../lib/announcementsDb';
import { AnnouncementCardView } from './AnnouncementCard';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DETAIL_CARD_WIDTH = SCREEN_WIDTH - 32;

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type NotifVisual = { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; accent: string; label: string };

/** Primary lookup: the notification's own `category` column. Covers every new send path. */
const CATEGORY_CFG: Record<string, NotifVisual> = {
  admission: { icon: 'document-text', bg: BH.brandSurface, color: BH.brand700, accent: BH.brand, label: 'Admission' },
  visitation: { icon: 'calendar', bg: BH.indigoTint, color: BH.indigo, accent: BH.indigo500, label: 'Visitation' },
  promo: { icon: 'megaphone', bg: '#FCE7F3', color: '#BE185D', accent: '#EC4899', label: 'Promo' },
  clinical: { icon: 'medkit', bg: '#CCFBF1', color: '#0F766E', accent: '#14B8A6', label: 'Clinical' },
  progress: { icon: 'trending-up', bg: BH.infoBg, color: BH.info, accent: '#3B82F6', label: 'Progress' },
  discharge: { icon: 'exit-outline', bg: '#FFE4D6', color: '#9A3412', accent: '#F0851F', label: 'Discharge' },
};
const RELATED_CFG: Record<string, NotifVisual> = {
  admission_request: CATEGORY_CFG.admission,
  visitation_request: CATEGORY_CFG.visitation,
  discharge_pickup: CATEGORY_CFG.discharge,
};
const DEFAULT_CFG: NotifVisual = { icon: 'notifications-outline', bg: BH.slate100, color: BH.slate500, accent: BH.slate400, label: 'General' };

/** Category-first lookup; falls back to the old title/related-type heuristics for rows without a meaningful category. */
export function getNotifVisual(item: InboxItem): NotifVisual {
  if (item.category && CATEGORY_CFG[item.category]) {
    return CATEGORY_CFG[item.category];
  }
  const t = item.title.toLowerCase();
  if (t.includes('approved') || t.includes('confirmed')) {
    return { icon: 'checkmark-circle', bg: BH.successBg, color: BH.successText, accent: BH.success, label: 'Approved' };
  }
  if (t.includes('rejected') || t.includes('declined')) {
    return { icon: 'close-circle', bg: BH.dangerBg, color: BH.danger, accent: BH.dangerStrong, label: 'Declined' };
  }
  if (t.includes('documents needed') || t.includes('required')) {
    return { icon: 'alert-circle', bg: BH.warningBg, color: BH.warning, accent: '#F59E0B', label: 'Action needed' };
  }
  if (t.includes('rescheduled')) {
    return { icon: 'time', bg: BH.indigoTint, color: BH.indigo, accent: BH.indigo500, label: 'Rescheduled' };
  }
  return RELATED_CFG[item.relatedType || ''] || DEFAULT_CFG;
}

type NotificationsPanelProps = {
  userId: string;
  onClose: () => void;
};

export function NotificationsPanel({ userId, onClose }: NotificationsPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inbox = useFamilyNotificationsInbox(userId);
  const [openItem, setOpenItem] = useState<InboxItem | null>(null);
  const [announcementDetail, setAnnouncementDetail] = useState<DbAnnouncement | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const isAnnouncement = openItem?.relatedType === 'announcement';

  useEffect(() => {
    void inbox.markAllLegacyRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tapping a promo notification linked to a still-active announcement shows the real premium
  // card (image + pill + caption) instead of the plain title/body text. If the announcement has
  // since expired or been removed, RLS returns nothing and the plain text view is used instead.
  useEffect(() => {
    if (!openItem || openItem.relatedType !== 'announcement' || !openItem.relatedId) {
      setAnnouncementDetail(null);
      setAnnouncementLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAnnouncementLoading(true);
    fetchAnnouncementById(openItem.relatedId).then((row) => {
      if (cancelled) return;
      setAnnouncementDetail(row);
      setAnnouncementLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [openItem]);

  const openDetail = (item: InboxItem) => {
    setOpenItem(item);
    void inbox.markRead(item);
  };

  const goToRelated = (item: InboxItem) => {
    setOpenItem(null);
    onClose();
    if (item.relatedType === 'visitation_request' || item.relatedType === 'discharge_pickup') {
      router.navigate(TAB_ROUTES.appointments as never);
    } else if (item.relatedType === 'admission_request') {
      router.push({
        pathname: TAB_ROUTES.admissionMeetingRequest,
        params: item.relatedId ? { requestId: item.relatedId } : {},
      } as never);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBack} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="arrow-back" size={20} color={BH.textStrong} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {inbox.loading ? (
        <ActivityIndicator color={BH.brand} style={{ marginTop: 40 }} />
      ) : inbox.items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="mail-open-outline" size={40} color={BH.slate300} />
          <Text style={styles.emptyTxt}>No notifications yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {inbox.items.map((item) => {
            const cfg = getNotifVisual(item);
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.card,
                  !item.isRead && styles.cardUnread,
                  { borderLeftColor: !item.isRead ? cfg.accent : BH.border },
                  pressed && styles.rowPressed,
                ]}
                onPress={() => openDetail(item)}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.categoryPill, { color: cfg.color, backgroundColor: cfg.bg }]}>
                      {cfg.label.toUpperCase()}
                    </Text>
                    {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: cfg.accent }]} /> : null}
                  </View>
                  <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSender}>Bridges of Hope · {relativeTime(item.createdAt)}</Text>
                  <Text style={styles.rowSnippet} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={BH.slate300} style={{ marginTop: 2 }} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={Boolean(openItem)} transparent animationType="fade" onRequestClose={() => setOpenItem(null)}>
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setOpenItem(null)} />
          {isAnnouncement ? (
            <View style={[styles.detailCard, styles.detailCardMedia, { marginBottom: insets.bottom + 24 }]}>
              <Pressable style={styles.detailCloseFloating} onPress={() => setOpenItem(null)} hitSlop={10}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
              {announcementLoading ? (
                <ActivityIndicator color={BH.brand} style={{ marginVertical: 48 }} />
              ) : announcementDetail ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <AnnouncementCardView
                    title={announcementDetail.title}
                    caption={announcementDetail.caption}
                    imageUrl={announcementDetail.imageUrl}
                    cardWidth={DETAIL_CARD_WIDTH}
                  />
                  <View style={{ height: 22 }} />
                </ScrollView>
              ) : (
                <View style={{ padding: 20 }}>
                  <Text style={styles.detailTitle}>{openItem?.title}</Text>
                  <Text style={[styles.detailBody, { marginTop: 8 }]}>{openItem?.body}</Text>
                </View>
              )}
            </View>
          ) : (
          <View style={[styles.detailCard, { marginBottom: insets.bottom + 24 }]}>
            <View style={styles.detailHead}>
              <View style={[styles.detailAvatar, { backgroundColor: openItem ? getNotifVisual(openItem).accent : BH.brand }]}>
                <Ionicons name={openItem ? getNotifVisual(openItem).icon : 'business'} size={16} color={BH.brandContrast} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {openItem ? (
                  <Text style={[styles.categoryPill, styles.detailCategoryPill, { color: getNotifVisual(openItem).color, backgroundColor: getNotifVisual(openItem).bg }]}>
                    {getNotifVisual(openItem).label.toUpperCase()}
                  </Text>
                ) : null}
                <Text style={styles.detailTitle}>{openItem?.title}</Text>
                <Text style={styles.detailFrom}>
                  From Bridges of Hope{openItem ? ` · ${relativeTime(openItem.createdAt)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpenItem(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={BH.slate500} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailBody}>{openItem?.body}</Text>
            </ScrollView>
            {openItem?.relatedType ? (
              <Pressable style={styles.detailActionBtn} onPress={() => openItem && goToRelated(openItem)}>
                <Text style={styles.detailActionTxt}>
                  {openItem.relatedType === 'visitation_request' || openItem.relatedType === 'discharge_pickup'
                    ? 'View appointment'
                    : 'View admission request'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BH.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: BH.surface,
    borderBottomWidth: 1,
    borderBottomColor: BH.slate100,
  },
  headerBack: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14.5, fontWeight: '800', color: BH.textStrong },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTxt: { fontSize: 13, color: BH.textSubtle, fontWeight: '600' },
  listContent: { padding: 14, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: BH.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    borderLeftWidth: 3,
    padding: 13,
    marginBottom: 10,
    ...SHADOW.sm,
  },
  cardUnread: { backgroundColor: '#FFFBF9' },
  rowPressed: { opacity: 0.75 },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md + 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  categoryPill: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  detailCategoryPill: { alignSelf: 'flex-start', marginBottom: 3 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: BH.slate600 },
  rowTitleUnread: { fontWeight: '800', color: BH.textStrong },
  rowSender: { fontSize: 10.5, color: BH.textSubtle, fontWeight: '700', marginTop: 1 },
  rowSnippet: { fontSize: 12.5, color: BH.textMuted, marginTop: 3, lineHeight: 17 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 'auto', flexShrink: 0 },
  detailRoot: { flex: 1, justifyContent: 'flex-end' },
  detailBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.4)' },
  detailCard: {
    backgroundColor: BH.surface,
    borderRadius: RADIUS['2xl'] - 4,
    marginHorizontal: 16,
    padding: 20,
    maxHeight: '70%',
    ...SHADOW.lg,
  },
  detailCardMedia: { padding: 0, overflow: 'hidden' },
  detailCloseFloating: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  detailAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailTitle: { fontSize: 15, fontWeight: '800', color: BH.textStrong },
  detailFrom: { fontSize: 11, color: BH.textSubtle, fontWeight: '600', marginTop: 2 },
  detailBodyScroll: { maxHeight: 260 },
  detailBody: { fontSize: 14, color: BH.text, lineHeight: 21 },
  detailActionBtn: {
    marginTop: 16,
    backgroundColor: BH.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: 13,
    alignItems: 'center',
    ...SHADOW.brand,
  },
  detailActionTxt: { color: BH.brandContrast, fontWeight: '800', fontSize: 14 },
});
