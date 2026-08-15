import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useActiveAnnouncements } from '../../lib/useActiveAnnouncements';
import { AnnouncementCardView } from './AnnouncementCard';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 380);

/**
 * Self-contained promo popup for the family/mobile app — no props, mounts once at the Home
 * screen root. Shows the oldest-first queue of currently-active, not-yet-dismissed
 * announcements as a premium promotional card, one at a time with pagination dots when more
 * than one is active.
 */
export function AnnouncementPopup() {
  const { userId } = useFamilyUserMobile();
  const { unseen, dismiss } = useActiveAnnouncements(userId);
  const [activeIndex, setActiveIndex] = useState(0);
  const frontId = unseen[0]?.id ?? null;

  // Dismissing always removes the front item, so the queue naturally shifts and the next
  // unseen announcement becomes index 0 — resetting here keeps the shown card in sync.
  useEffect(() => {
    setActiveIndex(0);
  }, [frontId]);

  const current = unseen[activeIndex];
  const visible = Boolean(current);

  const handleGotIt = () => {
    if (!current) return;
    dismiss(current.id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleGotIt}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleGotIt} />
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={handleGotIt} hitSlop={10}>
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </Pressable>

          {current ? (
            <AnnouncementCardView title={current.title} caption={current.caption} imageUrl={current.imageUrl} cardWidth={CARD_WIDTH} />
          ) : null}

          <View style={styles.footer}>
            <Pressable style={styles.button} onPress={handleGotIt}>
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>

            {unseen.length > 1 ? (
              <View style={styles.dots}>
                {unseen.map((a, i) => (
                  <View key={a.id} style={[styles.dot, i === activeIndex ? styles.dotActive : null]} />
                ))}
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
    width: CARD_WIDTH,
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
  button: {
    backgroundColor: BH.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOW.brand,
  },
  buttonText: { fontSize: 14.5, fontWeight: '800', color: BH.brandContrast },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BH.slate200 },
  dotActive: { backgroundColor: BH.brand, width: 16 },
});
