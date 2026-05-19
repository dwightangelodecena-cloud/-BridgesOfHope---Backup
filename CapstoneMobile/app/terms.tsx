import React from "react";
import { useTerms } from "../contexts/TermsContext";
import { LegalDocumentScreen } from "../components/LegalDocumentScreen";
import { TERMS_OF_USE } from "../lib/legalDocuments";

export default function TermsScreen() {
  const { setHasReadTerms, setAcceptTerms } = useTerms();
  return (
    <LegalDocumentScreen
      document={TERMS_OF_USE}
      onConfirmRead={() => {
        setHasReadTerms(true);
        setAcceptTerms(true);
      }}
      confirmLabel="I have read the Terms and Conditions of Use"
    />
  );
}
