import React, { useState, useMemo } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TAB_ROUTES, goBackOrReplace } from "../lib/navigationConfig";
import {
  ensureFamilyAccountOrSignOut,
  signInWithGoogleMobile,
} from "../lib/googleAuth";
import { LoginField } from "../components/auth/LoginField";
import { ScalePressable } from "../components/auth/ScalePressable";
import { RecoveryStepBar } from "../components/auth/RecoveryStepBar";

const RECOVERY_EMAIL_KEY = "bh_recovery_email";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

const HOW_IT_WORKS = [
  "Enter the email linked to your account",
  "Check your inbox for a 6-digit code",
  "Enter the code and set a new password",
];

const emailLooksValid = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export default function ForgetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = useMemo(() => emailLooksValid(trimmedEmail), [trimmedEmail]);
  const hasEmail = trimmedEmail.length > 0;
  const canSend = emailValid && !sending;

  const handleSendVerification = async () => {
    setError(null);

    if (!trimmedEmail) {
      setError("Please enter an email address.");
      return;
    }

    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setError(
        "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart Expo."
      );
      return;
    }

    setSending(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: false },
      });

      if (otpErr) {
        setError(otpErr.message || "Could not send verification code.");
        return;
      }

      await AsyncStorage.setItem(RECOVERY_EMAIL_KEY, trimmedEmail);
      router.push({
        pathname: "/verification",
        params: { email: trimmedEmail },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const handleGoToSignup = () => {
    router.push("/consent" as never);
  };

  const handleGoogle = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(
        "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart Expo."
      );
      return;
    }
    setSending(true);
    try {
      const result = await signInWithGoogleMobile();
      if (result.status === "cancelled") {
        setSending(false);
        return;
      }
      if (result.status === "error") {
        setError(result.message);
        setSending(false);
        return;
      }
      const roleCheck = await ensureFamilyAccountOrSignOut();
      if (roleCheck === "staff") {
        setError("Use the web app to sign in as staff.");
        setSending(false);
        return;
      }
      router.replace(TAB_ROUTES.home);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
      setSending(false);
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
          onPress={() => goBackOrReplace(router, "/login")}
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
              <Ionicons name="lock-open-outline" size={30} color="#fff" />
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

          <Text style={styles.heroEyebrow}>ACCOUNT RECOVERY</Text>
          <Text style={styles.heroTitle}>Reset your password</Text>
          <Text style={styles.heroSubtitle}>
            We&apos;ll help you get back into your account securely
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
            <RecoveryStepBar activeIndex={0} />

            <View style={styles.formHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 1 OF 3</Text>
              </View>
              <Text style={styles.formTitle} accessibilityRole="header">
                Enter your email
              </Text>
              <Text style={styles.formSubtitle}>
                We&apos;ll send a 6-digit verification code to confirm it&apos;s you.
              </Text>
            </View>

            <View style={styles.howItWorks}>
              <View style={styles.howItWorksHeader}>
                <Ionicons name="information-circle-outline" size={18} color={C.orange} />
                <Text style={styles.howItWorksTitle}>How it works</Text>
              </View>
              {HOW_IT_WORKS.map((line, i) => (
                <View key={line} style={styles.howRow}>
                  <View style={styles.howNum}>
                    <Text style={styles.howNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.howText}>{line}</Text>
                </View>
              ))}
            </View>

            {error ? (
              <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <LoginField
              label="Email address"
              icon="mail-outline"
              placeholder="you@email.com"
              value={email}
              error={!!error}
              showClear
              onClear={() => {
                setEmail("");
                setError(null);
              }}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSend) void handleSendVerification();
              }}
              editable={!sending}
              accessibilityLabel="Email address"
              rightElement={
                emailValid ? (
                  <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                ) : null
              }
            />

            {hasEmail && !emailValid ? (
              <Text style={styles.fieldHint}>Enter a valid email address to continue.</Text>
            ) : null}

            <View style={styles.tipCard}>
              <Ionicons name="mail-unread-outline" size={18} color="#1D4ED8" />
              <Text style={styles.tipText}>
                Check your spam folder if the code doesn&apos;t arrive within a few minutes.
              </Text>
            </View>

            <ScalePressable
              onPress={handleSendVerification}
              disabled={!canSend}
              style={[styles.ctaWrap, !canSend && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Send verification code"
            >
              <LinearGradient
                colors={
                  canSend
                    ? [C.orangeLight, C.orange, C.orangeDark]
                    : ["#CBD5E1", "#94A3B8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaInner}>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>Send verification code</Text>
                  </View>
                )}
              </LinearGradient>
            </ScalePressable>

            <TouchableOpacity
              onPress={handleBackToLogin}
              disabled={sending}
              style={styles.backToLogin}
              accessibilityRole="link"
            >
              <Ionicons name="arrow-back" size={14} color={C.orange} />
              <Text style={styles.backToLoginText}>Back to sign in</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>

            <ScalePressable
              onPress={handleGoogle}
              disabled={sending}
              style={[styles.googleBtn, sending && styles.googleDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              <Image
                source={require("../assets/images/google-logo.png")}
                style={styles.googleIcon}
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </ScalePressable>

            <ScalePressable onPress={handleGoToSignup} style={styles.signupPrompt}>
              <LinearGradient
                colors={["#FFF7F4", "#FFFFFF"]}
                style={styles.signupPromptGradient}
              >
                <View style={styles.signupPromptIcon}>
                  <Ionicons name="person-add-outline" size={20} color={C.orange} />
                </View>
                <View style={styles.signupPromptCopy}>
                  <Text style={styles.signupPromptLabel}>Don&apos;t have an account?</Text>
                  <Text style={styles.signupPromptAction}>Create your free account</Text>
                </View>
                <View style={styles.signupPromptArrow}>
                  <Ionicons name="chevron-forward" size={18} color={C.orange} />
                </View>
              </LinearGradient>
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
  heroIconOuter: {
    marginBottom: 12,
    position: "relative",
  },
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
    fontSize: 24,
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
    fontSize: 24,
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
  howItWorks: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 14,
    marginBottom: 18,
  },
  howItWorksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.navy,
  },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  howNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(245, 78, 37, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  howNumText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.orange,
  },
  howText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
    fontWeight: "500",
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerErrorText: { color: "#DC2626" },
  fieldHint: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: -10,
    marginBottom: 12,
    fontWeight: "600",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    marginTop: -4,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#1D4ED8",
    fontWeight: "500",
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
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
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 18,
  },
  backToLoginText: { fontSize: 14, fontWeight: "700", color: C.orange },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8EDF3" },
  dividerText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: C.white,
    marginBottom: 20,
  },
  googleDisabled: { opacity: 0.65 },
  googleIcon: { width: 20, height: 20 },
  googleText: { fontSize: 15, fontWeight: "700", color: C.navy },
  signupPrompt: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.2)",
  },
  signupPromptGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  signupPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(245, 78, 37, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  signupPromptCopy: { flex: 1, minWidth: 0 },
  signupPromptLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: "500",
    marginBottom: 2,
  },
  signupPromptAction: {
    fontSize: 15,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.2,
  },
  signupPromptArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.15)",
  },
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
