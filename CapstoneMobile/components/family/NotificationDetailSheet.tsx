import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InboxItem } from '../../lib/useFamilyNotificationsInbox';
import { notificationTarget, type NotificationTarget } from '../../lib/notificationRouting';
import {
  TONE_COLORS,
  extractDocumentList,
  extractResident,
  extractSchedule,
  fullTimestamp,
  getNotifVisual,
  notifStatus,
} from '../../lib/notificationVisuals';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

type Props = {
  item: InboxItem | null;
  onClose: () => void;
  /** Called with the destination when the guardian taps the action button. */
  onNavigate: (target: NotificationTarget) => void;
};

/**
 * Bottom sheet for one notification. No decorative header art — it opens straight on the
 * content, and the middle section adapts to what the notification is about:
 *  - schedules (meetings, visits, pickups) → calendar date card with the time
 *  - missing documents → checklist of what to upload
 *  - everything else → the message, with the resident and outcome pulled out
 */
export function NotificationDetailSheet({ item, onClose, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  if (!item) {
    return <Modal visible={false} transparent onRequestClose={onClose} />;
  }

  const cfg = getNotifVisual(item);
  const target = notificationTarget(item);
  const status = notifStatus(item);
  const schedule = extractSchedule(item);
  const resident = extractResident(item);
  const documents = extractDocumentList(item);
  const tone = status ? TONE_COLORS[status.tone] : null;
  // With a checklist, drop the list part of the message ("…for X: Valid ID, …") so it isn't repeated.
  const bodyText = documents.length > 0 ? `${item.body.slice(0, item.body.lastIndexOf(':')).trim()}.` : item.body;
  const showBody = Boolean(bodyText) && bodyText !== item.title;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={styles.handle} />

          <View style={styles.topRow}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryBar, { backgroundColor: cfg.accent }]} />
              <Text style={[styles.category, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={BH.slate600} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Bridges of Hope · {fullTimestamp(item.createdAt)}</Text>
              {status && tone ? (
                <View style={[styles.status, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
                  <Text style={[styles.statusTxt, { color: tone.fg }]}>{status.label}</Text>
                </View>
              ) : null}
            </View>

            {schedule ? (
              <View style={styles.scheduleCard}>
                <View style={styles.calTile}>
                  <View style={[styles.calTileTop, { backgroundColor: cfg.accent }]}>
                    <Text style={styles.calMonth}>{schedule.month}</Text>
                  </View>
                  <Text style={styles.calDay}>{schedule.day}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scheduleWeekday}>{schedule.weekday}</Text>
                  <Text style={styles.scheduleDate}>{schedule.dateLabel}</Text>
                  {schedule.time ? <Text style={[styles.scheduleTime, { color: cfg.color }]}>{schedule.time}</Text> : null}
                </View>
              </View>
            ) : null}

            {showBody ? <Text style={styles.body}>{bodyText}</Text> : null}

            {documents.length > 0 ? (
              <View style={styles.docsCard}>
                <Text style={styles.docsTitle}>
                  {documents.length === 1 ? '1 document to upload' : `${documents.length} documents to upload`}
                </Text>
                {documents.map((doc) => (
                  <View key={doc} style={styles.docRow}>
                    <View style={styles.docBox} />
                    <Text style={styles.docTxt}>{doc}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {resident ? (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Resident</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {resident}
                </Text>
              </View>
            ) : null}

            {target ? (
              <Text style={styles.nextStep}>
                <Text style={styles.nextStepLabel}>Next step  </Text>
                {target.hint}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            {target ? (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
                onPress={() => onNavigate(target)}
                accessibilityRole="button"
              >
                <Text style={styles.primaryTxt}>{target.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color={BH.brandContrast} />
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [target ? styles.secondaryBtn : styles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={target ? styles.secondaryTxt : styles.primaryTxt}>{target ? 'Close' : 'Got it'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: BH.surface,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    maxHeight: '86%',
    ...SHADOW.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BH.slate200,
    marginTop: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBar: { width: 3, height: 14, borderRadius: 2 },
  category: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BH.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '900', color: BH.textStrong, lineHeight: 26, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  meta: { fontSize: 12, color: BH.textSubtle, fontWeight: '600' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: '800' },

  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BH.border,
    backgroundColor: BH.surface2,
  },
  calTile: {
    width: 62,
    borderRadius: 12,
    backgroundColor: BH.surface,
    borderWidth: 1,
    borderColor: BH.border,
    overflow: 'hidden',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  calTileTop: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 3 },
  calMonth: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  calDay: { fontSize: 26, fontWeight: '900', color: BH.textStrong, paddingVertical: 4 },
  scheduleWeekday: { fontSize: 12, fontWeight: '700', color: BH.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  scheduleDate: { fontSize: 16, fontWeight: '800', color: BH.textStrong, marginTop: 2 },
  scheduleTime: { fontSize: 15, fontWeight: '800', marginTop: 4 },

  docsCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: BH.warningBg,
    borderWidth: 1,
    borderColor: BH.warningBorder,
    gap: 10,
  },
  docsTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#F59E0B', backgroundColor: BH.surface },
  docTxt: { flex: 1, fontSize: 14.5, fontWeight: '700', color: BH.slate800 },

  body: { fontSize: 15, color: BH.text, lineHeight: 23, marginTop: 16 },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BH.slate100,
  },
  factLabel: { fontSize: 12.5, fontWeight: '700', color: BH.textSubtle },
  factValue: { flexShrink: 1, fontSize: 14.5, fontWeight: '800', color: BH.textStrong },
  nextStep: { fontSize: 13, lineHeight: 19, color: BH.textMuted, marginTop: 14 },
  nextStepLabel: { fontWeight: '800', color: BH.slate700 },

  actions: { paddingHorizontal: 22, paddingTop: 16, gap: 6 },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: BH.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.brand,
  },
  primaryTxt: { color: BH.brandContrast, fontWeight: '800', fontSize: 15 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.lg },
  secondaryTxt: { color: BH.slate600, fontWeight: '700', fontSize: 14 },
});
