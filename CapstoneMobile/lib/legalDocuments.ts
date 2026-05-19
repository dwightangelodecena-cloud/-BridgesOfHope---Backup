export type LegalSection = { title: string; body: string };

export type LegalDocument = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
  footer?: string | null;
};

export const TERMS_OF_USE: LegalDocument = {
  title: "TERMS AND CONDITION OF USE",
  subtitle: "Clinic Admission and Patient Management System",
  sections: [
    {
      title: "1. Acceptance of Terms",
      body: "By accessing, registering, or using this application and web system (“the System”), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the System immediately.",
    },
    {
      title: "2. Purpose of the System",
      body: "The System is designed to facilitate admission processing, patient record management, scheduling, monitoring, and communication between the clinic, patients, and authorized guardians. The System supports administrative and informational functions only and does not replace professional medical judgment, diagnosis, or treatment.",
    },
    {
      title: "3. User Eligibility and Accounts",
      body: "Users must provide accurate and complete information during registration and admission application. Guardians submitting applications on behalf of patients confirm they are legally authorized to provide the patient’s information. Users are responsible for maintaining the confidentiality of their login credentials and all activities performed under their account.",
    },
    {
      title: "4. Data Collection and Privacy",
      body: "The System collects personal and health-related information necessary for admission processing, monitoring, and care coordination. By using the System, you consent to the storage and processing of submitted information within the secure clinic database. Access to records is restricted to authorized personnel only and handled in accordance with applicable data privacy regulations and institutional policies.",
    },
    {
      title: "5. Accuracy of Information",
      body: "Users agree to provide truthful, current, and complete information. Submission of false, misleading, or incomplete data may result in delayed admission processing, suspension of account access, or rejection of applications.",
    },
    {
      title: "6. Communication and Notification",
      body: "The System may send notifications regarding admission status, schedules, updates, and relevant announcements. These notifications are informational and should not be interpreted as medical advice or emergency instructions.",
    },
    {
      title: "7. System Availability",
      body: "The clinic will make reasonable efforts to maintain continuous system availability. However, temporary interruptions may occur due to maintenance, updates, technical issues, or network conditions. The clinic is not liable for delays caused by such interruptions.",
    },
    {
      title: "8. Acceptable Use",
      body: "Users agree not to misuse the System. Prohibited actions include unauthorized access, attempting to alter records without permission, uploading harmful content, sharing accounts, or interfering with system operations. Violations may result in account suspension and further action as permitted by law.",
    },
    {
      title: "9. Record Access and Confidentiality",
      body: "Patient records are confidential and may only be accessed by authorized staff and the registered patient or guardian. Users agree not to share retrieved information with unauthorized individuals and to respect the privacy of all patients within the System.",
    },
    {
      title: "10. Limitation of Liability",
      body: "The System is intended to support administrative processes. The clinic is not responsible for decisions made solely based on system information without consultation with qualified healthcare professionals. The System does not provide emergency medical services.",
    },
    {
      title: "11. Modifications to Terms",
      body: "The clinic reserves the right to modify these Terms and Conditions at any time. Continued use of the System after updates indicates acceptance of the revised terms.",
    },
    {
      title: "12. Termination of Access",
      body: "The clinic may suspend or terminate access if users violate these Terms, misuse the System, or compromise security or patient confidentiality.",
    },
    {
      title: "13. Contact Information",
      body: "For questions, corrections to records, or concerns regarding these Terms, users may contact the clinic administration through the official communication channels provided within the System.",
    },
  ],
  footer:
    'By selecting “I Agree” or continuing to use the System, you confirm your acceptance of these Terms and Conditions.',
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "PRIVACY POLICY",
  subtitle: "Clinic Admission and Patient Management System",
  sections: [
    {
      title: "1. Introduction",
      body: "This Privacy Policy explains how the clinic collects, uses, stores, shares, and protects personal and health-related information when you access, register for, or use this application and web system. It applies to patients, guardians, family members, and other authorized users. By using the System, you acknowledge that you have read and understood this Privacy Policy. If you do not agree, you must discontinue use of the System immediately.",
    },
    {
      title: "2. Scope and Relationship to Other Policies",
      body: "This Privacy Policy works together with the Terms and Conditions of Use. Where the Terms describe your obligations as a user, this Policy describes how your information is handled. In case of conflict regarding data handling, this Privacy Policy prevails for privacy-related matters.",
    },
    {
      title: "3. How We Use Your Information",
      body: "Information collected through the System is used for legitimate clinic and system purposes, including processing admission applications, care coordination, identity verification, notifications, support, security improvements, and legal compliance. The System supports administrative and informational functions only.",
    },
    {
      title: "4. Legal Basis and Consent",
      body: "The clinic processes personal and sensitive personal information where permitted by applicable data privacy laws and institutional policies. Where consent is required, you may withdraw it subject to legal and operational limits.",
    },
    {
      title: "5. Sharing and Disclosure of Information",
      body: "The clinic does not sell your personal information. Information may be shared only with authorized personnel, guardians, service providers, and authorities when required by law.",
    },
    {
      title: "6. Data Storage, Retention, and Security",
      body: "Personal and health-related information is stored in the clinic’s secure database and protected by reasonable safeguards. Users must protect login credentials and report suspected unauthorized access.",
    },
    {
      title: "7. Access, Correction, and Your Rights",
      body: "You may have the right to request access, correction, restriction, deletion where permitted, and to file complaints through official channels within the System.",
    },
    {
      title: "8. Confidentiality of Patient Records",
      body: "Patient records are confidential. Unauthorized disclosure or misuse may result in account suspension and further action as permitted by law.",
    },
    {
      title: "9. Communications and Notifications",
      body: "The System may send notifications regarding account activity and clinic announcements. These are informational and not medical advice or emergency instructions.",
    },
    {
      title: "10. Cookies and Technical Data",
      body: "The System may use session data, local storage, or similar technologies for sign-in, preferences, and security.",
    },
    {
      title: "11. Minors and Guardian Representation",
      body: "A legally authorized guardian may register and submit information on behalf of a patient who is a minor or unable to consent.",
    },
    {
      title: "12. International and Cross-Border Processing",
      body: "If information is processed outside your country, the clinic will use reasonable safeguards consistent with applicable requirements.",
    },
    {
      title: "13. Changes to This Privacy Policy",
      body: "The clinic may update this Privacy Policy at any time. Continued use after updates indicates acceptance of the revised Policy.",
    },
    {
      title: "14. Contact Information",
      body: "For privacy-related questions or requests, contact the clinic administration through official channels provided within the System.",
    },
  ],
  footer: null,
};
