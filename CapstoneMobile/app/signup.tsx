import React, { useState, useEffect, useRef } from "react";
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
import { PsgcSearchableSelect } from "../components/PsgcSearchableSelect";
import { usePsgcAddressCascade } from "../hooks/usePsgcAddressCascade";
import {
  getAddressStorageKey,
  loadAddressDraft,
  saveAddressDraft,
} from "../lib/addressPersistence";

/** Mirrors BRIDGESOFHOPE/src/pages/auth/signup.jsx validation & user_metadata. */
export default function SignupScreen() {
  const router = useRouter();
  const { acceptTerms, setAcceptTerms } = useTerms();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [addr, setAddr] = useState({
    province: "",
    municipality: "",
    barangay: "",
    street: "",
  });
  const [houseBlockLot, setHouseBlockLot] = useState("");

  const {
    provinceOptions,
    cityOptions,
    barangayOptions,
    loadingProvinces,
    loadingCities,
    loadingBarangays,
    fetchError,
    setFetchError,
    onProvinceSelected,
    onCitySelected,
    onBarangaySelected,
    hydrateFromSaved,
  } = usePsgcAddressCascade({ cityFieldKey: "municipality" });

  const psgcCodesRef = useRef({
    provinceCode: "",
    provinceKind: "province",
    cityCode: "",
    barangayCode: "",
  });
  const [addressRestored, setAddressRestored] = useState(false);
  const addressKey = getAddressStorageKey("signup");

  useEffect(() => {
    if (loadingProvinces) return;
    let cancelled = false;
    (async () => {
      const saved = await loadAddressDraft(addressKey);
      if (!saved?.provinceCode || cancelled) return;
      const ok = await hydrateFromSaved(
        {
          provinceCode: saved.provinceCode!,
          provinceKind: (saved.provinceKind as "province" | "region") || "province",
          cityCode: saved.cityCode,
          barangayCode: saved.barangayCode,
          province: saved.province,
          street: saved.street,
        },
        setAddr
      );
      if (!ok || cancelled) return;
      psgcCodesRef.current = {
        provinceCode: saved.provinceCode!,
        provinceKind: saved.provinceKind || "province",
        cityCode: saved.cityCode || "",
        barangayCode: saved.barangayCode || "",
      };
      setAddressRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [addressKey, hydrateFromSaved, loadingProvinces]);

  useEffect(() => {
    const p = provinceOptions.find((o) => o.name === addr.province);
    if (p) {
      psgcCodesRef.current.provinceCode = p.code;
      psgcCodesRef.current.provinceKind = p.kind || "province";
    }
  }, [addr.province, provinceOptions]);

  useEffect(() => {
    const c = cityOptions.find((o) => o.name === addr.municipality);
    if (c) psgcCodesRef.current.cityCode = c.code;
  }, [addr.municipality, cityOptions]);

  useEffect(() => {
    const b = barangayOptions.find((o) => o.name === addr.barangay);
    if (b) psgcCodesRef.current.barangayCode = b.code;
  }, [addr.barangay, barangayOptions]);

  useEffect(() => {
    if (!addr.province.trim()) return;
    const t = setTimeout(() => {
      void saveAddressDraft(addressKey, {
        province: addr.province.trim(),
        city: addr.municipality.trim(),
        barangay: addr.barangay.trim(),
        street: addr.street.trim(),
        provinceCode: psgcCodesRef.current.provinceCode,
        provinceKind: psgcCodesRef.current.provinceKind,
        cityCode: psgcCodesRef.current.cityCode,
        barangayCode: psgcCodesRef.current.barangayCode,
      });
    }, 450);
    return () => clearTimeout(t);
  }, [addressKey, addr.province, addr.municipality, addr.barangay, addr.street]);

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
    barangay?: string;
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
    if (!addr.province.trim()) errors.province = "Province is required";
    if (!addr.municipality.trim()) {
      errors.municipality = "Municipality / City is required";
    }
    if (!addr.barangay.trim()) {
      errors.barangay = "Barangay is required";
    }
    if (!addr.street.trim()) {
      errors.street = "Street is required";
    } else if (addr.street.trim().length < 2) {
      errors.street = "Enter a valid street (at least 2 characters)";
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

    const prov = addr.province.trim();
    const mun = addr.municipality.trim();
    const brgy = addr.barangay.trim();
    const str = addr.street.trim();
    const hb = houseBlockLot.trim();
    const addressLine = [hb, str, brgy, mun, prov].filter(Boolean).join(", ");

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
          barangay: brgy,
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
          barangay: brgy,
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

            <View style={styles.addressSection}>
              <Text style={styles.addressSectionKicker}>Location</Text>
              <Text style={styles.addressSectionTitle}>Philippine address</Text>
              <Text style={styles.addressSectionSub}>
                Official PSGC data. Choose province → city → barangay, then add your street line.
              </Text>
              {addressRestored ? (
                <Text style={styles.addressRestoredHint}>
                  Restored your last address on this device — review if needed.
                </Text>
              ) : null}
              {fetchError ? (
                <View style={styles.fetchBanner}>
                  <Text style={styles.fetchBannerText}>{fetchError}</Text>
                  <TouchableOpacity onPress={() => setFetchError("")}>
                    <Text style={styles.fetchDismiss}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <PsgcSearchableSelect
                label="Province"
                description="Type to filter the list."
                icon="location-outline"
                options={provinceOptions}
                valueName={addr.province}
                onSelect={(opt) => {
                  void onProvinceSelected(opt, setAddr);
                  clearFieldError("province");
                }}
                disabled={loadingProvinces}
                loading={loadingProvinces}
                placeholder={loadingProvinces ? "Loading provinces…" : "Choose Province"}
                emptyText="No province matched."
                errorText={fieldErrors.province || ""}
              />

              <PsgcSearchableSelect
                label="City / Municipality"
                description="Loads after province."
                icon="business-outline"
                options={cityOptions}
                valueName={addr.municipality}
                onSelect={(opt) => {
                  void onCitySelected(opt, setAddr);
                  clearFieldError("municipality");
                }}
                disabled={!addr.province.trim() || loadingCities}
                loading={loadingCities}
                placeholder={
                  !addr.province.trim()
                    ? "Choose Province First"
                    : loadingCities
                      ? "Loading cities…"
                      : "Choose City / Municipality"
                }
                emptyText={loadingCities ? "Loading…" : "No match in this province."}
                errorText={fieldErrors.municipality || ""}
              />

              <PsgcSearchableSelect
                label="Barangay"
                description="Loads after city."
                icon="pin-outline"
                options={barangayOptions}
                valueName={addr.barangay}
                onSelect={(opt) => {
                  onBarangaySelected(opt, setAddr);
                  clearFieldError("barangay");
                }}
                disabled={!addr.municipality.trim() || loadingBarangays}
                loading={loadingBarangays}
                placeholder={
                  !addr.municipality.trim()
                    ? "Choose City First"
                    : loadingBarangays
                      ? "Loading barangays…"
                      : "Choose Barangay"
                }
                emptyText={loadingBarangays ? "Loading…" : "No barangay matched."}
                errorText={fieldErrors.barangay || ""}
              />

              <Text style={styles.label}>Street / Building Line</Text>
              <Text style={styles.streetSub}>
                Block, lot, street, building, or subdivision (not in the lists above).
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  hasError("street") && styles.inputErrorBorder,
                ]}
              >
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter block, lot, street, or building (e.g. Blk 2 Lot 15)"
                  placeholderTextColor="#B0B0B0"
                  value={addr.street}
                  onChangeText={(t) => {
                    setAddr((a) => ({ ...a, street: t }));
                    clearFieldError("street");
                  }}
                  autoComplete="street-address"
                />
              </View>
              {fieldErrors.street && (
                <Text style={styles.errorText}>{fieldErrors.street}</Text>
              )}
            </View>

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
  addressSection: {
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  addressSectionKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#EA580C",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  addressSectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  addressSectionSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  addressRestoredHint: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
    marginBottom: 12,
  },
  streetSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 8,
    marginTop: -4,
  },
  fetchBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  fetchBannerText: { flex: 1, fontSize: 12, color: "#991B1B" },
  fetchDismiss: { fontSize: 12, fontWeight: "700", color: "#F54E25" },
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
