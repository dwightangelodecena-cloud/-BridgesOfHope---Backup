import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useTerms } from "../contexts/TermsContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatAuthError } from "../lib/authErrors";
import { goBackOrReplace } from "../lib/navigationConfig";
import { SIGNUP_CONSENT_STORAGE_KEY } from "../lib/legalDocuments";
import {
  getPasswordPolicyError,
  getPasswordStrengthChecks,
  PASSWORD_MIN_LENGTH,
} from "../lib/passwordPolicy";
import { PsgcSearchableSelect } from "../components/PsgcSearchableSelect";
import { usePsgcAddressCascade } from "../hooks/usePsgcAddressCascade";
import {
  getAddressStorageKey,
  loadAddressDraft,
  saveAddressDraft,
} from "../lib/addressPersistence";
import { LoginField } from "../components/auth/LoginField";
import { ScalePressable } from "../components/auth/ScalePressable";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
  white: "#FFFFFF",
};

const LEARN_ABOUT_OPTIONS = [
  { value: "", label: "Select an option" },
  { value: "social_media", label: "Social Media" },
  { value: "friend_family", label: "Friend or Family" },
  { value: "healthcare_provider", label: "Healthcare Provider" },
  { value: "hospital_clinic", label: "Hospital / Clinic" },
  { value: "online_search", label: "Online Search" },
  { value: "event_seminar", label: "Event or Seminar" },
  { value: "other", label: "Other" },
];

const PASSWORD_REQS = [
  { key: "lengthOk" as const, label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { key: "upper" as const, label: "One uppercase letter" },
  { key: "lower" as const, label: "One lowercase letter" },
  { key: "number" as const, label: "One number" },
  { key: "special" as const, label: "One special character (! @ # $ % …)" },
  { key: "noSpaces" as const, label: "No spaces" },
];

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const {
    acceptTerms,
    acceptPrivacy,
    hasReadTerms,
    hasReadPrivacy,
    setAcceptTerms,
    setAcceptPrivacy,
  } = useTerms();

  const canCreateAccount =
    hasReadTerms && hasReadPrivacy && acceptTerms && acceptPrivacy;

  useEffect(() => {
    if (hasReadTerms) setAcceptTerms(true);
  }, [hasReadTerms, setAcceptTerms]);

  useEffect(() => {
    if (hasReadPrivacy) setAcceptPrivacy(true);
  }, [hasReadPrivacy, setAcceptPrivacy]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const consent = await AsyncStorage.getItem(SIGNUP_CONSENT_STORAGE_KEY);
        if (mounted && !consent) router.replace("/consent" as never);
      } catch {
        if (mounted) router.replace("/consent" as never);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

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
  const [email, setEmail] = useState("");
  const [learnAboutUs, setLearnAboutUs] = useState("");
  const [learnPickerOpen, setLearnPickerOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const pwChecks = useMemo(() => getPasswordStrengthChecks(password), [password]);
  const learnAboutLabel =
    LEARN_ABOUT_OPTIONS.find((o) => o.value === learnAboutUs)?.label ?? "Select an option";

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
    provinceKind: "province" as "province" | "region",
    cityCode: "",
    barangayCode: "",
  });
  const [addressRestored, setAddressRestored] = useState(false);
  const addressKey = getAddressStorageKey("signup");

  useEffect(() => {
    if (loadingProvinces) return;
    let cancelled = false;
    void (async () => {
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

  useEffect(() => {
    if (!formError) return;
    const timer = setTimeout(() => setFormError(null), 5000);
    return () => clearTimeout(timer);
  }, [formError]);

  const hasError = (key: string) => !!fieldErrors[key];

  const clearFieldError = (key: string) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleContactNumberChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 13);
    setContactNumber(cleaned);
    clearFieldError("contactNumber");
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";
    if (middleInitial.trim() && !/^[A-Za-z]$/.test(middleInitial.trim())) {
      errors.middleInitial = "Middle initial must be one letter";
    }
    if (!contactNumber.trim()) {
      errors.contactNumber = "Contact number is required";
    } else if (!/^[0-9]{10,13}$/.test(contactNumber.trim())) {
      errors.contactNumber = "Contact number must be 10-13 digits";
    }
    if (!addr.province.trim()) errors.province = "Province is required";
    if (!addr.municipality.trim()) errors.municipality = "Municipality / City is required";
    if (!addr.barangay.trim()) errors.barangay = "Barangay is required";
    if (!addr.street.trim()) {
      errors.street = "Street is required";
    } else if (addr.street.trim().length < 2) {
      errors.street = "Enter a valid street (at least 2 characters)";
    }
    if (!houseBlockLot.trim()) errors.houseBlockLot = "House # / Block / Lot is required";
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errors.email = "Invalid email format";
    }
    if (!learnAboutUs) errors.learnAboutUs = "Please tell us how you learned about us";

    const pwErr = getPasswordPolicyError(password);
    if (pwErr) errors.password = pwErr;

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    if (!hasReadTerms) {
      errors.terms = "Please read the Terms and Conditions of Use to the end.";
    } else if (!acceptTerms) {
      errors.terms = "You must agree to the Terms and Conditions of Use.";
    }
    if (!hasReadPrivacy) {
      errors.privacy = "Please read the Privacy Policy to the end.";
    } else if (!acceptPrivacy) {
      errors.privacy = "You must agree to the Privacy Policy.";
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
    const learnLabel =
      LEARN_ABOUT_OPTIONS.find((o) => o.value === learnAboutUs)?.label || learnAboutUs;

    setSubmitting(true);
    try {
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
            learn_about_us: learnAboutUs,
            learn_about_us_label: learnLabel,
            account_type: "family",
          },
        },
      });

      if (error) {
        setFormError(formatAuthError(error));
        return;
      }

      if (!data.user) {
        setFormError("Sign up did not complete. Please try again.");
        return;
      }

      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setFormError("This email is already registered. Try signing in or use Forgot password.");
        return;
      }

      if (data.user.id) {
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

      const needsEmailConfirm = !data.session;
      try {
        await AsyncStorage.setItem(
          "bh_post_signup",
          needsEmailConfirm ? "check_email" : "welcome"
        );
      } catch {
        /* non-blocking */
      }
      router.replace("/login");
    } finally {
      setSubmitting(false);
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
          onPress={() => goBackOrReplace(router, "/consent")}
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
              <Ionicons name="person-add-outline" size={30} color="#fff" />
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

          <Text style={styles.heroEyebrow}>ACCOUNT SETUP</Text>
          <Text style={styles.heroTitle}>Sign up</Text>
          <Text style={styles.heroSubtitle}>
            Create your family member account for the Kalinga Family Portal
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
          >
            {formError ? (
              <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.bannerText, styles.bannerErrorText]}>{formError}</Text>
                <TouchableOpacity onPress={() => setFormError(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Family member name</Text>

            <LoginField
              label="First name"
              icon="person-outline"
              placeholder="First name"
              value={firstName}
              error={hasError("firstName")}
              onChangeText={(t) => {
                setFirstName(t);
                clearFieldError("firstName");
              }}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {fieldErrors.firstName ? (
              <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>
            ) : null}

            <LoginField
              label="Last name"
              icon="person-outline"
              placeholder="Last name"
              value={lastName}
              error={hasError("lastName")}
              onChangeText={(t) => {
                setLastName(t);
                clearFieldError("lastName");
              }}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {fieldErrors.lastName ? (
              <Text style={styles.fieldError}>{fieldErrors.lastName}</Text>
            ) : null}

            <LoginField
              label="Middle initial (optional)"
              icon="person-outline"
              placeholder="e.g. A"
              value={middleInitial}
              error={hasError("middleInitial")}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
                setMiddleInitial(cleaned);
                clearFieldError("middleInitial");
              }}
              autoCapitalize="characters"
              maxLength={1}
              returnKeyType="next"
            />
            {fieldErrors.middleInitial ? (
              <Text style={styles.fieldError}>{fieldErrors.middleInitial}</Text>
            ) : null}

            <View style={styles.addressSection}>
              <View style={styles.addressHead}>
                <LinearGradient
                  colors={["#FFF7ED", "#FFEDD5"]}
                  style={styles.addressBadge}
                >
                  <Ionicons name="location-outline" size={18} color="#EA580C" />
                </LinearGradient>
                <View style={styles.addressHeadCopy}>
                  <Text style={styles.addressTitle}>Address</Text>
                  <Text style={styles.addressSubtitle}>
                    Complete province, city, then barangay.
                  </Text>
                </View>
              </View>

              {addressRestored ? (
                <Text style={styles.addressRestored}>
                  We restored your last address on this device. Review and update if needed.
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

              <View style={styles.addressCard}>
                <PsgcSearchableSelect
                  label="Province"
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
                  inCard
                />

                <PsgcSearchableSelect
                  label="City / Municipality"
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
                  inCard
                />

                <PsgcSearchableSelect
                  label="Barangay"
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
                  inCard
                />

                <LoginField
                  label="Street / Building Line"
                  icon="navigate-outline"
                  placeholder="Enter block, lot, street, or building (e.g. Blk 2 Lot 15)"
                  value={addr.street}
                  error={hasError("street")}
                  onChangeText={(t) => {
                    setAddr((a) => ({ ...a, street: t }));
                    clearFieldError("street");
                  }}
                  autoComplete="street-address"
                />
                <Text style={styles.streetHint}>
                  Block, lot, street, building, or subdivision (not in the lists above).
                </Text>
                {fieldErrors.street ? (
                  <Text style={styles.fieldError}>{fieldErrors.street}</Text>
                ) : null}
              </View>
            </View>

            <LoginField
              label="House # / Block / Lot"
              icon="home-outline"
              placeholder="e.g. Blk 2 Lot 15"
              value={houseBlockLot}
              error={hasError("houseBlockLot")}
              onChangeText={(t) => {
                setHouseBlockLot(t);
                clearFieldError("houseBlockLot");
              }}
            />
            {fieldErrors.houseBlockLot ? (
              <Text style={styles.fieldError}>{fieldErrors.houseBlockLot}</Text>
            ) : null}

            <LoginField
              label="Contact number"
              icon="call-outline"
              placeholder="Enter contact number"
              value={contactNumber}
              error={hasError("contactNumber")}
              onChangeText={handleContactNumberChange}
              keyboardType="phone-pad"
              maxLength={13}
              textContentType="telephoneNumber"
            />
            {fieldErrors.contactNumber ? (
              <Text style={styles.fieldError}>{fieldErrors.contactNumber}</Text>
            ) : null}

            <LoginField
              label="Email address"
              icon="mail-outline"
              placeholder="Enter your email"
              value={email}
              error={hasError("email")}
              onChangeText={(t) => {
                setEmail(t);
                clearFieldError("email");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {fieldErrors.email ? (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>How did you learn about us?</Text>
            <TouchableOpacity
              style={[
                styles.learnShell,
                hasError("learnAboutUs") && styles.learnShellError,
              ]}
              onPress={() => setLearnPickerOpen(true)}
              activeOpacity={0.85}
            >
              <View style={styles.learnIconBox}>
                <Ionicons name="help-circle-outline" size={18} color={C.muted} />
              </View>
              <Text
                style={[styles.learnText, !learnAboutUs && styles.learnPlaceholder]}
                numberOfLines={1}
              >
                {learnAboutLabel}
              </Text>
              <Ionicons name="chevron-down" size={18} color={C.muted} />
            </TouchableOpacity>
            {fieldErrors.learnAboutUs ? (
              <Text style={styles.fieldError}>{fieldErrors.learnAboutUs}</Text>
            ) : null}

            <LoginField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Create password"
              value={password}
              secureTextEntry={hidePassword}
              error={hasError("password")}
              onChangeText={(t) => {
                setPassword(t);
                clearFieldError("password");
              }}
              autoCapitalize="none"
              textContentType="newPassword"
              rightElement={
                <TouchableOpacity onPress={() => setHidePassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={hidePassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={C.muted}
                  />
                </TouchableOpacity>
              }
            />
            {fieldErrors.password ? (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            ) : null}

            <View style={styles.passwordReqs}>
              {PASSWORD_REQS.map((req) => {
                const met = pwChecks[req.key];
                return (
                  <View key={req.key} style={styles.reqRow}>
                    <Ionicons
                      name={met ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={met ? "#059669" : "#94A3B8"}
                    />
                    <Text style={[styles.reqText, met && styles.reqTextMet]}>{req.label}</Text>
                  </View>
                );
              })}
            </View>

            <LoginField
              label="Confirm password"
              icon="lock-closed-outline"
              placeholder="Confirm password"
              value={confirmPassword}
              secureTextEntry={hideConfirmPassword}
              error={hasError("confirmPassword")}
              onChangeText={(t) => {
                setConfirmPassword(t);
                clearFieldError("confirmPassword");
              }}
              autoCapitalize="none"
              textContentType="newPassword"
              rightElement={
                <TouchableOpacity
                  onPress={() => setHideConfirmPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={hideConfirmPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={C.muted}
                  />
                </TouchableOpacity>
              }
            />
            {fieldErrors.confirmPassword ? (
              <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
            ) : null}

            <View style={styles.termsList}>
              <TouchableOpacity
                style={[styles.termsRow, !hasReadTerms && styles.termsRowDisabled]}
                onPress={() => {
                  if (!hasReadTerms) return;
                  setAcceptTerms(!acceptTerms);
                  clearFieldError("terms");
                }}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms, disabled: !hasReadTerms }}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptTerms && styles.checkboxOn,
                    !hasReadTerms && styles.checkboxDisabled,
                  ]}
                >
                  {acceptTerms ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                </View>
                <Text style={styles.termsText}>
                  I have read and agree to the{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/terms")}>
                    Terms and Conditions of Use
                  </Text>
                  {!hasReadTerms ? " (open and scroll to the end first)" : ""}
                </Text>
              </TouchableOpacity>
              {fieldErrors.terms ? (
                <Text style={styles.fieldError}>{fieldErrors.terms}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.termsRow, !hasReadPrivacy && styles.termsRowDisabled]}
                onPress={() => {
                  if (!hasReadPrivacy) return;
                  setAcceptPrivacy(!acceptPrivacy);
                  clearFieldError("privacy");
                }}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptPrivacy, disabled: !hasReadPrivacy }}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptPrivacy && styles.checkboxOn,
                    !hasReadPrivacy && styles.checkboxDisabled,
                  ]}
                >
                  {acceptPrivacy ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                </View>
                <Text style={styles.termsText}>
                  I have read and agree to the{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/privacypolicy")}>
                    Privacy Policy
                  </Text>
                  {!hasReadPrivacy ? " (open and scroll to the end first)" : ""}
                </Text>
              </TouchableOpacity>
              {fieldErrors.privacy ? (
                <Text style={styles.fieldError}>{fieldErrors.privacy}</Text>
              ) : null}
            </View>

            <ScalePressable
              onPress={() => void handleCreateAccount()}
              disabled={submitting || !canCreateAccount}
              style={[styles.ctaWrap, (submitting || !canCreateAccount) && styles.ctaDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <LinearGradient
                colors={
                  submitting || !canCreateAccount
                    ? ["#CBD5E1", "#94A3B8"]
                    : [C.orangeLight, C.orange, C.orangeDark]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Create account</Text>
                )}
              </LinearGradient>
            </ScalePressable>

            <View style={styles.signInRow}>
              <Text style={styles.signInMuted}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={styles.signInLink}> Sign in</Text>
              </TouchableOpacity>
            </View>

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

      <Modal
        visible={learnPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLearnPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setLearnPickerOpen(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How did you learn about us?</Text>
              <TouchableOpacity onPress={() => setLearnPickerOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={LEARN_ABOUT_OPTIONS.filter((o) => o.value)}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    learnAboutUs === item.value && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setLearnAboutUs(item.value);
                    clearFieldError("learnAboutUs");
                    setLearnPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      learnAboutUs === item.value && styles.modalItemTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {learnAboutUs === item.value ? (
                    <Ionicons name="checkmark" size={18} color={C.orange} />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    paddingBottom: 28,
    minHeight: 176,
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
    fontSize: 20,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: -8,
    marginBottom: 10,
    fontWeight: "500",
  },
  addressSection: { marginBottom: 8 },
  addressHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  addressBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  addressHeadCopy: { flex: 1 },
  addressTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  addressSubtitle: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
  },
  addressRestored: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "500",
    marginBottom: 10,
    paddingLeft: 52,
  },
  fetchBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  fetchBannerText: { flex: 1, fontSize: 12, color: "#991B1B" },
  fetchDismiss: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  addressCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 4,
    ...Platform.select({
      web: { boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)" },
      default: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  streetHint: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: -6,
    marginBottom: 8,
    lineHeight: 16,
  },
  learnShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    minHeight: 52,
    marginBottom: 14,
  },
  learnShellError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  learnIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  learnText: { flex: 1, fontSize: 14, color: C.navy, fontWeight: "500" },
  learnPlaceholder: { color: "#94A3B8" },
  passwordReqs: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 12,
    marginTop: -8,
    marginBottom: 14,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  reqText: { fontSize: 12, color: C.muted, fontWeight: "500" },
  reqTextMet: { color: "#059669", fontWeight: "600" },
  termsList: { marginBottom: 16, gap: 8 },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    backgroundColor: "#FAFBFC",
  },
  termsRowDisabled: { opacity: 0.75 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    backgroundColor: "#fff",
  },
  checkboxOn: { backgroundColor: C.orange, borderColor: C.orange },
  checkboxDisabled: { backgroundColor: "#F1F5F9" },
  termsText: { flex: 1, fontSize: 13, color: C.muted, lineHeight: 19 },
  termsLink: {
    color: C.orange,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
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
  ctaDisabled: { opacity: 0.9 },
  cta: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  signInMuted: { fontSize: 14, color: C.muted },
  signInLink: { fontSize: 14, fontWeight: "800", color: C.orange },
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
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 21, 40, 0.45)",
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: C.navy },
  modalClose: { fontSize: 14, fontWeight: "700", color: C.orange },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  modalItemActive: { backgroundColor: "#FFF7F4" },
  modalItemText: { fontSize: 15, color: C.navy, fontWeight: "500" },
  modalItemTextActive: { color: C.orange, fontWeight: "700" },
});
