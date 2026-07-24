import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  type TextInput as TextInputType,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured, ensureAuthSessionHealthy } from "../lib/supabase";
import { formatAuthError } from "../lib/authErrors";
import { TAB_ROUTES } from "../lib/navigationConfig";
import { appendActivityFeed } from "../lib/activityFeed";
import {
  ensureFamilyAccountOrSignOut,
  signInWithGoogleMobile,
} from "../lib/googleAuth";
import { LoginField } from "../components/auth/LoginField";
import { ScalePressable } from "../components/auth/ScalePressable";

const POST_SIGNUP_KEY = "bh_post_signup";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

function hapticLight() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function hapticError() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

function hapticSuccess() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export default function LoginScreen() {
  const REMEMBER_LOGIN_KEY = "bh_remembered_login_identifier_mobile";
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInputType>(null);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signupNotice, setSignupNotice] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const hasIdentifier = loginIdentifier.trim().length > 0;
  const hasPassword = password.trim().length > 0;
  const canSubmit = hasIdentifier && hasPassword && !submitting;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const touchPresence = async (userId?: string) => {
    if (!userId) return;
    try {
      const now = new Date().toISOString();
      await supabase
        .from("profiles")
        .update({
          last_active_at: now,
          last_login_at: now,
          updated_at: now,
        })
        .eq("id", userId);
    } catch {
      // Presence sync should not block login.
    }
  };

  useEffect(() => {
    void ensureAuthSessionHealthy();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const savedIdentifier = await AsyncStorage.getItem(REMEMBER_LOGIN_KEY);
        if (mounted && savedIdentifier?.trim()) {
          setLoginIdentifier(savedIdentifier.trim());
          setRememberMe(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(POST_SIGNUP_KEY);
        if (!mounted || !v) return;
        if (v === "check_email") {
          setSignupNotice("Check your email and confirm your account, then sign in.");
        } else if (v === "welcome") {
          setSignupNotice("Account created. You can sign in now.");
        }
        await AsyncStorage.removeItem(POST_SIGNUP_KEY);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    hapticError();
    setTimeout(() => setError(""), 6000);
  }, []);

  const clearMessages = () => {
    setSignupNotice("");
    setError("");
  };

  const handleSignIn = async () => {
    hapticLight();
    clearMessages();
    if (!loginIdentifier.trim() || !password.trim()) {
      showError("Please fill in all fields before signing in.");
      return;
    }

    const trimmedId = loginIdentifier.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let signInEmail = trimmedId;

    if (!emailRegex.test(trimmedId)) {
      const digits = trimmedId.replace(/\D/g, "");
      if (digits.length < 11) {
        showError("Enter a valid email or an 11-digit contact number.");
        return;
      }
      if (digits.length > 11) {
        showError("Contact number must be 11 digits.");
        return;
      }
    }

    if (password.length < 8) {
      showError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showError("Password must include at least one uppercase letter.");
      return;
    }
    if (!/\d/.test(password)) {
      showError("Password must include at least one number.");
      return;
    }

    if (!isSupabaseConfigured()) {
      showError(
        "Missing Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env."
      );
      return;
    }

    setSubmitting(true);

    if (!emailRegex.test(trimmedId)) {
      const digits = trimmedId.replace(/\D/g, "");
      const { data: rows, error: rpcError } = await supabase.rpc("resolve_login_email", {
        login_input: digits,
      });
      if (rpcError) {
        setSubmitting(false);
        showError(formatAuthError(rpcError));
        return;
      }
      const resolved = Array.isArray(rows) && rows.length > 0 ? rows[0]?.email : null;
      if (!resolved || typeof resolved !== "string") {
        setSubmitting(false);
        showError("No account found with that email or contact number.");
        return;
      }
      signInEmail = resolved;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password,
    });
    setSubmitting(false);

    if (authError) {
      showError(formatAuthError(authError));
      return;
    }

    const role = (data.user?.user_metadata?.account_type ?? "family") as string;
    if (role !== "family") {
      await supabase.auth.signOut();
      showError("Use the web app to sign in as staff.");
      return;
    }

    hapticSuccess();
    await touchPresence(data.user?.id);
    await appendActivityFeed("Logged in from mobile app.", {
      familyId: data.user?.id ?? null,
      title: "Account Login",
      iconName: "login",
    });

    if (rememberMe) {
      try {
        await AsyncStorage.setItem(REMEMBER_LOGIN_KEY, trimmedId);
      } catch {
        /* ignore */
      }
    } else {
      try {
        await AsyncStorage.removeItem(REMEMBER_LOGIN_KEY);
      } catch {
        /* ignore */
      }
    }

    router.replace(TAB_ROUTES.home);
  };

  const handleGoToSignup = () => {
    hapticLight();
    router.push("/consent" as never);
  };

  const handleForgotPassword = () => {
    hapticLight();
    router.push("/forget");
  };

  const handleGoogle = async () => {
    hapticLight();
    if (!isSupabaseConfigured()) {
      showError(
        "Missing Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env."
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await signInWithGoogleMobile();
      if (result.status === "cancelled") {
        setSubmitting(false);
        return;
      }
      if (result.status === "error") {
        showError(result.message);
        setSubmitting(false);
        return;
      }
      const roleCheck = await ensureFamilyAccountOrSignOut();
      if (roleCheck === "staff") {
        showError("Use the web app to sign in as staff.");
        setSubmitting(false);
        return;
      }
      hapticSuccess();
      router.replace(TAB_ROUTES.home);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Google sign-in failed.");
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <LinearGradient
          colors={["#0B1528", "#152238", "#2A1A28"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBurgundyWash} />

        <View style={styles.heroContent}>
          <View style={styles.logoGlowOuter}>
            <View style={styles.logoGlowMid}>
              <LinearGradient
                colors={["#FAFBFC", "#EEF1F5", "#E2E8F0"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.logoCircle}
              >
                <Image
                  source={require("../assets/images/kalingalogo.png")}
                  style={styles.logo}
                  contentFit="contain"
                  accessibilityLabel="Kalinga logo"
                />
              </LinearGradient>
            </View>
          </View>

          <Text style={styles.heroTitle}>Kalinga Family Portal</Text>
          <Text style={styles.heroSubtitle}>
            Stay connected with your loved ones
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
              { paddingBottom: insets.bottom + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formSubtitle}>
              Enter your credentials to access your account
            </Text>

            {signupNotice ? (
              <View style={[styles.banner, styles.bannerInfo]}>
                <Ionicons name="mail-unread-outline" size={18} color="#1D4ED8" />
                <Text style={[styles.bannerText, styles.bannerInfoText]}>{signupNotice}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.banner, styles.bannerError]}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{error}</Text>
                <TouchableOpacity onPress={() => setError("")} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <LoginField
              label="Email or contact number"
              icon="mail-outline"
              placeholder="you@email.com or 09XXXXXXXXX"
              value={loginIdentifier}
              error={!!error}
              showClear
              onClear={() => {
                setLoginIdentifier("");
                clearMessages();
              }}
              onChangeText={(t) => {
                clearMessages();
                setLoginIdentifier(t);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <LoginField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              value={password}
              error={!!error}
              secureTextEntry={hidePassword}
              onChangeText={(t) => {
                clearMessages();
                setPassword(t);
              }}
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSubmit) void handleSignIn();
              }}
              ref={passwordRef}
              rightElement={
                <TouchableOpacity
                  onPress={() => setHidePassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={hidePassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color={C.muted}
                  />
                </TouchableOpacity>
              }
            />

            <View style={styles.extrasRow}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => {
                  hapticLight();
                  setRememberMe((prev) => !prev);
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <ScalePressable
              onPress={handleSignIn}
              disabled={!canSubmit}
              style={[styles.ctaWrap, !canSubmit && styles.ctaDisabled]}
            >
              <LinearGradient
                colors={
                  canSubmit
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
                  <Text style={styles.ctaText}>Sign In</Text>
                )}
              </LinearGradient>
            </ScalePressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <ScalePressable
              onPress={handleGoogle}
              disabled={submitting}
              style={[styles.googleBtn, submitting && styles.googleDisabled]}
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
              <Text style={styles.footerMetaText}>Secured with end-to-end encryption</Text>
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
  root: { flex: 1, backgroundColor: "#1A2B4A" },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 38,
    minHeight: 220,
    overflow: "hidden",
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
  heroContent: { alignItems: "center", zIndex: 1 },
  logoGlowOuter: {
    borderRadius: 999,
    padding: 10,
    backgroundColor: "rgba(245, 78, 37, 0.14)",
    marginBottom: 6,
    ...Platform.select({
      web: { boxShadow: "0 0 28px rgba(245, 78, 37, 0.35)" },
      default: {
        shadowColor: "#F54E25",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 10,
      },
    }),
  },
  logoGlowMid: {
    borderRadius: 999,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  logoCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  logo: { width: 82, height: 82 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },
  sheetWrap: {
    flex: 1,
    marginTop: -22,
  },
  sheet: {
    flex: 1,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetScroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: C.muted,
    marginBottom: 22,
    lineHeight: 20,
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
  bannerInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  bannerError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerInfoText: { color: "#1D4ED8" },
  bannerErrorText: { color: "#DC2626" },
  extrasRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: -4,
    flexWrap: "wrap",
    gap: 8,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.orange, borderColor: C.orange },
  checkLabel: { fontSize: 14, color: C.muted, fontWeight: "500" },
  forgotLink: { fontSize: 14, fontWeight: "700", color: C.orange },
  ctaWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 18,
    shadowColor: C.orangeDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8EDF3" },
  dividerText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
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
