import React, { createContext, useContext, useState } from "react";

type TermsContextType = {
  acceptTerms: boolean;
  setAcceptTerms: (value: boolean) => void;
};

const TermsContext = createContext<TermsContextType | null>(null);

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  return (
    <TermsContext.Provider value={{ acceptTerms, setAcceptTerms }}>
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  const ctx = useContext(TermsContext);
  if (!ctx) throw new Error("useTerms must be used within TermsProvider");
  return ctx;
}
