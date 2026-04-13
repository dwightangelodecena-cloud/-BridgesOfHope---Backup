import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TAB_ROUTES } from "../lib/navigationConfig";
import {
  ensureFamilyAccountOrSignOut,
  signInWithGoogleMobile,
} from "../lib/googleAuth";

const emailLooksValid = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

const RECOVERY_EMAIL_KEY = "bh_recovery_email";

export default function ForgetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSendVerification = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError("Please enter an email address.");
      return;
    }

    if (!emailLooksValid(trimmed)) {
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
        email: trimmed,
        options: { shouldCreateUser: false },
      });

      if (otpErr) {
        setError(otpErr.message || "Could not send verification code.");
        return;
      }

      await AsyncStorage.setItem(RECOVERY_EMAIL_KEY, trimmed);
      router.push({
        pathname: "/verification",
        params: { email: trimmed },
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
    router.push("/signup");
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={25} color="#333" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.screenTitle}>Forgot Password?</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Enter your email address and we’ll send you a 6-digit verification
              code.
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#B0B0B0"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!sending}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
              disabled={sending}
            >
              <Text style={styles.backToLoginText}>Back to Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSendVerification}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Send Verification</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              disabled={sending}
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
            <TouchableOpacity onPress={handleGoToSignup} disabled={sending}>
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
    paddingHorizontal: 32,
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
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#D3D3D3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#000",
  },
  errorText: {
    fontSize: 13,
    color: "#E53935",
    marginBottom: 12,
    textAlign: "center",
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
  sendButton: {
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
  sendButtonDisabled: {
    opacity: 0.85,
  },
  sendButtonText: {
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
