import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bell,
  Briefcase,
  Calendar,
  ClipboardList,
  FileText,
  Heart,
  Home,
  IdCard,
  LogOut,
  MessageCircle,
  Moon,
  QrCode,
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';
import logo from '@/assets/kalingalogo.png';
import AuthPageBackground from '@/components/auth/AuthPageBackground';
import { AUTH_SHELL_STYLES } from '@/components/auth/authShellStyles';

/**
 * Public hand-off page for the family role. The Family Portal no longer has a
 * web dashboard — family accounts (new or existing) are directed here to
 * download the mobile app instead. Shares the same two-column shell as
 * login/signup so it reads as part of the same product, not a dead end.
 */
export default function GetTheApp() {
  return (
    <div className="login-container">
      <AuthPageBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700&display=swap');

        ${AUTH_SHELL_STYLES}

        /* Heavier blur on this page only — this <style> tag is only in the DOM
           while GetTheApp is mounted, so this doesn't affect login/signup/etc.
           Keeps the phone mockup as the clear focal point instead of the photo. */
        .login-container::before {
          filter: saturate(1) brightness(1.02) contrast(1) blur(7px);
          transform: scale(1.08);
        }

        @keyframes phoneFloat {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-14px) rotate(-1deg); }
        }

        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.06); opacity: 0.8; }
        }

        /* ── Phone mockup (brand side) ─────────────────────────────────── */
        .get-app-phone-stage {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
        }

        .get-app-phone {
          position: relative;
          width: 248px;
          /* Height is driven by content (not a hardcoded number) — this is the
             fix for the recurring "bottom nav silently clipped" bug: with a
             fixed height + overflow:hidden, any future content growth just
             pushes the last section past the visible edge with no error.
             Auto height means every section is always fully visible. */
          border-radius: 48px;
          background: linear-gradient(160deg, #1b2559 0%, #10162f 100%);
          padding: 9px;
          box-shadow:
            0 30px 60px rgba(27, 37, 89, 0.28),
            0 10px 24px rgba(245, 78, 37, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: phoneFloat 7s ease-in-out infinite;
          z-index: 1;
        }

        /* Dynamic Island — floats on the screen itself, not cut into the bezel. */
        .get-app-phone-island {
          position: absolute;
          top: 15px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 20px;
          background: #000;
          border-radius: 999px;
          z-index: 3;
        }

        .get-app-phone-screen {
          position: relative;
          width: 100%;
          border-radius: 41px;
          background: #f1f4f9;
          padding: 26px 9px 8px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        /* Every direct section below is flex-shrink:0 — the phone is sized to
           fit them exactly, so nothing can ever get crushed/squeezed again if
           content changes. */
        .get-app-phone-screen > * {
          flex-shrink: 0;
        }

        /* ── Header: logo + Kalinga/Bridges of Hope lockup + bell + avatar ──
           Mirrors the real FamilyHeaderBrand component: logo plate, thin
           orange accent bar, then eyebrow / title / pill stacked. */
        .get-app-phone-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 2px 5px;
        }

        .get-app-phone-logo-plate {
          width: 27px;
          height: 27px;
          border-radius: 9px;
          background: #fff7f4;
          border: 1px solid rgba(254, 215, 170, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .get-app-phone-logo {
          width: 17px;
          height: 17px;
          object-fit: contain;
        }

        .get-app-phone-accent {
          width: 2px;
          align-self: stretch;
          border-radius: 999px;
          background: linear-gradient(180deg, #ff6a3d, var(--brand-orange));
          flex-shrink: 0;
        }

        .get-app-phone-brandcol {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .get-app-phone-eyebrow {
          font-size: 5.6px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: var(--brand-orange);
          text-transform: uppercase;
          line-height: 1.1;
        }

        .get-app-phone-brand {
          font-size: 10.5px;
          font-weight: 800;
          color: var(--brand-navy);
          letter-spacing: -0.25px;
          line-height: 1.15;
          white-space: nowrap;
        }

        .get-app-phone-brand em {
          font-style: normal;
          color: var(--brand-orange);
        }

        .get-app-phone-pill {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          width: fit-content;
          font-size: 5px;
          font-weight: 800;
          letter-spacing: 0.2px;
          text-transform: uppercase;
          color: var(--brand-orange);
          background: rgba(245, 78, 37, 0.1);
          border: 1px solid rgba(254, 215, 170, 0.6);
          border-radius: 999px;
          padding: 1.5px 5px;
          margin-top: 2px;
        }

        .get-app-phone-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: 2px;
        }

        .get-app-phone-bell {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: var(--bh-slate-100, #f1f5f9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bh-slate-500);
          flex-shrink: 0;
        }

        .get-app-phone-avatar {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--bh-slate-200), var(--bh-slate-300, #cbd5e1));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bh-slate-500);
          flex-shrink: 0;
        }

        /* ── Hero card (dark, matches the real home-screen banner) ── */
        .get-app-phone-hero {
          position: relative;
          border-radius: 16px;
          padding: 9px 10px 8px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 42%, #312e81 100%);
          overflow: hidden;
        }

        .get-app-phone-hero-glow {
          position: absolute;
          top: -22px;
          right: -16px;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245, 78, 37, 0.35), transparent 70%);
          z-index: 0;
        }

        /* Explicit position+z-index on every text element — guarantees it
           always paints above the decorative glow, whatever else changes. */
        .get-app-phone-hero-badge {
          position: relative;
          z-index: 1;
          width: 16px;
          height: 16px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          margin-bottom: 3px;
        }

        .get-app-phone-hero-eyebrow {
          position: relative;
          z-index: 1;
          font-size: 4.6px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 2px;
        }

        .get-app-phone-hero-greet {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.2px;
          margin-bottom: 1px;
        }

        .get-app-phone-hero-sub {
          position: relative;
          z-index: 1;
          font-size: 5.4px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.62);
        }

        /* ── 2x2 stat grid ── */
        .get-app-phone-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }

        .get-app-phone-stat {
          background: #fff;
          border-radius: 14px;
          padding: 6px 7px;
          box-shadow: 0 2px 6px rgba(27, 37, 89, 0.05);
          display: flex;
          flex-direction: column;
          gap: 1.5px;
        }

        .get-app-phone-stat-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 4px;
        }

        .get-app-phone-stat-label {
          font-size: 4.4px;
          font-weight: 800;
          color: var(--bh-text-subtle);
          text-transform: uppercase;
          letter-spacing: 0.2px;
          line-height: 1.25;
          padding-top: 2px;
        }

        .get-app-phone-stat-icon {
          width: 16px;
          height: 16px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .get-app-phone-stat-num {
          font-size: 14.5px;
          font-weight: 900;
          color: var(--brand-navy);
          letter-spacing: -0.3px;
          line-height: 1;
          margin-top: 1px;
        }

        .get-app-phone-stat-caption {
          font-size: 4.8px;
          font-weight: 500;
          color: var(--bh-text-subtle);
          line-height: 1.25;
        }

        /* ── Quick actions card (its own white card, floating over the pale
           screen background — matches the real home screen's grouping) ── */
        .get-app-phone-qa-card {
          background: #fff;
          border-radius: 16px;
          padding: 8px 9px 9px;
          box-shadow: 0 2px 8px rgba(27, 37, 89, 0.05);
          position: relative;
        }

        .get-app-phone-qa-label {
          font-size: 7.5px;
          font-weight: 800;
          color: var(--brand-navy);
          padding: 0 1px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .get-app-phone-qa-sub {
          font-size: 5px;
          font-weight: 500;
          color: var(--bh-text-subtle);
          padding: 0 1px;
          margin: 1px 0 5px;
        }

        .get-app-phone-qa-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .get-app-phone-qa-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          background: #f8faff;
          border-radius: 9px;
          padding: 5px 6px;
        }

        .get-app-phone-qa-icon {
          width: 19px;
          height: 19px;
          border-radius: 7px;
          background: var(--brand-orange);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .get-app-phone-qa-icon.is-soft {
          background: #fff1eb;
          color: var(--brand-orange);
        }

        .get-app-phone-qa-body {
          min-width: 0;
          flex: 1;
        }

        .get-app-phone-qa-title {
          font-size: 7px;
          font-weight: 800;
          color: var(--brand-navy);
          line-height: 1.2;
        }

        .get-app-phone-qa-desc {
          font-size: 5px;
          font-weight: 500;
          color: var(--bh-text-subtle);
          line-height: 1.3;
          margin-top: 1.5px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .get-app-phone-qa-badge {
          display: inline-block;
          font-size: 4.4px;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 999px;
          margin-top: 2.5px;
        }

        /* ── Floating chat FAB — sits over the bottom-right corner of the
           Quick Actions card, absolutely positioned so it doesn't consume
           flex layout space (never contributes to squish/overflow). ── */
        .get-app-phone-fab {
          position: absolute;
          right: 10px;
          bottom: 36px;
          width: 25px;
          height: 25px;
          border-radius: 50%;
          background: var(--brand-orange);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 6px 14px rgba(245, 78, 37, 0.4), 0 0 0 3px #f1f4f9;
          z-index: 2;
        }

        /* ── Bottom nav ── */
        .get-app-phone-nav {
          margin-top: auto;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 5px 2px 0;
          border-top: 1px solid #e3e8f0;
        }

        .get-app-phone-nav-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bh-text-faint);
        }

        .get-app-phone-nav-icon.is-active {
          background: var(--brand-orange);
          color: #fff;
          box-shadow: 0 2px 6px rgba(245, 78, 37, 0.4);
        }

        .get-app-phone-nav-icon.is-accent {
          color: var(--brand-orange);
        }

        .get-app-phone-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .get-app-phone-nav-label {
          font-size: 4.6px;
          font-weight: 800;
          color: var(--brand-orange);
          line-height: 1;
        }

        .get-app-phone-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(245, 78, 37, 0.18);
          pointer-events: none;
        }

        .get-app-phone-ring--1 {
          inset: -22px;
          animation: ringPulse 4s ease-in-out infinite;
        }

        .get-app-phone-ring--2 {
          inset: -46px;
          border-color: rgba(26, 43, 74, 0.1);
          animation: ringPulse 5s ease-in-out infinite 0.4s;
        }

        .get-app-brand-title {
          font-size: clamp(1.4rem, 2.6vw, 1.8rem);
          font-weight: 800;
          color: var(--brand-navy);
          text-align: center;
          margin: 0 0 10px;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .get-app-brand-desc {
          font-size: 0.92rem;
          color: var(--bh-text-muted);
          text-align: center;
          line-height: 1.6;
          max-width: 340px;
          margin: 0 auto;
        }

        /* ── Card side ──────────────────────────────────────────────────── */
        .get-app-card {
          position: relative;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          padding: clamp(28px, 4vw, 40px);
          border-radius: var(--auth-radius-card);
          box-shadow: var(--auth-shadow-card);
          width: 100%;
          max-width: var(--auth-form-col);
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-sizing: border-box;
          animation: loginFadeIn 0.65s ease-out 0.1s both;
        }

        .get-app-card-accent {
          width: 46px;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, #ff6a3d, var(--brand-orange));
          margin: 0 auto 20px;
        }

        .get-app-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--brand-orange);
          margin: 0 0 16px;
          padding: 5px 12px;
          background: rgba(245, 78, 37, 0.08);
          border-radius: 999px;
          border: 1px solid rgba(245, 78, 37, 0.14);
        }

        .get-app-title {
          font-size: clamp(1.4rem, 2.4vw, 1.7rem);
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0 0 10px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .get-app-subtitle {
          font-size: 0.9rem;
          color: var(--bh-text-muted);
          line-height: 1.6;
          margin: 0 0 26px;
        }

        .get-app-qr-wrap {
          position: relative;
          width: fit-content;
          margin: 0 auto 10px;
        }

        .get-app-qr-wrap::before {
          content: '';
          position: absolute;
          inset: -14px;
          z-index: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245, 78, 37, 0.14) 0%, transparent 72%);
          animation: loginPulse 5s ease-in-out infinite;
        }

        .get-app-qr-frame {
          position: relative;
          z-index: 1;
          width: 128px;
          height: 128px;
          margin: 0 auto;
          padding: 14px;
          box-sizing: border-box;
        }

        .get-app-qr-frame::before,
        .get-app-qr-frame::after,
        .get-app-qr-corner-tl,
        .get-app-qr-corner-br {
          content: '';
          position: absolute;
          width: 22px;
          height: 22px;
          border-color: var(--brand-orange);
          border-style: solid;
        }

        .get-app-qr-frame::before {
          top: 0;
          left: 0;
          border-width: 2.5px 0 0 2.5px;
          border-radius: 8px 0 0 0;
        }

        .get-app-qr-frame::after {
          top: 0;
          right: 0;
          border-width: 2.5px 2.5px 0 0;
          border-radius: 0 8px 0 0;
        }

        .get-app-qr-corner-tl {
          bottom: 0;
          left: 0;
          border-width: 0 0 2.5px 2.5px;
          border-radius: 0 0 0 8px;
        }

        .get-app-qr-corner-br {
          bottom: 0;
          right: 0;
          border-width: 0 2.5px 2.5px 0;
          border-radius: 0 0 8px 0;
        }

        .get-app-qr-inner {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background:
            radial-gradient(rgba(245, 78, 37, 0.16) 1.5px, transparent 1.5px),
            var(--bh-slate-50);
          background-size: 10px 10px, 100% 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-orange);
        }

        .get-app-qr-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--bh-text-subtle);
          margin: 0 0 16px;
        }

        .get-app-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 20px;
          color: var(--bh-text-faint);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .get-app-divider::before,
        .get-app-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--bh-slate-200);
        }

        .get-app-badges {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .get-app-badge {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 12px;
          background: #14151a;
          color: #fff;
          cursor: default;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .get-app-badge:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(20, 21, 26, 0.22);
        }

        .get-app-badge-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
        }

        .get-app-badge-text {
          text-align: left;
          line-height: 1.15;
        }

        .get-app-badge-eyebrow {
          display: block;
          font-size: 0.6rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.72);
        }

        .get-app-badge-name {
          display: block;
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .get-app-badge-soon {
          margin-left: auto;
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--brand-navy);
          background: linear-gradient(135deg, #ffb185, #ff8a5c);
          padding: 4px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .get-app-back {
          font-size: 0.88rem;
          color: var(--bh-text-muted);
          margin: 0;
          padding-top: 16px;
          border-top: 1px solid var(--bh-slate-100, #f1f5f9);
        }

        .get-app-back a {
          color: var(--brand-orange);
          font-weight: 700;
          text-decoration: none;
        }

        .get-app-back a:hover {
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @media (max-width: 900px) {
          .get-app-phone {
            width: 222px;
          }
        }
      `}</style>

      <div className="login-content-wrapper">
        <div className="brand-side">
          <div className="brand-panel">
            <div className="get-app-phone-stage">
              <div className="get-app-phone">
                <div className="get-app-phone-ring get-app-phone-ring--2" aria-hidden="true" />
                <div className="get-app-phone-ring get-app-phone-ring--1" aria-hidden="true" />
                <div className="get-app-phone-island" aria-hidden="true" />
                <div className="get-app-phone-screen" aria-hidden="true">
                  <div className="get-app-phone-header">
                    <span className="get-app-phone-logo-plate">
                      <img src={logo} alt="" className="get-app-phone-logo" />
                    </span>
                    <span className="get-app-phone-accent" />
                    <div className="get-app-phone-brandcol">
                      <div className="get-app-phone-eyebrow">Kalinga</div>
                      <div className="get-app-phone-brand">
                        Bridges of <em>Hope</em>
                      </div>
                      <span className="get-app-phone-pill">
                        <Heart size={5} strokeWidth={3} fill="currentColor" />
                        Family Portal
                      </span>
                    </div>
                    <div className="get-app-phone-actions">
                      <span className="get-app-phone-bell">
                        <Bell size={10} strokeWidth={2.5} />
                      </span>
                      <span className="get-app-phone-avatar">
                        <User size={10} strokeWidth={2.5} />
                      </span>
                    </div>
                  </div>

                  <div className="get-app-phone-hero">
                    <div className="get-app-phone-hero-glow" />
                    <span className="get-app-phone-hero-badge">
                      <Heart size={9} strokeWidth={2.5} />
                    </span>
                    <div className="get-app-phone-hero-eyebrow">Bridges of Hope — Family Portal</div>
                    <div className="get-app-phone-hero-greet">
                      Good evening, Guest
                      <Moon size={11} strokeWidth={2.25} color="var(--brand-orange)" />
                    </div>
                    <div className="get-app-phone-hero-sub">Today · Your care overview at a glance</div>
                  </div>

                  <div className="get-app-phone-stats">
                    <div className="get-app-phone-stat">
                      <div className="get-app-phone-stat-top">
                        <span className="get-app-phone-stat-label">Active Residents</span>
                        <span className="get-app-phone-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                          <Activity size={10} strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="get-app-phone-stat-num">3</div>
                      <div className="get-app-phone-stat-caption">Currently under care</div>
                    </div>
                    <div className="get-app-phone-stat">
                      <div className="get-app-phone-stat-top">
                        <span className="get-app-phone-stat-label">Avg Progress</span>
                        <span className="get-app-phone-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                          <TrendingUp size={10} strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="get-app-phone-stat-num">28%</div>
                      <div className="get-app-phone-stat-caption">Steady recovery</div>
                    </div>
                    <div className="get-app-phone-stat">
                      <div className="get-app-phone-stat-top">
                        <span className="get-app-phone-stat-label">Pending Requests</span>
                        <span className="get-app-phone-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                          <AlertCircle size={10} strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="get-app-phone-stat-num">0</div>
                      <div className="get-app-phone-stat-caption">Admissions, discharges, appointments</div>
                    </div>
                    <div className="get-app-phone-stat">
                      <div className="get-app-phone-stat-top">
                        <span className="get-app-phone-stat-label">Reports Received</span>
                        <span className="get-app-phone-stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                          <FileText size={10} strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="get-app-phone-stat-num">1</div>
                      <div className="get-app-phone-stat-caption">From nursing staff</div>
                    </div>
                  </div>

                  <div className="get-app-phone-qa-card">
                    <div className="get-app-phone-qa-label">
                      <Sparkles size={9} strokeWidth={2.5} color="var(--brand-orange)" />
                      Quick Actions
                    </div>
                    <div className="get-app-phone-qa-sub">Your most-used tools — one tap away</div>

                    <div className="get-app-phone-qa-list">
                      <div className="get-app-phone-qa-row">
                        <span className="get-app-phone-qa-icon">
                          <FileText size={10} strokeWidth={2.25} />
                        </span>
                        <div className="get-app-phone-qa-body">
                          <div className="get-app-phone-qa-title">Weekly Report</div>
                          <div className="get-app-phone-qa-desc">Review submitted weekly care updates from nursing staff</div>
                          <span className="get-app-phone-qa-badge" style={{ background: '#fff1eb', color: '#c2410c' }}>
                            1 received
                          </span>
                        </div>
                      </div>

                      <div className="get-app-phone-qa-row">
                        <span className="get-app-phone-qa-icon">
                          <ClipboardList size={10} strokeWidth={2.25} />
                        </span>
                        <div className="get-app-phone-qa-body">
                          <div className="get-app-phone-qa-title">Admission</div>
                          <div className="get-app-phone-qa-desc">Submit and track new admission request forms</div>
                          <span className="get-app-phone-qa-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                            0 pending
                          </span>
                        </div>
                      </div>

                      <div className="get-app-phone-qa-row">
                        <span className="get-app-phone-qa-icon">
                          <Briefcase size={10} strokeWidth={2.25} />
                        </span>
                        <div className="get-app-phone-qa-body">
                          <div className="get-app-phone-qa-title">Services</div>
                          <div className="get-app-phone-qa-desc">Open billing, inclusions, and care support details</div>
                          <span className="get-app-phone-qa-badge" style={{ background: '#eef2ff', color: '#3730a3' }}>
                            Care resources
                          </span>
                        </div>
                      </div>

                      <div className="get-app-phone-qa-row">
                        <span className="get-app-phone-qa-icon is-soft">
                          <MessageCircle size={10} strokeWidth={2.25} />
                        </span>
                        <div className="get-app-phone-qa-body">
                          <div className="get-app-phone-qa-title">Messages</div>
                          <div className="get-app-phone-qa-desc">Chat with the Bridges of Hope care team</div>
                          <span className="get-app-phone-qa-badge" style={{ background: '#fff1eb', color: '#c2410c' }}>
                            Support chat
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="get-app-phone-fab">
                      <MessageCircle size={13} strokeWidth={2.25} />
                    </span>
                  </div>

                  <div className="get-app-phone-nav">
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon is-active">
                        <Home size={11} strokeWidth={2.5} />
                      </span>
                      <span className="get-app-phone-nav-label">Home</span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon">
                        <IdCard size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon">
                        <ClipboardList size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon">
                        <Calendar size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon">
                        <FileText size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon">
                        <User size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                    <span className="get-app-phone-nav-item">
                      <span className="get-app-phone-nav-icon is-accent">
                        <LogOut size={11} strokeWidth={2.25} />
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="get-app-brand-title">Care, right in your pocket</h2>
            <p className="get-app-brand-desc">
              Stay connected with your loved one's care — visits, reports, and updates, all in the
              Kalinga mobile app.
            </p>
          </div>
        </div>

        <div className="form-side">
          <div className="get-app-card">
            <div className="get-app-card-accent" aria-hidden="true" />
            <span className="get-app-eyebrow">
              <Heart size={11} strokeWidth={2.5} />
              Mobile App
            </span>

            <h1 className="get-app-title">The Family Portal is now on mobile</h1>
            <p className="get-app-subtitle">
              To keep things simple and secure, Kalinga Family Portal now lives exclusively in our
              mobile app. Download it to sign in, manage visits, and stay connected with your
              loved one's care.
            </p>

            <div className="get-app-qr-wrap">
              <div className="get-app-qr-frame" aria-hidden="true">
                <div className="get-app-qr-corner-tl" />
                <div className="get-app-qr-corner-br" />
                <div className="get-app-qr-inner">
                  <QrCode size={44} strokeWidth={1.4} />
                </div>
              </div>
            </div>
            <p className="get-app-qr-label">Scan with your phone camera — QR coming soon</p>

            <div className="get-app-divider">or download directly</div>

            {/* TODO: replace with real App Store / Google Play links once the app is published. */}
            <div className="get-app-badges">
              <div className="get-app-badge">
                <span className="get-app-badge-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.365 1.43c0 1.14-.463 2.11-1.115 2.86-.7.83-1.85 1.47-2.8 1.47-.12 0-.24-.02-.32-.03-.02-.11-.04-.24-.04-.37 0-1.09.55-2.11 1.16-2.79.72-.8 1.97-1.44 2.94-1.51.02.12.03.24.03.35zm4.14 15.75c-.03.09-.5 1.71-1.65 3.37-1 1.45-2.04 2.9-3.68 2.93-1.61.03-2.13-.95-3.98-.95-1.85 0-2.42.92-3.95.98-1.58.06-2.78-1.57-3.79-3.02-2.05-2.96-3.62-8.36-1.51-12.01 1.04-1.81 2.9-2.96 4.92-2.99 1.55-.03 3.02 1.04 3.97 1.04.94 0 2.72-1.29 4.59-1.1.78.03 2.98.32 4.39 2.4-.11.07-2.62 1.53-2.59 4.57.03 3.63 3.19 4.84 3.22 4.86 0 .01-.5 1.67-1.94 3.02z" />
                  </svg>
                </span>
                <span className="get-app-badge-text">
                  <span className="get-app-badge-eyebrow">Download on the</span>
                  <span className="get-app-badge-name">App Store</span>
                </span>
                <span className="get-app-badge-soon">Soon</span>
              </div>

              <div className="get-app-badge">
                <span className="get-app-badge-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#00D9FF" d="M3.6 2.6c-.3.3-.5.8-.5 1.4v16c0 .6.2 1.1.5 1.4l.1.1L13 12.2v-.4L3.7 2.5l-.1.1z" />
                    <path fill="#FF3D57" d="M16.1 15.3l-3.1-3.1v-.4l3.1-3.1.1.1 3.7 2.1c1.05.6 1.05 1.6 0 2.2l-3.7 2.1-.1.1z" />
                    <path fill="#00E884" d="M16.2 15.2 13 12l-9.4 9.4c.35.37.92.42 1.57.05l11.03-6.25" />
                    <path fill="#FFC22E" d="M16.2 8.8 5.17 2.55c-.65-.37-1.22-.32-1.57.05L13 12l3.2-3.2z" />
                  </svg>
                </span>
                <span className="get-app-badge-text">
                  <span className="get-app-badge-eyebrow">GET IT ON</span>
                  <span className="get-app-badge-name">Google Play</span>
                </span>
                <span className="get-app-badge-soon">Soon</span>
              </div>
            </div>

            <p className="get-app-back">
              Already have the app? <Link to="/login">Back to Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
