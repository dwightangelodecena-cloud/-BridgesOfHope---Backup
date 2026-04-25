import { Platform } from "react-native";

export const rootStackAnimation =
  Platform.OS === "web"
    ? ("fade" as const)
    : Platform.OS === "ios"
      ? ("default" as const)
      : ("ios_from_right" as const);

export const rootStackScreenOptions = {
  headerShown: false,
  animation: rootStackAnimation,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
  animationDuration: 280,
  animationTypeForReplace: "push" as const,
};

export const tabsScreenOptions = {
  headerShown: false,
  tabBarStyle: { display: "none" as const },
  animation: "fade" as const,
  transitionSpec: {
    animation: "timing" as const,
    config: { duration: 220 },
  },
};

/** Always use router.navigate(...) for these — same tab stack, cross-fade (no slideshow). */
export const TAB_ROUTES = {
  home: "/tabs/home",
  progress: "/tabs/progress",
  messages: "/tabs/Messages",
  profile: "/tabs/profile",
  patientDetails: "/tabs/patient-details",
  appointments: "/tabs/appointments",
  reports: "/tabs/reports",
  /** Admission / upload documents / admit a patient */
  admission: "/tabs/AdmissionForm",
  services: "/tabs/services",
  weeklyReport: "/tabs/ViewDetailPage",
  discharge: "/tabs/DischargeForm",
} as const;
