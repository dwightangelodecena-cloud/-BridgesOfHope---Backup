import { Stack } from "expo-router";
import { TermsProvider } from "../contexts/TermsContext";
import { useState } from "react";

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <TermsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="index" />
        ) : (
          <Stack.Screen name="tabs" />
        )}

        {!isAuthenticated ? <Stack.Screen name="login" /> : null}
        {!isAuthenticated ? <Stack.Screen name="signup" /> : null}
        <Stack.Screen name="tabs/ViewDetailPage" />
        
        <Stack.Screen name="AdmissionForm" />
      </Stack>
    </TermsProvider>
  );
}