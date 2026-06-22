import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { TermsProvider } from "../contexts/TermsContext";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { rootStackScreenOptions } from "../lib/navigationConfig";

WebBrowser.maybeCompleteAuthSession();

const fadeScreen = {
  animation: "fade" as const,
  animationDuration: 260,
};

export default function RootLayout() {
  return (
    <AppErrorBoundary>
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
