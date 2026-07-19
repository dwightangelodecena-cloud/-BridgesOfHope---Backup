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
import { goBackOrReplace } from "../lib/navigationConfig";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { LoginField } from "../components/auth/LoginField";
import { ScalePressable } from "../components/auth/ScalePressable";
import { RecoveryStepBar } from "../components/auth/RecoveryStepBar";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { key: "letter", label: "One letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { key: "number", label: "One number", test: (v: string) => /\d/.test(v) },
  { key: "special", label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
  { key: "space", label: "No spaces", test: (v: string) => !/\s/.test(v) },
];

function getPasswordStrength(value: string) {
  if (!value) return { score: 0, label: "Enter a password", color: C.muted };
  const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
  if (/\s/.test(value) || passed < 4) {
    return { score: 1, label: "Weak password", color: "#DC2626" };
  }
  if (passed === 4) return { score: 2, label: "Almost there", color: "#D97706" };
  return { score: 3, label: "Strong password", color: "#16A34A" };
}

export default function NewPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSave = strength.score === 3 && passwordsMatch && !saving;

  const handleConfirmNewPassword = async () => {
    setWarningMessage(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setWarningMessage("Please fill in both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setWarningMessage("Passwords do not match.");
      return;
    }

    if (strength.score !== 3) {
      setWarningMessage("Please meet all password requirements below.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setWarningMessage(
        "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setWarningMessage(error.message || "Could not update password.");
        return;
      }
      setPasswordChanged(true);
    } catch (e) {
      setWarningMessage(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSaving(false);
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
          onPress={() => goBackOrReplace(router, "/verification")}
          disabled={saving}
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
              <Ionicons name="lock-closed-outline" size={30} color="#fff" />
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
          <Text style={styles.heroTitle}>Set new password</Text>
          <Text style={styles.heroSubtitle}>
            Choose a strong password to secure your account
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
            <RecoveryStepBar activeIndex={2} />

            <View style={styles.formHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 3 OF 3</Text>
              </View>
              <Text style={styles.formTitle} accessibilityRole="header">
                Create your new password
              </Text>
              <Text style={styles.formSubtitle}>
                Use a unique password you haven&apos;t used elsewhere.
              </Text>
            </View>

            {warningMessage ? (
              <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{warningMessage}</Text>
                <TouchableOpacity onPress={() => setWarningMessage(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <LoginField
              label="New password"
              icon="lock-closed-outline"
              placeholder="Enter new password"
              value={password}
              secureTextEntry={hidePassword}
              error={!!warningMessage}
              onChangeText={(text) => {
                setPassword(text);
                if (warningMessage) setWarningMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="next"
              editable={!saving}
              rightElement={
                <TouchableOpacity
                  onPress={() => setHidePassword((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel={hidePassword ? "Show password" : "Hide password"}
                >
                  <Ionicons
                    name={hidePassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={C.muted}
                  />
                </TouchableOpacity>
              }
            />

            {password.length > 0 ? (
              <View style={styles.strengthCard}>
                <View style={styles.strengthHeader}>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map((bar) => (
                      <View
                        key={bar}
                        style={[
                          styles.strengthBar,
                          strength.score >= bar && { backgroundColor: strength.color },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <View key={rule.key} style={styles.ruleRow}>
                      <Ionicons
                        name={ok ? "checkmark-circle" : "ellipse-outline"}
                        size={14}
                        color={ok ? "#16A34A" : "#CBD5E1"}
                      />
                      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{rule.label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <LoginField
              label="Confirm new password"
              icon="lock-closed-outline"
              placeholder="Re-enter new password"
              value={confirmPassword}
              secureTextEntry={hideConfirmPassword}
              error={!!warningMessage}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (warningMessage) setWarningMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSave) void handleConfirmNewPassword();
              }}
              editable={!saving}
              rightElement={
                <TouchableOpacity
                  onPress={() => setHideConfirmPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel={hideConfirmPassword ? "Show password" : "Hide password"}
                >
                  <Ionicons
                    name={hideConfirmPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={C.muted}
                  />
                </TouchableOpacity>
              }
            />

            {confirmPassword.length > 0 ? (
              <View style={styles.matchRow}>
                <Ionicons
                  name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={passwordsMatch ? "#16A34A" : "#DC2626"}
                />
                <Text style={[styles.matchText, passwordsMatch && styles.matchTextOk]}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            ) : null}

            <ScalePressable
              onPress={() => void handleConfirmNewPassword()}
              disabled={!canSave}
              style={[styles.ctaWrap, !canSave && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Confirm new password"
            >
              <LinearGradient
                colors={
                  canSave
                    ? [C.orangeLight, C.orange, C.orangeDark]
                    : ["#CBD5E1", "#94A3B8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaInner}>
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>Confirm new password</Text>
                  </View>
                )}
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

      {passwordChanged ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <LinearGradient
                colors={["#22C55E", "#16A34A"]}
                style={styles.modalIconGradient}
              >
                <Ionicons name="checkmark" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.modalTitle}>Password updated!</Text>
            <Text style={styles.modalMessage}>
              Your password has been changed successfully. You can now sign in with your new password.
            </Text>
            <ScalePressable
              onPress={() => {
                setPasswordChanged(false);
                router.replace("/login");
              }}
              style={styles.modalCtaWrap}
            >
              <LinearGradient
                colors={[C.orangeLight, C.orange, C.orangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalCta}
              >
                <Text style={styles.modalCtaText}>Back to sign in</Text>
              </LinearGradient>
            </ScalePressable>
          </View>
        </View>
      ) : null}
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
  strengthCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 12,
    marginTop: -8,
    marginBottom: 14,
  },
  strengthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  strengthLabel: { fontSize: 13, fontWeight: "800" },
  strengthBars: { flexDirection: "row", gap: 4 },
  strengthBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  ruleText: { fontSize: 12, color: C.muted, fontWeight: "500" },
  ruleTextOk: { color: "#166534", fontWeight: "600" },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -8,
    marginBottom: 16,
  },
  matchText: { fontSize: 12, fontWeight: "600", color: "#DC2626" },
  matchTextOk: { color: "#166534" },
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 21, 40, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 100,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.white,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0 16px 48px rgba(0,0,0,0.2)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  modalIconWrap: { marginBottom: 16 },
  modalIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.navy,
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalCtaWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  modalCta: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCtaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
