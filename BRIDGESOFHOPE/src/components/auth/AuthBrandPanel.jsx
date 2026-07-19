import { Check } from 'lucide-react';
import logo from '@/assets/kalingalogo.png';

const LOGIN_FEATURES = [
  'Secure Access',
  'Family Updates',
  'Appointment Management',
];

const SIGNUP_FEATURES = [
  'Quick & Easy Registration',
  'Secure Family Access',
  'Visit & Appointment Tools',
];

const BRAND_VARIANTS = {
  login: {
    title: 'Kalinga Family Portal',
    description:
      'Stay connected with your loved ones, manage visits, and receive important updates securely.',
    features: LOGIN_FEATURES,
  },
  signup: {
    eyebrow: 'Sign Up',
    title: 'Join Kalinga Family Portal',
    description:
      'Create your family account to stay connected with loved ones, manage visits, and receive secure care updates.',
    features: SIGNUP_FEATURES,
  },
  recovery: {
    eyebrow: 'Account Recovery',
    title: 'Secure Password Recovery',
    description:
      'Helping you safely regain access to your Bridges of Hope account.',
    features: [
      'Encrypted Verification',
      'Secure Email Delivery',
      'Protected Account Access',
    ],
  },
};

export default function AuthBrandPanel({ variant = 'login' }) {
  const content = BRAND_VARIANTS[variant] ?? BRAND_VARIANTS.login;

  return (
    <div className="brand-side">
      <div className="brand-panel">
        <div className="brand-accent brand-accent--1" aria-hidden="true" />
        <div className="brand-accent brand-accent--2" aria-hidden="true" />
        <div className="brand-particle brand-particle--1" aria-hidden="true" />
        <div className="brand-particle brand-particle--2" aria-hidden="true" />
        <div className="brand-particle brand-particle--3" aria-hidden="true" />
        <div className="brand-content">
          {content.eyebrow ? (
            <span className="brand-eyebrow">{content.eyebrow}</span>
          ) : null}
          <div className="brand-logo-zone">
            <img src={logo} alt="" className="brand-watermark" aria-hidden="true" />
            <div className="brand-logo-wrap">
              <img src={logo} alt="Kalinga" className="brand-logo" />
            </div>
          </div>
          <h1 className="brand-title">{content.title}</h1>
          <p className="brand-description">{content.description}</p>
          <ul className="brand-features">
            {content.features.map((feature) => (
              <li key={feature} className="brand-feature">
                <span className="brand-feature-icon">
                  <Check size={14} strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
