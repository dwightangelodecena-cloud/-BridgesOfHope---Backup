import { Check } from 'lucide-react';
import logo from '@/assets/kalingalogo.png';

/** Web is staff-only now (Admin / Nurse / Program) — the Family Portal lives on the mobile app. */
const LOGIN_FEATURES = [
  'Secure Access',
  'Care Coordination',
  'Appointment Management',
];

const BRAND_VARIANTS = {
  login: {
    title: 'Kalinga Staff Portal',
    description:
      'Manage resident care, appointments, and reports — securely, from one place.',
    features: LOGIN_FEATURES,
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
