import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function NewPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

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

  const handleConfirmNewPassword = () => {
    setWarningMessage(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setWarningMessage("Please fill in necessary inputs.");
      return;
    }

    if (password !== confirmPassword) {
      setWarningMessage("Passwords do not match.");
      return;
    }

    console.log("New password confirmed");
    // TODO: Hook this into your real reset-password flow
    setPasswordChanged(true);
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
            <Text style={styles.screenTitle}>New Password</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Enter New Password</Text>
            <View style={[styles.inputContainer, styles.passwordInputContainer]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="*************"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hidePassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (warningMessage) setWarningMessage(null);
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

            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="*************"
                placeholderTextColor="#B0B0B0"
                secureTextEntry={hideConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (warningMessage) setWarningMessage(null);
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
            {warningMessage && (
              <Text style={styles.confirmErrorText}>{warningMessage}</Text>
            )}

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmNewPassword}
            >
              <Text style={styles.confirmButtonText}>Confirm New Password</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {passwordChanged && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Password Changed!</Text>
              <Text style={styles.modalMessage}>
                Your password has been updated successfully.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setPasswordChanged(false);
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 40,
  },
  confirmErrorText: {
    fontSize: 12,
    color: "#E53935",
    marginTop: 4,
    marginBottom: 8,
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
    marginTop: 8,
    marginBottom: 32,
  },
  screenTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
  },
  card: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
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
    marginBottom: 16,
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
  confirmButton: {
    marginTop: 4,
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
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  passwordStrengthText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  passwordInputContainer: {
    marginBottom: 8,
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

