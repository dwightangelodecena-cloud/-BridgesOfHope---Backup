import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LegalDocumentScreen } from "../components/LegalDocumentScreen";
import { INFORMED_CONSENT, INFORMED_CONSENT_READ_KEY } from "../lib/legalDocuments";

export default function InformedConsentScreen() {
  const router = useRouter();

  return (
    <LegalDocumentScreen
      document={INFORMED_CONSENT}
      confirmLabel="I have read the Informed Consent Form"
      onConfirmRead={() => {
        void (async () => {
          await AsyncStorage.setItem(INFORMED_CONSENT_READ_KEY, new Date().toISOString());
          router.back();
        })();
      }}
    />
  );
}
