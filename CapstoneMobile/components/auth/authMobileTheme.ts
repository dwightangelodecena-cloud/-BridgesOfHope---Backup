export const AUTH_MOBILE = {
  orange: '#F54E25',
  orangeDark: '#FF4D1F',
  orangeLight: '#FF6A3D',
  navy: '#1A2B4A',
  textMuted: '#64748B',
  textPlaceholder: '#94A3B8',
  inputBg: '#F8FAFC',
  inputBorder: '#E2E8F0',
  cardBg: 'rgba(255, 255, 255, 0.98)',
  pageBg: '#EEF2F7',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  errorText: '#DC2626',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoText: '#1D4ED8',
} as const;

export const AUTH_BRAND_COPY = {
  login: {
    eyebrow: null as string | null,
    heading: 'Welcome Back',
    subtitle: 'Sign in to your account.',
    brandTitle: 'Kalinga Family Portal',
    brandDescription:
      'Stay connected with your loved ones, manage visits, and receive important updates securely.',
    features: ['Secure Access', 'Family Updates', 'Appointment Management'],
  },
  signup: {
    eyebrow: 'Sign Up',
    heading: 'Create your account',
    subtitle: 'Fill in your details to get started.',
    brandTitle: 'Kalinga Family Portal',
    brandDescription:
      'Create your family account to manage visits and receive secure care updates.',
    features: ['Quick & Easy Registration', 'Secure Family Access', 'Visit & Appointment Tools'],
  },
} as const;
