import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SIGNUP_CONSENT_STORAGE_KEY, INFORMED_CONSENT_READ_KEY } from "../lib/legalDocuments";

export default function ConsentScreen() {
  const router = useRouter();
  const [hasReadConsent, setHasReadConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void (async () => {
        const read = await AsyncStorage.getItem(INFORMED_CONSENT_READ_KEY);
        if (mounted && read) setHasReadConsent(true);
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const handleContinue = async () => {
    if (!hasReadConsent) {
      setError("Please open and read the Informed Consent Form to the end.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Informed Consent Form to continue.");
      return;
    }
    await AsyncStorage.setItem(SIGNUP_CONSENT_STORAGE_KEY, new Date().toISOString());
    router.push("/signup");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/login")} accessibilityLabel="Back to login">
          <Ionicons name="arrow-back" size={22} color="#1B2559" />
        </TouchableOpacity>

        <Image source={require("../assets/images/kalingalogo.png")} style={styles.logo} resizeMode="contain" />

        <Text style={styles.title}>Consent Required</Text>
        <Text style={styles.sub}>
          Before creating a family account, please read and agree to our Informed Consent Form.
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxText}>
            The consent form explains how Bridges of Hope collects and uses your information for admission
            processing, visitations, and family portal services.
          </Text>
          <TouchableOpacity
            onPress={() => {
              router.push("/informed-consent" as never);
            }}
          >
            <Text style={styles.link}>Read Informed Consent Form</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed((v) => !v)} activeOpacity={0.85}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
          </View>
          <Text style={styles.checkLabel}>
            I have read and agree to the Informed Consent Form and voluntarily consent to the collection and
            processing of my information as described.
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleContinue()}>
          <Text style={styles.primaryBtnText}>I Agree and Continue</Text>
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.loginLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContainer: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#1B2559", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  box: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  boxText: { fontSize: 14, color: "#334155", lineHeight: 20, marginBottom: 10 },
  link: { color: "#F54E25", fontWeight: "700", fontSize: 14, textDecorationLine: "underline" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: "#F54E25", borderColor: "#F54E25" },
  checkLabel: { flex: 1, fontSize: 14, color: "#475569", lineHeight: 20 },
  error: { color: "#DC2626", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  primaryBtn: {
    backgroundColor: "#F54E25",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  loginText: { color: "#64748B", fontSize: 15 },
  loginLink: { color: "#F54E25", fontWeight: "700", fontSize: 15 },
});
