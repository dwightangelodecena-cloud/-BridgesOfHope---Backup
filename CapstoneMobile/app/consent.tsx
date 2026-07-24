import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SIGNUP_CONSENT_STORAGE_KEY,
  INFORMED_CONSENT_READ_KEY,
} from "../lib/legalDocuments";
import { ScalePressable } from "../components/auth/ScalePressable";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

const CONSENT_POINTS = [
  "How we collect and use your family information",
  "Admission processing and visitation policies",
  "Secure access to the family portal",
];

export default function ConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasReadConsent, setHasReadConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const canContinue = hasReadConsent && agreed && !submitting;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void (async () => {
        const read = await AsyncStorage.getItem(INFORMED_CONSENT_READ_KEY);
        if (mounted && read) setHasReadConsent(true);
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const handleContinue = async () => {
    setError("");
    if (!hasReadConsent) {
      setError("Please open and read the Informed Consent Form to the end.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Informed Consent Form to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await AsyncStorage.setItem(SIGNUP_CONSENT_STORAGE_KEY, new Date().toISOString());
      router.push("/signup");
    } finally {
      setSubmitting(false);
    }
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
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>

        <View style={styles.heroContent}>
          <View style={styles.heroIconOuter}>
            <LinearGradient
              colors={[C.orangeLight, C.orange, C.orangeDark]}
              style={styles.heroIconGradient}
            >
              <Ionicons name="document-text-outline" size={30} color="#fff" />
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

          <Text style={styles.heroEyebrow}>ACCOUNT SETUP</Text>
          <Text style={styles.heroTitle}>Consent required</Text>
          <Text style={styles.heroSubtitle}>
            Please review and agree before creating your family account
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={[
              styles.sheetScroll,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>BEFORE YOU JOIN</Text>
              </View>
              <Text style={styles.formTitle} accessibilityRole="header">
                Informed consent
              </Text>
              <Text style={styles.formSubtitle}>
                Read the form below, then confirm your agreement to continue to sign up.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="information-circle-outline" size={18} color={C.orange} />
                <Text style={styles.infoCardTitle}>What you&apos;re agreeing to</Text>
              </View>
              {CONSENT_POINTS.map((point) => (
                <View key={point} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={14} color={C.orange} />
                  <Text style={styles.bulletText}>{point}</Text>
                </View>
              ))}
            </View>

            <ScalePressable
              onPress={() => router.push("/informed-consent" as never)}
              style={styles.readCard}
              accessibilityRole="button"
              accessibilityLabel="Read informed consent form"
            >
              <View style={styles.readCardIcon}>
                <Ionicons name="reader-outline" size={22} color={C.orange} />
              </View>
              <View style={styles.readCardCopy}>
                <Text style={styles.readCardLabel}>
                  {hasReadConsent ? "Form read — tap to review again" : "Read informed consent form"}
                </Text>
                <Text style={styles.readCardHint}>
                  Open and scroll to the end to enable agreement
                </Text>
              </View>
              <View style={styles.readCardArrow}>
                <Ionicons name="chevron-forward" size={18} color={C.orange} />
              </View>
            </ScalePressable>

            {hasReadConsent ? (
              <View style={styles.readDonePill}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.readDoneText}>Consent form completed</Text>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{error}</Text>
                <TouchableOpacity onPress={() => setError("")} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.checkRow, !hasReadConsent && styles.checkRowDisabled]}
              onPress={() => {
                if (!hasReadConsent) {
                  setError("Please read the Informed Consent Form to the end first.");
                  return;
                }
                setError("");
                setAgreed((v) => !v);
              }}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed, disabled: !hasReadConsent }}
            >
              <View
                style={[
                  styles.checkbox,
                  agreed && styles.checkboxOn,
                  !hasReadConsent && styles.checkboxDisabled,
                ]}
              >
                {agreed ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
              </View>
              <Text style={[styles.checkLabel, !hasReadConsent && styles.checkLabelDisabled]}>
                I have read and agree to the Informed Consent Form and voluntarily consent to the
                collection and processing of my information as described.
              </Text>
            </TouchableOpacity>

            <ScalePressable
              onPress={() => void handleContinue()}
              disabled={!canContinue}
              style={[styles.ctaWrap, !canContinue && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel="I agree and continue"
            >
              <LinearGradient
                colors={
                  canContinue
                    ? [C.orangeLight, C.orange, C.orangeDark]
                    : ["#CBD5E1", "#94A3B8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaInner}>
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>I agree and continue</Text>
                  </View>
                )}
              </LinearGradient>
            </ScalePressable>

            <ScalePressable
              onPress={() => router.push("/login")}
              style={styles.signInRow}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.signInMuted}>Already have an account?</Text>
              <Text style={styles.signInLink}> Sign in</Text>
              <Ionicons name="chevron-forward" size={16} color={C.orange} style={styles.signInChevron} />
            </ScalePressable>

            <View style={styles.footerMeta}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.muted} />
              <Text style={styles.footerMetaText}>Encrypted & secure</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerMetaText}>Bridges of Hope</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerMetaText}>v{appVersion}</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: 32,
    minHeight: 188,
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
  heroContent: { alignItems: "center", zIndex: 1, paddingTop: 40 },
  heroIconOuter: { marginBottom: 12, position: "relative" },
  heroIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    bottom: -4,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroLogoMini: { width: 22, height: 22 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#FF8A65",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -20,
    width: "100%",
    maxWidth: Platform.select({ web: 520, default: undefined }),
  },
  sheet: {
    flex: 1,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  sheetScroll: { paddingHorizontal: 24, paddingTop: 20 },
  formHeader: { marginBottom: 16 },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245, 78, 37, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.15)",
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.orange,
    letterSpacing: 0.8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 14,
    marginBottom: 14,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.navy,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
    fontWeight: "500",
  },
  readCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(245, 78, 37, 0.25)",
    backgroundColor: "#FFF7F4",
    marginBottom: 10,
  },
  readCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(245, 78, 37, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  readCardCopy: { flex: 1, minWidth: 0 },
  readCardLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    marginBottom: 2,
  },
  readCardHint: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 16,
  },
  readCardArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.15)",
  },
  readDonePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 14,
  },
  readDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  bannerError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerErrorText: { color: "#DC2626" },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 18,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    backgroundColor: "#FAFBFC",
  },
  checkRowDisabled: { opacity: 0.75 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: C.orange, borderColor: C.orange },
  checkboxDisabled: { backgroundColor: "#F1F5F9" },
  checkLabel: { flex: 1, fontSize: 13, color: C.navy, lineHeight: 19, fontWeight: "500" },
  checkLabelDisabled: { color: C.muted },
  ctaWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
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
  ctaDisabled: { opacity: 0.85 },
  cta: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  ctaInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8EDF3",
    marginBottom: 16,
  },
  signInMuted: { fontSize: 14, color: C.muted },
  signInLink: { fontSize: 14, fontWeight: "800", color: C.orange },
  signInChevron: { marginLeft: 2 },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
    paddingBottom: 4,
  },
  footerMetaText: { fontSize: 11, color: C.muted, fontWeight: "500" },
  footerDot: { fontSize: 11, color: "#CBD5E1" },
});
