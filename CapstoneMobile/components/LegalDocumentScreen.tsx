import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { goBackOrReplace } from "../lib/navigationConfig";
import type { Href } from "expo-router";
import type { LegalDocument } from "../lib/legalDocuments";
import { ScalePressable } from "./auth/ScalePressable";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCROLL_END_THRESHOLD = 32;

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

type Props = {
  document: LegalDocument;
  onConfirmRead: () => void;
  confirmLabel: string;
  backFallback?: Href;
};

export function LegalDocumentScreen({
  document,
  onConfirmRead,
  confirmLabel,
  backFallback = "/signup",
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScrollState = (
    layoutMeasurement: { height: number },
    contentOffset: { y: number },
    contentSize: { height: number }
  ) => {
    const maxScroll = Math.max(contentSize.height - layoutMeasurement.height, 1);
    const progress = Math.min(100, Math.round((contentOffset.y / maxScroll) * 100));
    setScrollProgress(progress);

    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_END_THRESHOLD) {
      setScrolledToEnd(true);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    updateScrollState(layoutMeasurement, contentOffset, contentSize);
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    const maxBody = SCREEN_HEIGHT * 0.42;
    if (h <= maxBody + SCROLL_END_THRESHOLD) {
      setScrolledToEnd(true);
      setScrollProgress(100);
    }
  };

  const handleConfirm = () => {
    onConfirmRead();
    goBackOrReplace(router, backFallback);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <LinearGradient
          colors={["#0B1528", "#152238", "#2A1A28"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBurgundyWash} />

        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => goBackOrReplace(router, backFallback)}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>

        <View style={styles.heroContent}>
          <View style={styles.heroIconOuter}>
            <LinearGradient
              colors={[C.orangeLight, C.orange, C.orangeDark]}
              style={styles.heroIconGradient}
            >
              <Ionicons name="document-text-outline" size={28} color="#fff" />
            </LinearGradient>
            <View style={styles.heroLogoBadge}>
              <Image
                source={require("../assets/images/kalingalogo.png")}
                style={styles.heroLogoMini}
                contentFit="contain"
                accessibilityLabel="Kalinga"
              />
            </View>
          </View>

          <Text style={styles.heroEyebrow}>LEGAL DOCUMENT</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {document.title}
          </Text>
          <Text style={styles.heroSubtitle} numberOfLines={2}>
            {document.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.progressHeader}>
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>
                {scrolledToEnd ? "Ready to confirm" : "Reading progress"}
              </Text>
              <Text style={styles.progressPercent}>{scrollProgress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={
                  scrolledToEnd
                    ? ["#22C55E", "#16A34A"]
                    : [C.orangeLight, C.orange]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(scrollProgress, scrolledToEnd ? 100 : 4)}%` }]}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
          >
            {document.sections.map((section, index) => (
              <View key={section.title} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionNumber}>
                    <Text style={styles.sectionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}

            {document.footer ? (
              <View style={styles.footerCard}>
                <Ionicons name="information-circle-outline" size={18} color={C.orange} />
                <Text style={styles.footerStatement}>{document.footer}</Text>
              </View>
            ) : null}

            {!scrolledToEnd ? (
              <View style={styles.scrollHintPill}>
                <Ionicons name="arrow-down-outline" size={14} color={C.orange} />
                <Text style={styles.scrollHint}>Scroll to the bottom to continue</Text>
              </View>
            ) : (
              <View style={styles.scrollDonePill}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.scrollDoneText}>You&apos;ve reached the end</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footerBar, { paddingBottom: insets.bottom + 12 }]}>
            <ScalePressable
              onPress={handleConfirm}
              disabled={!scrolledToEnd}
              style={[styles.ctaWrap, !scrolledToEnd && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <LinearGradient
                colors={
                  scrolledToEnd
                    ? [C.orangeLight, C.orange, C.orangeDark]
                    : ["#CBD5E1", "#94A3B8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <View style={styles.ctaInner}>
                  <Ionicons
                    name={scrolledToEnd ? "checkmark-done-outline" : "lock-closed-outline"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.ctaText}>{confirmLabel}</Text>
                </View>
              </LinearGradient>
            </ScalePressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#152238",
    ...Platform.select({ web: { alignItems: "center" }, default: {} }),
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    minHeight: 176,
    overflow: "hidden",
    width: "100%",
    maxWidth: Platform.select({ web: 520, default: undefined }),
  },
  heroBurgundyWash: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "58%",
    backgroundColor: "rgba(74, 40, 50, 0.45)",
    borderTopLeftRadius: 120,
    borderBottomLeftRadius: 40,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: { alignItems: "center", zIndex: 1, paddingTop: 36 },
  heroIconOuter: { marginBottom: 10, position: "relative" },
  heroIconGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(245, 78, 37, 0.45)" },
      default: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  heroLogoBadge: {
    position: "absolute",
    bottom: -6,
    right: -12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroLogoMini: { width: 24, height: 24 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#FF8A65",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 12,
    lineHeight: 17,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -18,
    width: "100%",
    maxWidth: Platform.select({ web: 520, default: undefined }),
  },
  sheet: {
    flex: 1,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 -8px 32px rgba(0,0,0,0.12)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  progressHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.navy,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "800",
    color: C.orange,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8EDF3",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14 },
  sectionCard: {
    backgroundColor: "#FAFBFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 14,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  sectionNumber: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(245, 78, 37, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  sectionNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.orange,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    lineHeight: 20,
  },
  sectionBody: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    fontWeight: "500",
    paddingLeft: 34,
  },
  footerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFF7F4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.2)",
    padding: 14,
    marginBottom: 12,
  },
  footerStatement: {
    flex: 1,
    fontSize: 12,
    color: C.navy,
    lineHeight: 18,
    fontWeight: "500",
    fontStyle: "italic",
  },
  scrollHintPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF7F4",
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.2)",
    marginTop: 4,
    marginBottom: 8,
  },
  scrollHint: {
    fontSize: 12,
    fontWeight: "700",
    color: C.orange,
  },
  scrollDonePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginTop: 4,
    marginBottom: 8,
  },
  scrollDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    ...Platform.select({
      web: { boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      web: {},
      default: {
        shadowColor: C.orangeDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
      },
    }),
  },
  ctaDisabled: { opacity: 0.9 },
  cta: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  ctaInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  ctaText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
});
