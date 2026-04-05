import { Stack } from "expo-router";
import { TermsProvider } from "../contexts/TermsContext";
import { rootStackScreenOptions } from "../lib/navigationConfig";

const fadeScreen = {
  animation: "fade" as const,
  animationDuration: 260,
};

export default function RootLayout() {
  return (
    <TermsProvider>
      <Stack screenOptions={rootStackScreenOptions}>
        <Stack.Screen name="index" options={fadeScreen} />
        <Stack.Screen name="onboarding" options={fadeScreen} />
        <Stack.Screen name="login" options={fadeScreen} />
        <Stack.Screen name="signup" options={fadeScreen} />
        <Stack.Screen name="forget" options={fadeScreen} />
        <Stack.Screen name="verification" options={fadeScreen} />
        <Stack.Screen name="newpassword" options={fadeScreen} />
        <Stack.Screen name="privacypolicy" options={fadeScreen} />
        <Stack.Screen name="notification" options={fadeScreen} />
      </Stack>
    </TermsProvider>
  );
}
