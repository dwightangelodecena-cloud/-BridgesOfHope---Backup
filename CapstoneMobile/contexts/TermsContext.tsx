import React, { createContext, useContext, useState } from "react";

type TermsContextType = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  hasReadTerms: boolean;
  hasReadPrivacy: boolean;
  setAcceptTerms: (value: boolean) => void;
  setAcceptPrivacy: (value: boolean) => void;
  setHasReadTerms: (value: boolean) => void;
  setHasReadPrivacy: (value: boolean) => void;
};

const TermsContext = createContext<TermsContextType | null>(null);

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);

  return (
    <TermsContext.Provider
      value={{
        acceptTerms,
        acceptPrivacy,
        hasReadTerms,
        hasReadPrivacy,
        setAcceptTerms,
        setAcceptPrivacy,
        setHasReadTerms,
        setHasReadPrivacy,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  const ctx = useContext(TermsContext);
  if (!ctx) throw new Error("useTerms must be used within TermsProvider");
  return ctx;
}
