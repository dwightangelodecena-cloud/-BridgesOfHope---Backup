import { Stack } from "expo-router";
import { TermsProvider } from "../contexts/TermsContext";

export default function RootLayout() {
  return (
    <TermsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TermsProvider>
  );
}