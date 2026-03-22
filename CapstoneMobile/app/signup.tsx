import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTerms } from "../contexts/TermsContext";

export default function SignupScreen() {
  const router = useRouter();
  const { acceptTerms, setAcceptTerms } = useTerms();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);

  const [accountCreated, setAccountCreated] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const getPasswordStrength = (value: string) => {
    const hasMinLength = value.length >= 8;
    const hasLetter = /[A-Za-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    const hasSpace = /\s/.test(value);

    if (!value) {
      return {
        message:
          "Use at least 8 characters with letters, numbers, and a special character.",
        color: "#999999",
      };
    }

    if (hasSpace) {
      return {
        message: "Password must not contain spaces.",
        color: "#E53935",
      };
    }

    if (!hasMinLength || !hasLetter || !hasNumber || !hasSpecial) {
      return {
        message:
          "Weak password. Add a letter, number, and special character (min 8 characters).",
        color: "#E53935",
      };
    }

    return {
      message: "Strong password.",
      color: "#43A047",
    };
  };

  const handleCreateAccount = () => {
    const errors: typeof fieldErrors = {};

    if (!firstName.trim()) {
      errors.firstName = "Please Enter your First Name";
    }
    if (!lastName.trim()) {
      errors.lastName = "Please Enter your Last Name";
    }
    if (!email.trim() || !validateEmail(email.trim())) {
      errors.email = "Please Enter a Valid Email Address";
    }
    if (!password.trim()) {
      errors.password = "Please Create a password";
    }
    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    if (!acceptTerms) {
      errors.terms = "Please agree to the Privacy Policy and Terms of Service";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setBannerError("Please fill out necessary information");
      return;
    }

    setBannerError(null);
    // TODO: Hook up to your backend / auth flow.
    console.log("Account created:", { firstName, lastName, email });
    setAccountCreated(true);
  };

  const hasError = (key: keyof typeof fieldErrors) => !!fieldErrors[key];

  useEffect(() => {
    if (!bannerError) return;
    const timer = setTimeout(() => setBannerError(null), 3500);
    return () => clearTimeout(timer);
  }, [bannerError]);

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

        {bannerError && (
          <View style={[styles.banner, styles.bannerSpacing]}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.bannerText}>{bannerError}</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/images/BOHLogo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.card}>
            {/* First Name */}
            <Text style={styles.label}>First Name</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("firstName") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor="#B0B0B0"
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  if (fieldErrors.firstName) {
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }
                }}
              />
            </View>
            {fieldErrors.firstName && (
              <Text style={styles.errorText}>{fieldErrors.firstName}</Text>
            )}

            {/* Last Name */}
            <Text style={styles.label}>Last Name</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("lastName") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor="#B0B0B0"
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  if (fieldErrors.lastName) {
                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                  }
                }}
              />
            </View>
            {fieldErrors.lastName && (
              <Text style={styles.errorText}>{fieldErrors.lastName}</Text>
            )}

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("email") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor="#B0B0B0"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            {fieldErrors.email && (
              <Text style={styles.errorText}>{fieldErrors.email}</Text>
            )}

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputContainer,
                styles.passwordInputContainer,
                hasError("password") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hidePassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
              />
              <TouchableOpacity
                onPress={() => setHidePassword((prev) => !prev)}
              >
                <Ionicons
                  name={hidePassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {!!password && (
              <Text
                style={[
                  styles.passwordStrengthText,
                  { color: getPasswordStrength(password).color },
                ]}
              >
                {getPasswordStrength(password).message}
              </Text>
            )}
            {fieldErrors.password && (
              <Text style={styles.errorText}>{fieldErrors.password}</Text>
            )}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("confirmPassword") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hideConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }
                }}
              />
              <TouchableOpacity
                onPress={() =>
                  setHideConfirmPassword((prev) => !prev)
                }
              >
                <Ionicons
                  name={hideConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {fieldErrors.confirmPassword && (
              <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>
            )}

            {/* Terms */}
            <View style={styles.termsRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  acceptTerms && styles.checkboxChecked,
                ]}
                onPress={() => {
                  setAcceptTerms(!acceptTerms);
                  if (fieldErrors.terms) {
                    setFieldErrors((prev) => ({ ...prev, terms: undefined }));
                  }
                }}
              >
                {acceptTerms && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>
              <View style={styles.termsRowText}>
                <Text style={styles.termsText}>I agree to the </Text>
                <TouchableOpacity
                  onPress={() => router.push("/privacypolicy")}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.termsText}> and </Text>
                <TouchableOpacity
                  onPress={() => router.push("/privacypolicy")}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.linkText}>Terms of Service</Text>
                </TouchableOpacity>
              </View>
            </View>
            {fieldErrors.terms && (
              <Text style={styles.errorText}>{fieldErrors.terms}</Text>
            )}

            {/* Create Account Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateAccount}
            >
              <Text style={styles.createButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {accountCreated && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Account Created!</Text>
              <Text style={styles.modalMessage}>
                Your account has been created successfully.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setAccountCreated(false);
                  router.replace("/login");
                }}
              >
                <Text style={styles.modalButtonText}>Back to Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  bannerContainer: {
    height: 44,
    marginTop: 8,
    marginHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerSpacing: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  banner: {
    backgroundColor: "#C94A5A",
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    alignSelf: "center",
  },
  bannerText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 8,
    fontSize: 14,
  },
  scrollContainer: {
    paddingHorizontal: 30,
    paddingTop: 8,
    paddingBottom: 40,
  },
  logoContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 16,
    padding: 8,
    zIndex: 20,
  },
  logo: {
    width: "100%",
    height: 120,
  },
  card: {
    width: "100%",
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#000",
  },
  inputErrorBorder: {
    borderColor: "#E53935",
  },
  errorText: {
    fontSize: 12,
    color: "#E53935",
    marginBottom: 10,
  },
  passwordStrengthText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  passwordInputContainer: {
    marginBottom: 6,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#F54E25",
    borderColor: "#F54E25",
  },
  termsRowText: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  termsText: {
    fontSize: 12,
    color: "#555",
  },
  linkText: {
    color: "#F54E25",
    fontWeight: "600",
  },
  createButton: {
    marginTop: 24,
    backgroundColor: "#F54E25",
    height: 52,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#F54E25",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
