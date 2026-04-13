import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTerms } from "../contexts/TermsContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatAuthError } from "../lib/authErrors";

/** Mirrors BRIDGESOFHOPE/src/pages/auth/signup.jsx validation & user_metadata. */
export default function SignupScreen() {
  const router = useRouter();
  const { acceptTerms, setAcceptTerms } = useTerms();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [street, setStreet] = useState("");
  const [houseBlockLot, setHouseBlockLot] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    middleInitial?: string;
    contactNumber?: string;
    province?: string;
    municipality?: string;
    street?: string;
    houseBlockLot?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const handleContactNumberChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 13);
    setContactNumber(cleaned);
    if (fieldErrors.contactNumber) {
      setFieldErrors((prev) => ({ ...prev, contactNumber: undefined }));
    }
  };

  const getPasswordStrength = (value: string) => {
    const hasMinLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpace = /\s/.test(value);

    if (!value) {
      return {
        message:
          "Use at least 8 characters with one uppercase letter and one number (special characters optional).",
        color: "#999999",
      };
    }
    if (hasSpace) {
      return { message: "Password must not contain spaces.", color: "#E53935" };
    }
    if (!hasMinLength || !hasUpper || !hasNumber) {
      return {
        message:
          "Weak password. Add uppercase, a number, and use at least 8 characters.",
        color: "#E53935",
      };
    }
    return { message: "Strong password.", color: "#43A047" };
  };

  const validateForm = () => {
    const errors: typeof fieldErrors = {};

    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";
    if (
      middleInitial.trim() &&
      !/^[A-Za-z]$/.test(middleInitial.trim())
    ) {
      errors.middleInitial = "Middle initial must be one letter";
    }
    if (!contactNumber.trim()) {
      errors.contactNumber = "Contact number is required";
    } else if (!/^[0-9]{10,13}$/.test(contactNumber.trim())) {
      errors.contactNumber = "Contact number must be 10-13 digits";
    }
    if (!province.trim()) errors.province = "Province is required";
    if (!municipality.trim()) {
      errors.municipality = "Municipality / City is required";
    }
    if (!street.trim()) {
      errors.street = "Street / Barangay is required";
    }
    if (!houseBlockLot.trim()) {
      errors.houseBlockLot = "House # / Block / Lot is required";
    }
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errors.email = "Invalid email format";
    }

    const p = password;
    if (!p.trim()) {
      errors.password = "Password is required";
    } else if (/\s/.test(p)) {
      errors.password = "Password must not contain spaces.";
    } else if (p.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (!/[A-Z]/.test(p)) {
      errors.password = "Password must include at least one uppercase letter.";
    } else if (!/\d/.test(p)) {
      errors.password = "Password must include at least one number.";
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    if (!acceptTerms) {
      errors.terms = "You must agree to the terms";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAccount = async () => {
    setFormError(null);
    if (!validateForm()) return;

    if (!isSupabaseConfigured()) {
      setFormError(
        "Missing Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env."
      );
      return;
    }

    const first = firstName.trim();
    const last = lastName.trim();
    const middle = middleInitial.trim();
    const fullName = middle
      ? `${first} ${middle.toUpperCase()}. ${last}`
      : `${first} ${last}`;

    const prov = province.trim();
    const mun = municipality.trim();
    const str = street.trim();
    const hb = houseBlockLot.trim();
    const addressLine = [hb, str, mun, prov].filter(Boolean).join(", ");

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: first,
          last_name: last,
          middle_initial: middle.toUpperCase() || null,
          full_name: fullName,
          contact_number: contactNumber.trim(),
          province: prov,
          municipality: mun,
          street: str,
          house_block_lot: hb,
          address: addressLine,
          account_type: "family",
        },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    if (data.user?.id) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: fullName,
          phone: contactNumber.trim(),
          account_type: "family",
          province: prov,
          municipality: mun,
          street: str,
          house_block_lot: hb,
        },
        { onConflict: "id" }
      );
      if (profileError) {
        console.warn("[signup] profile upsert failed:", profileError.message);
      }
    }

    router.replace("/login");
  };

  const hasError = (key: keyof typeof fieldErrors) => !!fieldErrors[key];

  useEffect(() => {
    if (!formError) return;
    const timer = setTimeout(() => setFormError(null), 5000);
    return () => clearTimeout(timer);
  }, [formError]);

  const clearFieldError = (key: keyof typeof fieldErrors) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
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

        {formError && (
          <View style={[styles.banner, styles.bannerSpacing]}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.bannerText}>{formError}</Text>
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
                placeholder="Enter first name"
                placeholderTextColor="#B0B0B0"
                value={firstName}
                onChangeText={(t) => {
                  setFirstName(t);
                  clearFieldError("firstName");
                }}
              />
            </View>
            {fieldErrors.firstName && (
              <Text style={styles.errorText}>{fieldErrors.firstName}</Text>
            )}

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
                placeholder="Enter last name"
                placeholderTextColor="#B0B0B0"
                value={lastName}
                onChangeText={(t) => {
                  setLastName(t);
                  clearFieldError("lastName");
                }}
              />
            </View>
            {fieldErrors.lastName && (
              <Text style={styles.errorText}>{fieldErrors.lastName}</Text>
            )}

            <Text style={styles.label}>Middle Initial (Optional)</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("middleInitial") && styles.inputErrorBorder,
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
                placeholder="e.g. A"
                placeholderTextColor="#B0B0B0"
                value={middleInitial}
                onChangeText={(text) => {
                  const cleaned = text
                    .replace(/[^a-zA-Z]/g, "")
                    .slice(0, 1)
                    .toUpperCase();
                  setMiddleInitial(cleaned);
                  clearFieldError("middleInitial");
                }}
                autoCapitalize="characters"
                maxLength={1}
              />
            </View>
            {fieldErrors.middleInitial && (
              <Text style={styles.errorText}>{fieldErrors.middleInitial}</Text>
            )}

            <Text style={styles.label}>Contact Number</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("contactNumber") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter contact number"
                placeholderTextColor="#B0B0B0"
                value={contactNumber}
                onChangeText={handleContactNumberChange}
                keyboardType="phone-pad"
                maxLength={13}
                textContentType="telephoneNumber"
              />
            </View>
            {fieldErrors.contactNumber && (
              <Text style={styles.errorText}>{fieldErrors.contactNumber}</Text>
            )}

            <Text style={styles.sectionLabel}>Address</Text>

            <Text style={styles.label}>Province</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("province") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Cavite"
                placeholderTextColor="#B0B0B0"
                value={province}
                onChangeText={(t) => {
                  setProvince(t);
                  clearFieldError("province");
                }}
                autoComplete="postal-address-region"
              />
            </View>
            {fieldErrors.province && (
              <Text style={styles.errorText}>{fieldErrors.province}</Text>
            )}

            <Text style={styles.label}>Municipality / City</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("municipality") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="business-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Imus City"
                placeholderTextColor="#B0B0B0"
                value={municipality}
                onChangeText={(t) => {
                  setMunicipality(t);
                  clearFieldError("municipality");
                }}
                autoComplete="postal-address-locality"
              />
            </View>
            {fieldErrors.municipality && (
              <Text style={styles.errorText}>{fieldErrors.municipality}</Text>
            )}

            <Text style={styles.label}>Street / Barangay</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("street") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="navigate-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Street name or barangay"
                placeholderTextColor="#B0B0B0"
                value={street}
                onChangeText={(t) => {
                  setStreet(t);
                  clearFieldError("street");
                }}
                autoComplete="street-address"
              />
            </View>
            {fieldErrors.street && (
              <Text style={styles.errorText}>{fieldErrors.street}</Text>
            )}

            <Text style={styles.label}>House # / Block / Lot</Text>
            <View
              style={[
                styles.inputContainer,
                hasError("houseBlockLot") && styles.inputErrorBorder,
              ]}
            >
              <Ionicons
                name="home-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Blk 2 Lot 15"
                placeholderTextColor="#B0B0B0"
                value={houseBlockLot}
                onChangeText={(t) => {
                  setHouseBlockLot(t);
                  clearFieldError("houseBlockLot");
                }}
              />
            </View>
            {fieldErrors.houseBlockLot && (
              <Text style={styles.errorText}>{fieldErrors.houseBlockLot}</Text>
            )}

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
                placeholder="Enter your email"
                placeholderTextColor="#B0B0B0"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearFieldError("email");
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            {fieldErrors.email && (
              <Text style={styles.errorText}>{fieldErrors.email}</Text>
            )}

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
                placeholder="Create Password"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hidePassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearFieldError("password");
                }}
              />
              <TouchableOpacity onPress={() => setHidePassword((v) => !v)}>
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
                placeholder="Confirm Password"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hideConfirmPassword}
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  clearFieldError("confirmPassword");
                }}
              />
              <TouchableOpacity
                onPress={() => setHideConfirmPassword((v) => !v)}
              >
                <Ionicons
                  name={
                    hideConfirmPassword ? "eye-outline" : "eye-off-outline"
                  }
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {fieldErrors.confirmPassword && (
              <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>
            )}

            <View style={styles.termsRow}>
              <TouchableOpacity
                style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}
                onPress={() => {
                  setAcceptTerms(!acceptTerms);
                  clearFieldError("terms");
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
                  <Text style={styles.linkText}>Terms</Text>
                </TouchableOpacity>
              </View>
            </View>
            {fieldErrors.terms && (
              <Text style={styles.errorText}>{fieldErrors.terms}</Text>
            )}

            <TouchableOpacity
              style={[styles.createButton, submitting && { opacity: 0.7 }]}
              onPress={handleCreateAccount}
              disabled={submitting}
            >
              <Text style={styles.createButtonText}>
                {submitting ? "Creating account…" : "Create Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginPromptRow}>
              <Text style={styles.loginPromptText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={styles.loginPromptLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
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
    flex: 1,
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 4,
    marginBottom: 8,
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
  loginPromptRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
    flexWrap: "wrap",
  },
  loginPromptText: {
    fontSize: 14,
    color: "#777",
  },
  loginPromptLink: {
    fontSize: 14,
    color: "#F54E25",
    fontWeight: "700",
  },
});
