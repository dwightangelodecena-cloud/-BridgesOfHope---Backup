import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnnouncementCardView } from './AnnouncementCard';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

const { width, height } = Dimensions.get('window');
export const ANNOUNCEMENT_POPUP_WIDTH = Math.min(width - 48, 380);

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  caption?: string | null;
  imageUrl?: string | null;
  /** Primary button label (closes the popup). */
  buttonLabel?: string;
  /** Pagination across several announcements. */
  count?: number;
  activeIndex?: number;
  onSelectIndex?: (index: number) => void;
  /** Small status line under the card, e.g. "Live now" or "This announcement has ended". */
  notice?: { tone: 'live' | 'ended'; text: string } | null;
};

/**
 * The announcement popup exactly as guardians first see it on Home (image, gradient pill,
 * title, caption, close button, primary button, dots). Shared by the Home auto-popup and the
 * Notifications view so an announcement always looks the same wherever it's opened.
 */
export function AnnouncementPopupFrame({
  visible,
  onClose,
  title,
  caption,
  imageUrl,
  buttonLabel = 'Got it',
  count = 1,
  activeIndex = 0,
  onSelectIndex,
  notice = null,
}: Props) {
  const canPage = count > 1 && typeof onSelectIndex === 'function';
  const goTo = (i: number) => {
    if (!canPage) return;
    onSelectIndex?.((i + count) % count);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close announcement" />
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </Pressable>

          <ScrollView style={{ maxHeight: height * 0.62 }} showsVerticalScrollIndicator={false} bounces={false}>
            <AnnouncementCardView
              title={title}
              caption={caption}
              imageUrl={imageUrl}
              cardWidth={ANNOUNCEMENT_POPUP_WIDTH}
            />
          </ScrollView>

          <View style={styles.footer}>
            {notice ? (
              <View style={[styles.notice, notice.tone === 'ended' ? styles.noticeEnded : styles.noticeLive]}>
                {notice.tone === 'live' ? (
                  <View style={styles.liveDot} />
                ) : (
                  <Ionicons name="time-outline" size={13} color={BH.slate500} />
                )}
                <Text style={[styles.noticeText, notice.tone === 'live' && { color: BH.successText }]}>
                  {notice.text}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.88 }]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </Pressable>

            {count > 1 ? (
              <View style={styles.pager}>
                {canPage ? (
                  <Pressable onPress={() => goTo(activeIndex - 1)} hitSlop={10} accessibilityLabel="Previous announcement">
                    <Ionicons name="chevron-back" size={18} color={BH.slate400} />
                  </Pressable>
                ) : null}
                <View style={styles.dots}>
                  {Array.from({ length: count }).map((_, i) => (
                    <Pressable key={i} onPress={() => goTo(i)} disabled={!canPage} hitSlop={6}>
                      <View style={[styles.dot, i === activeIndex ? styles.dotActive : null]} />
                    </Pressable>
                  ))}
                </View>
                {canPage ? (
                  <Pressable onPress={() => goTo(activeIndex + 1)} hitSlop={10} accessibilityLabel="Next announcement">
                    <Ionicons name="chevron-forward" size={18} color={BH.slate400} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.55)' },
  card: {
    width: ANNOUNCEMENT_POPUP_WIDTH,
    borderRadius: RADIUS['2xl'],
    backgroundColor: BH.surface,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  closeBtn: {
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
  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    marginBottom: 12,
  },
  noticeLive: { backgroundColor: BH.successBg },
  noticeEnded: { backgroundColor: BH.slate100 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BH.success },
  noticeText: { fontSize: 11.5, fontWeight: '700', color: BH.slate600 },
  button: {
    backgroundColor: BH.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOW.brand,
  },
  buttonText: { fontSize: 14.5, fontWeight: '800', color: BH.brandContrast },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BH.slate200 },
  dotActive: { backgroundColor: BH.brand, width: 16 },
});
