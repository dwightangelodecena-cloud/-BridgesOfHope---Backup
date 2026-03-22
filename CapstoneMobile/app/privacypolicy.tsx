import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTerms } from "../contexts/TermsContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using the Clinic Admission and Patient Management System, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the System.",
  },
  {
    title: "2. Purpose of the System",
    body: "The System is designed to facilitate clinic admissions, patient registration, and management of patient records. It is intended for use by authorized healthcare providers and administrative staff only.",
  },
  {
    title: "3. User Eligibility and Accounts",
    body: "You must be at least 18 years of age and have the authority to represent the clinic or organization to create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.",
  },
  {
    title: "4. Data Collection and Privacy",
    body: "The System collects and processes personal and health information in accordance with applicable privacy laws. By using the System, you consent to the collection, use, and disclosure of information as described in our Privacy Policy.",
  },
  {
    title: "5. Use of the System",
    body: "You agree to use the System only for lawful purposes and in compliance with these Terms. You shall not misuse, interfere with, or attempt to gain unauthorized access to the System or its data.",
  },
  {
    title: "6. Intellectual Property",
    body: "All content, features, and functionality of the System are owned by the provider and are protected by intellectual property laws. You may not copy, modify, or distribute any part of the System without prior written consent.",
  },
  {
    title: "7. Confidentiality and Security",
    body: "You agree to maintain the confidentiality of all patient and clinic data accessed through the System. Appropriate security measures must be followed to protect sensitive information.",
  },
  {
    title: "8. Limitation of Liability",
    body: "The System is provided \"as is.\" To the fullest extent permitted by law, the provider shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the System.",
  },
  {
    title: "9. Indemnification",
    body: "You agree to indemnify and hold harmless the provider from any claims, damages, or expenses arising from your use of the System or violation of these Terms.",
  },
  {
    title: "10. Modifications",
    body: "We reserve the right to modify these Terms at any time. Continued use of the System after changes constitutes acceptance of the revised Terms. We will notify users of material changes where required.",
  },
  {
    title: "11. Termination",
    body: "We may suspend or terminate your access to the System at any time for violation of these Terms or for any other reason. You may also terminate your account by contacting us.",
  },
  {
    title: "12. Governing Law",
    body: "These Terms shall be governed by the laws of the jurisdiction in which the provider operates. Any disputes shall be resolved in the appropriate courts of that jurisdiction.",
  },
  {
    title: "13. Contact Information",
    body: "For questions about these Terms and Conditions, please contact us through the contact details provided in the System or on our official website.",
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { acceptTerms: agreed, setAcceptTerms } = useTerms();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>

          <Text style={styles.title}>TERMS AND CONDITION OF USE</Text>
          <Text style={styles.subtitle}>
            Clinic Admission and Patient Management System
          </Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {SECTIONS.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.footerStatement}>
            By selecting "I Agree" or continuing to use the System, you confirm
            your acceptance of these Terms and Conditions.
          </Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAcceptTerms(!agreed)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>
              I agree to the Privacy Policy and Terms of Service
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.82,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
    paddingRight: 32,
  },
  subtitle: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 12,
    color: "#444",
    lineHeight: 18,
  },
  footerStatement: {
    fontSize: 11,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
    fontStyle: "italic",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#F54E25",
    borderColor: "#F54E25",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: "#666",
  },
});
