import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useFamilyNotificationsInbox, type InboxItem } from '../../lib/useFamilyNotificationsInbox';

const C = { orange: '#F54E25', navy: '#1A2B4A', muted: '#64748B', border: '#E2E8F0' };

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

const RELATED_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  admission_request: 'document-text',
  visitation_request: 'calendar',
};

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useFamilyUserMobile();
  const inbox = useFamilyNotificationsInbox(userId);
  const [openItem, setOpenItem] = useState<InboxItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      void inbox.reload();
      void inbox.markAllLegacyRead();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const openDetail = (item: InboxItem) => {
    setOpenItem(item);
    void inbox.markRead(item);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate(TAB_ROUTES.home as never));

  const goToRelated = (item: InboxItem) => {
    setOpenItem(null);
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
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 34 }} />
      </View>

      {inbox.loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
      ) : inbox.items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="mail-open-outline" size={40} color="#CBD5E1" />
          <Text style={styles.emptyTxt}>No notifications yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {inbox.items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
              {!item.isRead ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
              <Ionicons
                name={RELATED_ICON[item.relatedType || ''] || 'notifications-outline'}
                size={18}
                color={item.isRead ? '#94A3B8' : C.orange}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.rowSender}>Bridges of Hope</Text>
                <Text style={styles.rowSnippet} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={Boolean(openItem)} transparent animationType="fade" onRequestClose={() => setOpenItem(null)}>
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setOpenItem(null)} />
          <View style={[styles.detailCard, { marginBottom: insets.bottom + 24 }]}>
            <View style={styles.detailHead}>
              <View style={styles.detailAvatar}>
                <Ionicons name="business" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailTitle}>{openItem?.title}</Text>
                <Text style={styles.detailFrom}>
                  From Bridges of Hope{openItem ? ` · ${relativeTime(openItem.createdAt)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpenItem(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailBodyScroll}>
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBack: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.orange, marginTop: 7 },
  unreadDotSpacer: { width: 7, height: 7, marginTop: 7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#475569', flexShrink: 1 },
  rowTitleUnread: { fontWeight: '800', color: C.navy },
  rowTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  rowSender: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 1 },
  rowSnippet: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 18 },
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
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailTitle: { fontSize: 15, fontWeight: '800', color: C.navy },
  detailFrom: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  detailTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4, marginBottom: 12 },
  detailBodyScroll: { maxHeight: 260 },
  detailBody: { fontSize: 14, color: '#334155', lineHeight: 21 },
  detailActionBtn: {
    marginTop: 16,
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  detailActionTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
