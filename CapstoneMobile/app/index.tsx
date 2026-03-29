import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkNavigation = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace("/tabs/home");
          return;
        }

        const hasOpened = await AsyncStorage.getItem("hasOpened");

        if (hasOpened === "true") {
          router.replace("/login");
        } else {
          router.replace("/onboarding");
        }
      } catch {
        router.replace("/onboarding");
      } finally {
        setLoading(false);
      }
    };

    checkNavigation();
  }, []);
  return (
    <View style={styles.container}>
      {/* This shows while the app is deciding where to go */}
      <ActivityIndicator size="large" color="#F54E25" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});