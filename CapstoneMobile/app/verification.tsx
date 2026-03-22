import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, Image} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function VerificationScreen() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const inputRefs = useRef<any[]>([]);

  const handleChangeDigit = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, "").slice(0, 1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });

    if (numeric && index < code.length - 1) {
      const nextRef = inputRefs.current[index + 1];
      nextRef?.focus();
    }
  };

  const handleVerify = () => {
    const joined = code.join("");
    if (joined.length !== 4) {
      console.warn("Please enter the 4-digit verification code.");
      return;
    }

    console.log("Verifying code:", joined);
    // TODO: Hook up to your verification backend / auth flow.
    // On success, navigate to create-new-password screen.
    router.push("/newpassword");
  };

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const handleGoToSignup = () => {
    router.push("/signup");
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
            <Text style={styles.screenTitle}>Verification</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Enter Verification Code</Text>

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
                    keyboardType="number-pad"
                    maxLength={1}
                    returnKeyType={index === code.length - 1 ? "done" : "next"}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={handleBackToLogin}
            >
              <Text style={styles.backToLoginText}>Back to Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
              <Text style={styles.verifyButtonText}>Verify</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity style={styles.googleButton}>
              <Image
                source={require("../assets/images/google-logo.png")}
                style={styles.googleIcon}
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={handleGoToSignup}>
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
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  codeBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  codeInput: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    color: "#000",
    width: "100%",
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

