import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { TAB_ROUTES } from "../lib/navigationConfig";

const touchPresence = async (userId?: string) => {
  if (!userId) return;
  try {
    const now = new Date().toISOString();
    await supabase
      .from("profiles")
      .update({
        last_active_at: now,
        updated_at: now,
      })
      .eq("id", userId);
  } catch {
    // Presence sync should not block navigation.
  }
};

export default function Index() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkNavigation = async () => {
      try {
        if (isSupabaseConfigured()) {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            const msg = String(sessionError.message || "").toLowerCase();
            const isInvalidRefresh =
              msg.includes("invalid refresh token") || msg.includes("refresh token not found");
            if (isInvalidRefresh) {
              // Clear only local auth state so stale refresh tokens do not block app startup.
              await supabase.auth.signOut({ scope: "local" });
            } else {
              throw sessionError;
            }
          }

          if (session) {
            await touchPresence(session.user?.id);
            router.replace(TAB_ROUTES.home);
            return;
          }
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