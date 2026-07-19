import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { goBackOrReplace } from "../lib/navigationConfig";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { ScalePressable } from "../components/auth/ScalePressable";
import { RecoveryStepBar } from "../components/auth/RecoveryStepBar";

const OTP_LENGTH = 6;
const RECOVERY_EMAIL_KEY = "bh_recovery_email";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

function paramToString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(user.length - 2, 2))}@${domain}`;
}

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [code, setCode] = useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => "")
  );
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const joinedCode = code.join("");
  const codeComplete = joinedCode.length === OTP_LENGTH;
  const canVerify = codeComplete && !verifying;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromParam = paramToString(params.email);
      if (fromParam) {
        if (!cancelled) setRecoveryEmail(fromParam);
        return;
      }
      const stored = await AsyncStorage.getItem(RECOVERY_EMAIL_KEY);
      if (!cancelled && stored) setRecoveryEmail(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.email]);

  const handleChangeDigit = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });
    if (verifyError) setVerifyError(null);

    if (numeric && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = useCallback(
    (index: number, key: string) => {
      if (key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code]
  );

  const handleVerify = async () => {
    setVerifyError(null);
    if (!codeComplete) {
      setVerifyError(`Enter all ${OTP_LENGTH} digits.`);
      return;
    }

    if (!recoveryEmail) {
      setVerifyError("Missing email. Go back and request a new code.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setVerifyError("Supabase is not configured.");
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: recoveryEmail,
        token: joinedCode,
        type: "email",
      });

      if (error) {
        setVerifyError(error.message || "Invalid or expired code.");
        return;
      }

      router.push("/newpassword");
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!recoveryEmail || resending) return;
    setVerifyError(null);
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: recoveryEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setVerifyError(error.message || "Could not resend code.");
        return;
      }
      setCode(Array.from({ length: OTP_LENGTH }, () => ""));
      inputRefs.current[0]?.focus();
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Could not resend code.");
    } finally {
      setResending(false);
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
          onPress={() => goBackOrReplace(router, "/forget")}
          disabled={verifying}
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
              <Ionicons name="keypad-outline" size={30} color="#fff" />
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
          <Text style={styles.heroTitle}>Verify your email</Text>
          <Text style={styles.heroSubtitle}>
            Enter the 6-digit code we sent to your inbox
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
            <RecoveryStepBar activeIndex={1} />

            <View style={styles.formHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 2 OF 3</Text>
              </View>
              <Text style={styles.formTitle} accessibilityRole="header">
                Enter verification code
              </Text>
              <Text style={styles.formSubtitle}>
                {recoveryEmail
                  ? `Code sent to ${maskEmail(recoveryEmail)}. Use the digits from the email — not the magic link.`
                  : "Use the 6-digit code from your email (not the magic link)."}
              </Text>
            </View>

            {verifyError ? (
              <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{verifyError}</Text>
                <TouchableOpacity onPress={() => setVerifyError(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.codeRow}>
              {code.map((digit, index) => {
                const focused = focusedIndex === index;
                const filled = digit.length > 0;
                return (
                  <View
                    key={index}
                    style={[
                      styles.codeBox,
                      focused && styles.codeBoxFocused,
                      filled && styles.codeBoxFilled,
                      verifyError && styles.codeBoxError,
                    ]}
                  >
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[index] = ref;
                      }}
                      style={styles.codeInput}
                      value={digit}
                      onChangeText={(value) => handleChangeDigit(index, value)}
                      onKeyPress={({ nativeEvent }) =>
                        handleKeyDown(index, nativeEvent.key)
                      }
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      keyboardType="number-pad"
                      maxLength={1}
                      returnKeyType={index === OTP_LENGTH - 1 ? "done" : "next"}
                      editable={!verifying}
                      selectTextOnFocus
                      accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.tipCard}>
              <Ionicons name="mail-unread-outline" size={18} color="#1D4ED8" />
              <Text style={styles.tipText}>
                Didn&apos;t get it? Check spam or promotions, then tap resend below.
              </Text>
            </View>

            <ScalePressable
              onPress={() => void handleVerify()}
              disabled={!canVerify}
              style={[styles.ctaWrap, !canVerify && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Verify code"
            >
              <LinearGradient
                colors={
                  canVerify
                    ? [C.orangeLight, C.orange, C.orangeDark]
                    : ["#CBD5E1", "#94A3B8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaInner}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>Verify code</Text>
                  </View>
                )}
              </LinearGradient>
            </ScalePressable>

            <TouchableOpacity
              onPress={() => void handleResend()}
              disabled={!recoveryEmail || resending || verifying}
              style={styles.resendBtn}
              accessibilityRole="button"
            >
              {resending ? (
                <ActivityIndicator size="small" color={C.orange} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={16} color={C.orange} />
                  <Text style={styles.resendText}>Resend verification code</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              disabled={verifying}
              style={styles.backToLogin}
              accessibilityRole="link"
            >
              <Ionicons name="arrow-back" size={14} color={C.orange} />
              <Text style={styles.backToLoginText}>Back to sign in</Text>
            </TouchableOpacity>

            <ScalePressable
              onPress={() => router.push("/consent" as never)}
              style={styles.signupPrompt}
              disabled={verifying}
            >
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
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 16,
  },
  codeBox: {
    flex: 1,
    maxWidth: 48,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxFocused: {
    borderColor: C.orange,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: { boxShadow: "0 0 0 3px rgba(245, 78, 37, 0.12)" },
      default: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  codeBoxFilled: { borderColor: "#CBD5E1", backgroundColor: "#FFFFFF" },
  codeBoxError: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  codeInput: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    color: C.navy,
    width: "100%",
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" as const } }),
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    marginBottom: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#1E3A8A",
    fontWeight: "500",
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
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
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  resendText: { fontSize: 14, fontWeight: "700", color: C.orange },
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 16,
  },
  backToLoginText: { fontSize: 13, fontWeight: "700", color: C.orange },
  signupPrompt: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 78, 37, 0.15)",
  },
  signupPromptGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  signupPromptIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(245, 78, 37, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  signupPromptCopy: { flex: 1 },
  signupPromptLabel: { fontSize: 12, color: C.muted, marginBottom: 2 },
  signupPromptAction: { fontSize: 15, fontWeight: "800", color: C.navy },
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
