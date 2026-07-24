import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { useFamilyNotificationsInbox, type InboxItem } from '../../lib/useFamilyNotificationsInbox';

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

type NotifVisual = { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; accent: string };

const RELATED_CFG: Record<string, NotifVisual> = {
  admission_request: { icon: 'document-text', bg: '#FFE4D6', color: '#C2410C', accent: '#F97316' },
  visitation_request: { icon: 'calendar', bg: '#E0E7FF', color: '#4338CA', accent: '#6366F1' },
};
const DEFAULT_CFG: NotifVisual = { icon: 'notifications-outline', bg: '#F1F5F9', color: '#64748B', accent: '#94A3B8' };

/** Status-coloured pill icon derived from the notification's title, falling back to its related-record type. */
function getNotifVisual(item: InboxItem): NotifVisual {
  const t = item.title.toLowerCase();
  if (t.includes('approved') || t.includes('confirmed')) {
    return { icon: 'checkmark-circle', bg: '#DCFCE7', color: '#16A34A', accent: '#22C55E' };
  }
  if (t.includes('rejected') || t.includes('declined')) {
    return { icon: 'close-circle', bg: '#FEE2E2', color: '#DC2626', accent: '#EF4444' };
  }
  if (t.includes('documents needed') || t.includes('required')) {
    return { icon: 'alert-circle', bg: '#FEF3C7', color: '#B45309', accent: '#F59E0B' };
  }
  if (t.includes('rescheduled')) {
    return { icon: 'time', bg: '#E0E7FF', color: '#4338CA', accent: '#6366F1' };
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

  useEffect(() => {
    void inbox.markAllLegacyRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (item: InboxItem) => {
    setOpenItem(item);
    void inbox.markRead(item);
  };

  const goToRelated = (item: InboxItem) => {
    setOpenItem(null);
    onClose();
    if (item.relatedType === 'visitation_request') {
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
          <Ionicons name="arrow-back" size={20} color="#1B2559" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {inbox.loading ? (
        <ActivityIndicator color="#F54E25" style={{ marginTop: 40 }} />
      ) : inbox.items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="mail-open-outline" size={40} color="#CBD5E1" />
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
                  { borderLeftColor: !item.isRead ? cfg.accent : '#EEF1F6' },
                  pressed && styles.rowPressed,
                ]}
                onPress={() => openDetail(item)}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: cfg.accent }]} /> : null}
                  </View>
                  <Text style={styles.rowSender}>Bridges of Hope · {relativeTime(item.createdAt)}</Text>
                  <Text style={styles.rowSnippet} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginTop: 2 }} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={Boolean(openItem)} transparent animationType="fade" onRequestClose={() => setOpenItem(null)}>
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setOpenItem(null)} />
          <View style={[styles.detailCard, { marginBottom: insets.bottom + 24 }]}>
            <View style={styles.detailHead}>
              <View style={[styles.detailAvatar, { backgroundColor: openItem ? getNotifVisual(openItem).accent : '#F54E25' }]}>
                <Ionicons name="business" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailTitle}>{openItem?.title}</Text>
                <Text style={styles.detailFrom}>
                  From Bridges of Hope{openItem ? ` · ${relativeTime(openItem.createdAt)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpenItem(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailBody}>{openItem?.body}</Text>
            </ScrollView>
            {openItem?.relatedType ? (
              <Pressable style={styles.detailActionBtn} onPress={() => openItem && goToRelated(openItem)}>
                <Text style={styles.detailActionTxt}>
                  {openItem.relatedType === 'visitation_request' ? 'View appointment' : 'View admission request'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBack: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14.5, fontWeight: '800', color: '#1B2559' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  listContent: { padding: 14, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    borderLeftWidth: 3,
    padding: 13,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 1 },
    }),
  },
  cardUnread: { backgroundColor: '#FFFBF9' },
  rowPressed: { opacity: 0.75 },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#475569' },
  rowTitleUnread: { fontWeight: '800', color: '#1B2559' },
  rowSender: { fontSize: 10.5, color: '#94A3B8', fontWeight: '700', marginTop: 1 },
  rowSnippet: { fontSize: 12.5, color: '#64748B', marginTop: 3, lineHeight: 17 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F54E25', marginTop: 6, flexShrink: 0 },
  detailRoot: { flex: 1, justifyContent: 'flex-end' },
  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 20,
    maxHeight: '70%',
  },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  detailAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  detailFrom: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  detailBodyScroll: { maxHeight: 260 },
  detailBody: { fontSize: 14, color: '#334155', lineHeight: 21 },
  detailActionBtn: {
    marginTop: 16,
    backgroundColor: '#F54E25',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  detailActionTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
