import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { formatAuthError } from "../../lib/authErrors";
import { TAB_ROUTES } from "../../lib/navigationConfig";

/** Read by app/login.tsx to show a one-time banner. */
const POST_SIGNUP_KEY = "bh_post_signup";

/**
 * Lands here when the user taps an email link (signup confirmation, password
 * reset code email, etc.) and the OS hands the `capstonemobile://auth/callback`
 * deep link back to the app. Supabase appends the session as either a URL hash
 * (#access_token=...&refresh_token=...&type=...) or a PKCE ?code=... query param.
 * `?next=signup|reset` (see getMobileEmailLinkRedirectUrl) picks the destination:
 *   signup -> login screen with an "Email confirmed" banner
 *   reset  -> new password screen, signed in with the link's session
 */
export default function AuthCallback() {
  const router = useRouter();
  // Updates on warm starts too (app already open in the background when the link is tapped).
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (handledUrl.current === url) return;
    handledUrl.current = url;

    let cancelled = false;

    (async () => {
      if (!url || !isSupabaseConfigured()) {
        if (!cancelled) router.replace("/login");
        return;
      }

      const hashParams = new URLSearchParams(url.split("#")[1] || "");
      const { queryParams } = Linking.parse(url.split("#")[0]);
      const query = (key: string) =>
        typeof queryParams?.[key] === "string" ? (queryParams[key] as string) : null;

      const next = query("next");
      const linkType = hashParams.get("type");
      const isReset = next === "reset" || linkType === "recovery";
      const isSignup = next === "signup" || linkType === "signup";

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = query("code");
      let authError =
        hashParams.get("error_description") || query("error_description");

      if (!authError && accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) authError = formatAuthError(sessionError);
      } else if (!authError && code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
        if (exchangeError) authError = formatAuthError(exchangeError);
      }

      if (cancelled) return;

      if (authError) {
        setError(
          isReset
            ? `${authError}. Request a new code to reset your password.`
            : authError
        );
        setTimeout(() => {
          if (!cancelled) router.replace(isReset ? "/forget" : "/login");
        }, 2500);
        return;
      }

      if (isReset) {
        router.replace("/newpassword");
        return;
      }

      if (isSignup) {
        // The email is confirmed by the time Supabase redirects here; send the user to
        // sign in with their password rather than straight into the app.
        await supabase.auth.signOut({ scope: "local" });
        await AsyncStorage.setItem(POST_SIGNUP_KEY, "email_confirmed").catch(() => {});
        if (!cancelled) router.replace("/login");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) router.replace(data.session ? TAB_ROUTES.home : "/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, url]);

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
