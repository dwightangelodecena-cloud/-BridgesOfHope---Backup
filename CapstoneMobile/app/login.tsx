import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, Animated, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatAuthError } from "../lib/authErrors";
import { TAB_ROUTES } from "../lib/navigationConfig";
import { appendActivityFeed } from "../lib/activityFeed";
import {
  ensureFamilyAccountOrSignOut,
  signInWithGoogleMobile,
} from "../lib/googleAuth";

export default function LoginScreen() {
  const REMEMBER_LOGIN_KEY = "bh_remembered_login_identifier_mobile";
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

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
    let mounted = true;
    (async () => {
      try {
        const savedIdentifier = await AsyncStorage.getItem(REMEMBER_LOGIN_KEY);
        if (mounted && savedIdentifier?.trim()) {
          setLoginIdentifier(savedIdentifier.trim());
          setRememberMe(true);
        }
      } catch {
        /* ignore remember-me read failures */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showError = (message: string) => {
    setError(message);
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setError("");
      });
    }, 3000);
  };

  const handleSignIn = async () => {
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
        /* ignore remember-me write failures */
      }
    } else {
      try {
        await AsyncStorage.removeItem(REMEMBER_LOGIN_KEY);
      } catch {
        /* ignore remember-me delete failures */
      }
    }

    router.replace(TAB_ROUTES.home);
  };

  const handleGoToSignup = () => {
    router.push("/signup");
  };

  const handleForgotPassword = () => {
    router.push("/forget");
  };

  const handleGoogle = async () => {
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
      router.replace(TAB_ROUTES.home);
    } catch (e) {
      showError(
        e instanceof Error ? e.message : "Google sign-in failed."
      );
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {error !== "" && (
        <Animated.View style={[styles.errorBox, { opacity: fadeAnim }]}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../assets/images/BOHLogo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.label}>Email Address or Contact Number</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
          <TextInput
            placeholder="Email or 11-digit contact number"
            placeholderTextColor="#AAA"
            value={loginIdentifier}
            onChangeText={setLoginIdentifier}
            style={styles.input}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor="#AAA"
            secureTextEntry={hidePassword}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            textContentType="password"
          />
          <TouchableOpacity onPress={() => setHidePassword(!hidePassword)}>
            <Ionicons 
              name={hidePassword ? "eye-outline" : "eye-off-outline"} 
              size={22} 
              color="#888" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.rememberRow}>
            <TouchableOpacity
              style={[
                styles.checkbox,
                rememberMe && styles.checkboxChecked,
              ]}
              onPress={() => setRememberMe((prev) => !prev)}
            >
              {rememberMe && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </TouchableOpacity>
            <Text style={styles.rememberText}>Remember me</Text>
          </View>
          <TouchableOpacity onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.signInButton, submitting && styles.signInButtonDisabled]}
          onPress={handleSignIn}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          disabled={submitting}
        >
          <Image 
            source={require("../assets/images/google-logo.png")}
            style={styles.googleIcon} 
          />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>{"Don't have an account? "}</Text>
          <TouchableOpacity onPress={handleGoToSignup}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorBox: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: '#E53935',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 5,
  },
  errorText: {
    color: '#fff',
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: 120,
    alignSelf: "center",
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#444",
  },
  inputContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 15,
    alignItems: "center",
    marginBottom: 20,
    height: 55,
    backgroundColor: "#FAFAFA",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#000",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#F54E25",
    borderColor: "#F54E25",
  },
  rememberText: {
    fontSize: 13,
    color: "#666",
  },
  forgotText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: "#F54E25",
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
    elevation: 3,
    shadowColor: "#F54E25",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#EEE",
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
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    backgroundColor: "#fff",
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
    marginTop: 10,
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