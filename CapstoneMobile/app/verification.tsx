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
  SafeAreaView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TAB_ROUTES } from "../lib/navigationConfig";
import {
  ensureFamilyAccountOrSignOut,
  signInWithGoogleMobile,
} from "../lib/googleAuth";

const OTP_LENGTH = 6;
const RECOVERY_EMAIL_KEY = "bh_recovery_email";

function paramToString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

export default function VerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [code, setCode] = useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => "")
  );
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    const numeric = value.replace(/[^0-9]/g, "").slice(0, 1);
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
    const joined = code.join("");
    if (joined.length !== OTP_LENGTH) {
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
        token: joined,
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

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const handleGoToSignup = () => {
    router.push("/signup");
  };

  const handleGoogle = async () => {
    setVerifyError(null);
    if (!isSupabaseConfigured()) {
      setVerifyError("Supabase is not configured.");
      return;
    }
    setVerifying(true);
    try {
      const result = await signInWithGoogleMobile();
      if (result.status === "cancelled") {
        setVerifying(false);
        return;
      }
      if (result.status === "error") {
        setVerifyError(result.message);
        setVerifying(false);
        return;
      }
      const roleCheck = await ensureFamilyAccountOrSignOut();
      if (roleCheck === "staff") {
        setVerifyError("Use the web app to sign in as staff.");
        setVerifying(false);
        return;
      }
      router.replace(TAB_ROUTES.home);
    } catch (e) {
      setVerifyError(
        e instanceof Error ? e.message : "Google sign-in failed."
      );
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={verifying}
        >
          <Ionicons name="arrow-back" size={25} color="#333" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.screenTitle}>Verification</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Enter Verification Code</Text>
            <Text style={styles.hint}>
              Use the 6-digit code from your email (not the magic link).
            </Text>

            {verifyError ? (
              <Text style={styles.errorText}>{verifyError}</Text>
            ) : null}

            <View style={styles.codeRow}>
              {code.map((digit, index) => (
                <View key={index} style={styles.codeBox}>
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
                    keyboardType="number-pad"
                    maxLength={1}
                    returnKeyType={
                      index === OTP_LENGTH - 1 ? "done" : "next"
                    }
                    editable={!verifying}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
              disabled={verifying}
            >
              <Text style={styles.backToLoginText}>Back to Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.verifyButton, verifying && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              disabled={verifying}
              onPress={handleGoogle}
            >
              <Image
                source={require("../assets/images/google-logo.png")}
                style={styles.googleIcon}
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>{"Don't have an account? "}</Text>
            <TouchableOpacity onPress={handleGoToSignup} disabled={verifying}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: "flex-start",
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 16,
    padding: 6,
    zIndex: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 40,
  },
  screenTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
  },
  card: {
    width: "100%",
    alignItems: "stretch",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: "#E53935",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 6,
  },
  codeBox: {
    flex: 1,
    maxWidth: 48,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  codeInput: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: "#000",
    width: "100%",
    padding: 0,
  },
  backToLoginButton: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  backToLoginText: {
    fontSize: 13,
    color: "#666",
  },
  verifyButton: {
    backgroundColor: "#F54E25",
    height: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
    shadowColor: "#F54E25",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.85,
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#000",
  },
  orText: {
    marginHorizontal: 15,
    color: "#AAA",
    fontSize: 14,
  },
  googleButton: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    height: 54,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    fontWeight: "600",
    color: "#444",
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  signupText: {
    fontSize: 14,
    color: "#777",
  },
  signupLink: {
    color: "#F54E25",
    fontWeight: "bold",
    fontSize: 14,
  },
});
