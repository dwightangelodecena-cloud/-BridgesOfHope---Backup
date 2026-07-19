import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { TermsProvider } from "../contexts/TermsContext";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { rootStackScreenOptions } from "../lib/navigationConfig";
import { ensureAuthSessionHealthy } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreLogs([
  /Invalid Refresh Token/i,
  /Refresh Token Not Found/i,
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((arg) => (typeof arg === "string" ? arg : (arg as Error)?.message || String(arg)))
      .join(" ");
    if (/invalid refresh token|refresh token not found/i.test(text)) {
      void ensureAuthSessionHealthy();
      return;
    }
    originalConsoleError(...args);
  };
}

const fadeScreen = {
  animation: "fade" as const,
  animationDuration: 260,
};

function AuthSessionRecovery() {
  useEffect(() => {
    void ensureAuthSessionHealthy();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthSessionRecovery />
      <TermsProvider>
        <Stack screenOptions={rootStackScreenOptions}>
        <Stack.Screen name="index" options={fadeScreen} />
        <Stack.Screen name="onboarding" options={fadeScreen} />
        <Stack.Screen name="login" options={fadeScreen} />
        <Stack.Screen name="consent" options={fadeScreen} />
        <Stack.Screen name="informed-consent" options={fadeScreen} />
        <Stack.Screen name="signup" options={fadeScreen} />
        <Stack.Screen name="forget" options={fadeScreen} />
        <Stack.Screen name="verification" options={fadeScreen} />
        <Stack.Screen name="newpassword" options={fadeScreen} />
        <Stack.Screen name="privacypolicy" options={fadeScreen} />
        <Stack.Screen name="terms" options={fadeScreen} />
        <Stack.Screen name="notification" options={fadeScreen} />
        </Stack>
      </TermsProvider>
    </AppErrorBoundary>
  );
}
