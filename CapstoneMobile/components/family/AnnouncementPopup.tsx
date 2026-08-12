import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useActiveAnnouncements } from '../../lib/useActiveAnnouncements';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 380);
const DEFAULT_IMAGE_ASPECT = 16 / 9;
const MIN_IMAGE_HEIGHT = 140;
const MAX_IMAGE_HEIGHT = 420;

/**
 * Self-contained promo popup for the family/mobile app — no props, mounts once at the Home
 * screen root. Shows the oldest-first queue of currently-active, not-yet-dismissed
 * announcements as a premium promotional card (full-bleed image, gradient "Announcement" pill,
 * bold title, caption, single "Got it" dismiss button), one at a time with pagination dots when
 * more than one is active.
 */
export function AnnouncementPopup() {
  const { userId } = useFamilyUserMobile();
  const { unseen, dismiss } = useActiveAnnouncements(userId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageAspect, setImageAspect] = useState(DEFAULT_IMAGE_ASPECT);
  const frontId = unseen[0]?.id ?? null;

  // Dismissing always removes the front item, so the queue naturally shifts and the next
  // unseen announcement becomes index 0 — resetting here keeps the shown card in sync.
  useEffect(() => {
    setActiveIndex(0);
  }, [frontId]);

  const current = unseen[activeIndex];
  const imageUrl = current?.imageUrl;

  // Measure the uploaded photo's real aspect ratio so the image box can be sized to it — the
  // whole photo stays visible (via resizeMode="contain") instead of being cropped into a fixed
  // banner shape.
  useEffect(() => {
    if (!imageUrl) {
      setImageAspect(DEFAULT_IMAGE_ASPECT);
      return undefined;
    }
    let cancelled = false;
    Image.getSize(
      imageUrl,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setImageAspect(w / h);
      },
      () => {
        if (!cancelled) setImageAspect(DEFAULT_IMAGE_ASPECT);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const visible = Boolean(current);
  const imageHeight = Math.max(MIN_IMAGE_HEIGHT, Math.min(MAX_IMAGE_HEIGHT, CARD_WIDTH / imageAspect));

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

          <View style={[styles.imageWrap, { height: imageHeight }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <LinearGradient
                colors={['#FF8A3D', '#F5761E', '#F54E25', '#EA3E12']}
                locations={[0, 0.3, 0.65, 1]}
                start={{ x: 0.37, y: 0.02 }}
                end={{ x: 0.63, y: 0.98 }}
                style={styles.image}
              />
            )}
            <LinearGradient
              colors={['#FF8A3D', '#F5761E', '#F54E25', '#EA3E12']}
              locations={[0, 0.3, 0.65, 1]}
              start={{ x: 0.37, y: 0.02 }}
              end={{ x: 0.63, y: 0.98 }}
              style={styles.pill}
            >
              <Text style={styles.pillText}>ANNOUNCEMENT</Text>
            </LinearGradient>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{current?.title}</Text>
            {current?.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}

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
  imageWrap: { width: '100%', backgroundColor: BH.brandSurface },
  image: { width: '100%', height: '100%' },
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
  pill: {
    position: 'absolute',
    left: 18,
    bottom: -14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    ...SHADOW.brand,
  },
  pillText: { fontSize: 10.5, fontWeight: '800', color: BH.brandContrast, letterSpacing: 0.4 },
  body: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', color: BH.textStrong, marginBottom: 8 },
  caption: { fontSize: 13.5, color: BH.textMuted, lineHeight: 20, marginBottom: 18 },
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
