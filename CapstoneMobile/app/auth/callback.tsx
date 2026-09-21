import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { formatAuthError } from "../../lib/authErrors";
import { TAB_ROUTES } from "../../lib/navigationConfig";

/**
 * Lands here when the user taps an email link (signup confirmation, magic
 * link, etc.) and the OS hands the `capstonemobile://auth/callback` deep
 * link back to the app. Supabase appends the session as either a URL hash
 * (#access_token=...&refresh_token=...) or a PKCE ?code=... query param.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    let cancelled = false;

    (async () => {
      const url = await Linking.getInitialURL();

      if (!url || !isSupabaseConfigured()) {
        if (!cancelled) router.replace("/login");
        return;
      }

      const hash = url.split("#")[1];
      const hashParams = new URLSearchParams(hash || "");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const { queryParams } = Linking.parse(url);
      const code = typeof queryParams?.code === "string" ? queryParams.code : null;

      let authError: string | null = null;

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) authError = formatAuthError(sessionError);
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
        if (exchangeError) authError = formatAuthError(exchangeError);
      }

      if (cancelled) return;

      if (authError) {
        setError(authError);
        setTimeout(() => {
          if (!cancelled) router.replace("/login");
        }, 2000);
        return;
      }

      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? TAB_ROUTES.home : "/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color="#F54E25" size="large" />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#152238",
    gap: 12,
    padding: 24,
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 14,
  },
});
