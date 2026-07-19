import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LegalDocumentScreen } from "../components/LegalDocumentScreen";
import { INFORMED_CONSENT, INFORMED_CONSENT_READ_KEY } from "../lib/legalDocuments";

export default function InformedConsentScreen() {
  return (
    <LegalDocumentScreen
      document={INFORMED_CONSENT}
      confirmLabel="I have read the Informed Consent Form"
      backFallback="/consent"
      onConfirmRead={() => {
        void AsyncStorage.setItem(INFORMED_CONSENT_READ_KEY, new Date().toISOString());
      }}
    />
  );
}
