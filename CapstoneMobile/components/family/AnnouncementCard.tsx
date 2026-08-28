import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BH, RADIUS, SHADOW } from '../../theme/tokens';

const CARD_GRADIENT = ['#FF8A3D', '#F5761E', '#F54E25', '#EA3E12'] as const;
const GRADIENT_LOCATIONS = [0, 0.3, 0.65, 1] as const;
const DEFAULT_IMAGE_ASPECT = 16 / 9;
const MIN_IMAGE_HEIGHT = 140;
const MAX_IMAGE_HEIGHT = 420;

export type AnnouncementCardViewProps = {
  title: string;
  caption?: string | null;
  imageUrl?: string | null;
  cardWidth: number;
};

/**
 * Pure "what does this announcement look like" content — image sized to the photo's own
 * aspect ratio (so it's never cropped), gradient "Announcement" pill, title, caption. Shared
 * by the home auto-popup and the Notifications detail view, so tapping a promo notification
 * shows the same premium card instead of plain title/body text.
 */
export function AnnouncementCardView({ title, caption, imageUrl, cardWidth }: AnnouncementCardViewProps) {
  const [imageAspect, setImageAspect] = useState(DEFAULT_IMAGE_ASPECT);

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

  const imageHeight = Math.max(MIN_IMAGE_HEIGHT, Math.min(MAX_IMAGE_HEIGHT, cardWidth / imageAspect));

  return (
    <>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <LinearGradient
            colors={CARD_GRADIENT}
            locations={GRADIENT_LOCATIONS}
            start={{ x: 0.37, y: 0.02 }}
            end={{ x: 0.63, y: 0.98 }}
            style={styles.image}
          />
        )}
        <LinearGradient
          colors={CARD_GRADIENT}
          locations={GRADIENT_LOCATIONS}
          start={{ x: 0.37, y: 0.02 }}
          end={{ x: 0.63, y: 0.98 }}
          style={styles.pill}
        >
          <Text style={styles.pillText}>ANNOUNCEMENT</Text>
        </LinearGradient>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  imageWrap: { width: '100%', backgroundColor: BH.brandSurface },
  image: { width: '100%', height: '100%' },
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
  body: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: '900', color: BH.textStrong, marginBottom: 8 },
  caption: { fontSize: 13.5, color: BH.textMuted, lineHeight: 20 },
});
