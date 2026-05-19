import React from "react";
import { useTerms } from "../contexts/TermsContext";
import { LegalDocumentScreen } from "../components/LegalDocumentScreen";
import { PRIVACY_POLICY } from "../lib/legalDocuments";

export default function PrivacyPolicyScreen() {
  const { setHasReadPrivacy, setAcceptPrivacy } = useTerms();
  return (
    <LegalDocumentScreen
      document={PRIVACY_POLICY}
      onConfirmRead={() => {
        setHasReadPrivacy(true);
        setAcceptPrivacy(true);
      }}
      confirmLabel="I have read the Privacy Policy"
    />
  );
}
