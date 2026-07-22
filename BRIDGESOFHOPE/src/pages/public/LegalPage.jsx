import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/kalingalogo.png';
import { loadSiteContent } from '@/lib/siteContentStore';
import { WARM_THEME_VARS } from '@/styles/warmTheme';

/**
 * Shared shell + content for the three footer legal links (Terms of
 * Service, Privacy Policy, Cookie Policy). Reuses the landing page's own
 * warm/editorial palette + card/shadow language (not the auth navy theme)
 * since they're reached from the landing footer and should read as the
 * same site, not a bolted-on legal template.
 */
const LEGAL_STYLES = `
  .legal-page {
    ${WARM_THEME_VARS}
    position: relative;
    min-height: 100vh;
    background: linear-gradient(180deg, var(--surface) 0%, var(--cream) 100%);
    color: var(--ink-2);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    line-height: 1.7;
  }
  /* Horizontal clipping (for the decorative corner glows below, which
     extend past the edges) lives on html/body instead of on .legal-page
     itself — matching the landing page's exact pattern. Putting
     overflow-x:hidden directly on this div forces the browser to make
     overflow-y a *used* value of auto regardless of what overflow-y is set
     to on that same box (a CSS overflow-spec quirk that setting
     overflow-y:visible explicitly does NOT prevent) — that's what was
     turning this div into its own scroll container with a second,
     always-visible scrollbar. */
  html, body {
    overflow-x: hidden;
  }
  .legal-glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(10px);
  }
  .legal-glow--tl {
    width: 520px; height: 520px; top: -220px; left: -220px;
    background: radial-gradient(circle, rgba(255,106,61,0.14) 0%, transparent 68%);
  }
  .legal-glow--br {
    width: 440px; height: 440px; bottom: -180px; right: -180px;
    background: radial-gradient(circle, rgba(74,103,65,0.08) 0%, transparent 68%);
  }
  /* Not sticky — position:sticky on this header was producing a stray
     second scrollbar-track artifact, so it just scrolls with the page. */
  .legal-header-accent {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, transparent 0%, var(--accent) 22%, var(--accent-2) 50%, var(--accent) 78%, transparent 100%);
  }
  .legal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.05rem clamp(1.25rem, 4vw, 3rem);
    background: rgba(247, 245, 241, 0.86);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-bottom: 1px solid rgba(224, 218, 208, 0.75);
    box-shadow: 0 8px 22px rgba(12, 10, 8, 0.05);
  }
  .legal-header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--ink);
  }
  .legal-header-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(160deg, #fff8f5 0%, #ffe0d2 100%);
    border: 1px solid rgba(217, 79, 42, 0.18);
    box-shadow: 0 3px 10px rgba(217, 79, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.75);
    flex-shrink: 0;
    transition: transform 0.3s var(--ease-out-expo);
  }
  .legal-header-brand:hover .legal-header-mark { transform: rotate(-4deg); }
  .legal-header-mark img { height: 22px; width: auto; display: block; filter: drop-shadow(0 1px 2px rgba(217, 79, 42, 0.22)); }
  .legal-header-word {
    font-family: 'DM Sans', 'Inter', sans-serif;
    font-weight: 900;
    font-size: 1.3rem;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    background: linear-gradient(95deg, var(--accent-h) 0%, var(--accent) 58%, var(--accent-2) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: var(--accent);
  }
  .legal-back {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--ink-2);
    text-decoration: none;
    padding: 9px 16px;
    border-radius: 999px;
    border: 1px solid rgba(224, 218, 208, 0.9);
    background: var(--surface);
    overflow: hidden;
    transition: color 0.2s var(--ease-out-expo), border-color 0.2s var(--ease-out-expo), background 0.2s var(--ease-out-expo);
  }
  .legal-back svg { position: relative; z-index: 1; transition: transform 0.25s var(--ease-out-expo); }
  .legal-back span { position: relative; z-index: 1; }
  .legal-back:hover {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  }
  .legal-back:hover svg { transform: translateX(-3px); }

  /* ── Hero ── */
  .legal-hero {
    position: relative;
    z-index: 1;
    max-width: 46rem;
    margin: 0 auto;
    text-align: center;
    padding: clamp(3rem, 7vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(2rem, 5vw, 3rem);
  }
  .legal-eyebrow {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-h);
    background: var(--accent-s);
    border: 1px solid rgba(217, 79, 42, 0.16);
    border-radius: 999px;
    padding: 6px 16px;
    margin-bottom: 1.25rem;
  }
  .legal-title {
    font-family: 'DM Sans', 'Inter', sans-serif;
    font-size: clamp(2.1rem, 5vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--ink);
    margin: 0 0 0.85rem;
  }
  .legal-intro {
    font-size: 1.02rem;
    color: var(--ink-3);
    max-width: 38rem;
    margin: 0 auto 1.5rem;
  }
  .legal-updated-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid rgba(224, 218, 208, 0.9);
    border-radius: 999px;
    padding: 6px 14px;
  }

  /* ── Layout — single column. A sticky sidebar TOC alongside the sticky
     header created a second, independent scroll context (its own visible
     scrollbar track) for what's just a handful of short documents; one
     plain reading column avoids that entirely. ── */
  .legal-layout {
    position: relative;
    z-index: 1;
    max-width: 44rem;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2rem) clamp(4rem, 8vw, 6rem);
  }
  .legal-content { min-width: 0; }

  /* ── Quick-summary callout ── */
  .legal-summary {
    background: linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(252,250,247,0.95) 100%);
    border: 1px solid rgba(224,218,208,0.9);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-s);
    padding: clamp(1.4rem, 3vw, 1.85rem);
    margin-bottom: clamp(2rem, 4vw, 2.75rem);
    position: relative;
    overflow: hidden;
  }
  .legal-summary::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 4px; height: 100%;
    background: linear-gradient(180deg, var(--accent), var(--accent-2));
  }
  .legal-summary-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-h);
    margin-bottom: 0.9rem;
  }
  .legal-summary ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.65rem; }
  .legal-summary li {
    position: relative;
    padding-left: 1.35rem;
    font-size: 0.93rem;
    color: var(--ink-2);
    font-weight: 500;
  }
  .legal-summary li::before {
    content: '';
    position: absolute;
    left: 0; top: 0.5em;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  /* ── Numbered sections ── */
  .legal-section {
    scroll-margin-top: 96px;
    display: flex;
    gap: clamp(1rem, 2.5vw, 1.5rem);
    padding: clamp(1.5rem, 3vw, 2rem) 0;
    border-bottom: 1px solid rgba(224, 218, 208, 0.7);
  }
  .legal-section:last-of-type { border-bottom: none; }
  .legal-section-num {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: var(--accent-s);
    color: var(--accent-h);
    font-family: 'DM Sans', 'Inter', sans-serif;
    font-weight: 800;
    font-size: 0.85rem;
  }
  .legal-section-body { min-width: 0; }
  .legal-section h2 {
    font-family: 'DM Sans', 'Inter', sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--ink);
    letter-spacing: -0.01em;
    margin: 0.15rem 0 0.75rem;
  }
  .legal-section p { margin: 0 0 1rem; font-size: 0.96rem; color: var(--ink-2); }
  .legal-section p:last-child { margin-bottom: 0; }
  .legal-section ul { margin: 0 0 1rem; padding-left: 1.2rem; }
  .legal-section li { margin-bottom: 0.5rem; font-size: 0.96rem; }
  .legal-section strong { color: var(--ink); }
  .legal-section a { color: var(--accent-h); font-weight: 600; text-decoration: none; }
  .legal-section a:hover { text-decoration: underline; }

  .legal-contact-box {
    margin-top: clamp(2rem, 4vw, 2.75rem);
    padding: 1.35rem 1.5rem;
    background: linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(252,250,247,0.95) 100%);
    border: 1px solid rgba(224, 218, 208, 0.9);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-s);
  }
  .legal-contact-box p { margin: 0; font-size: 0.92rem; color: var(--ink-2); }
  .legal-contact-box a { color: var(--accent-h); font-weight: 700; text-decoration: none; }
  .legal-contact-box a:hover { text-decoration: underline; }
`;

function useFooterContent() {
  return useMemo(() => loadSiteContent().footer, []);
}

function LegalPageShell({ eyebrow, title, intro, updated, summary, sections }) {
  const footer = useFooterContent();

  return (
    <div className="legal-page">
      <style>{LEGAL_STYLES}</style>
      <div className="legal-glow legal-glow--tl" aria-hidden="true" />
      <div className="legal-glow legal-glow--br" aria-hidden="true" />

      <div className="legal-header-sticky">
        <div className="legal-header-accent" aria-hidden="true" />
        <header className="legal-header">
          <Link to="/" className="legal-header-brand">
            <span className="legal-header-mark">
              <img src={logo} alt="" />
            </span>
            <span className="legal-header-word">Kalinga</span>
          </Link>
          <Link to="/" className="legal-back">
            <ArrowLeft size={15} />
            <span>Back to home</span>
          </Link>
        </header>
      </div>

      <div className="legal-hero">
        <span className="legal-eyebrow">{eyebrow}</span>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-intro">{intro}</p>
        <span className="legal-updated-chip">Last updated {updated}</span>
      </div>

      <div className="legal-layout">
        <div className="legal-content">
          {summary ? (
            <div className="legal-summary">
              <span className="legal-summary-label">Quick summary</span>
              <ul>
                {summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-section">
              <span className="legal-section-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="legal-section-body">
                <h2>{s.title}</h2>
                {s.body}
              </div>
            </section>
          ))}

          <div className="legal-contact-box">
            <p>
              Questions about this document? Reach us at{' '}
              <a href={`mailto:${footer.email}`}>{footer.email}</a> or{' '}
              <a href={`tel:${footer.phoneTel}`}>{footer.phone}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermsOfService() {
  const sections = [
    {
      id: 'acceptance',
      title: 'Acceptance of terms',
      body: (
        <p>
          These Terms of Service govern your use of the Bridges of Hope ("Kalinga") website, family portal
          mobile app, and staff systems (together, the "Services"), operated by Bridges of Hope. By creating
          an account or otherwise using the Services, you agree to these terms.
        </p>
      ),
    },
    {
      id: 'who-for',
      title: 'Who the Services are for',
      body: (
        <p>
          The Services support a residential addiction-recovery care facility. The staff-facing web portal is
          used by authorized administrators, nurses, and program staff. The family portal (available on our
          mobile app) is used by the family members and authorized contacts of residents receiving care, to
          stay informed on admission status, visitation, progress reports, and care-team communication.
        </p>
      ),
    },
    {
      id: 'accounts',
      title: 'Accounts and access',
      body: (
        <ul>
          <li>You're responsible for keeping your login credentials confidential and for all activity under your account.</li>
          <li>Staff accounts are provisioned and role-restricted by facility administrators; family accounts are created after an admission or consent process.</li>
          <li>Notify us immediately if you suspect unauthorized access to your account.</li>
        </ul>
      ),
    },
    {
      id: 'emergency',
      title: 'Not a substitute for emergency care',
      body: (
        <p>
          The Services are a communication and records tool — they are <strong>not</strong> a substitute for
          emergency medical or psychiatric services. If you or someone you know is experiencing a medical
          emergency or crisis, contact local emergency services immediately rather than relying on messages
          sent through this platform.
        </p>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      body: (
        <p>
          You agree not to misuse the Services — including attempting to access records you're not authorized
          to view, interfering with the platform's normal operation, or using it to harass any resident, family
          member, or staff member.
        </p>
      ),
    },
    {
      id: 'content',
      title: 'Content and records',
      body: (
        <p>
          Care records, admission documents, messages, and reports created through the Services remain the
          property of Bridges of Hope and the individuals they describe, handled in line with our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes and termination',
      body: (
        <p>
          We may update these Services or these Terms from time to time, and may suspend or terminate access
          for accounts that violate these Terms or applicable law. We'll make reasonable efforts to notify
          account holders of material changes.
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      body: (
        <p>
          The Services are provided "as is." To the fullest extent permitted by law, Bridges of Hope is not
          liable for indirect or incidental damages arising from use of the Services, though nothing here
          limits liability that cannot be excluded under applicable law.
        </p>
      ),
    },
  ];

  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Service"
      intro="The ground rules for using the Kalinga family portal and staff systems — written in plain language, not legalese for its own sake."
      updated="January 2026"
      summary={[
        'The Services coordinate care between our staff and a resident’s family — they aren’t an emergency line.',
        'Keep your login private; staff and family accounts are role-restricted to what each person needs to see.',
        'We can update these terms or suspend accounts that misuse the Services; we’ll try to give notice either way.',
      ]}
      sections={sections}
    />
  );
}

export function PrivacyPolicy() {
  const sections = [
    {
      id: 'scope',
      title: 'What this policy covers',
      body: (
        <p>
          This Privacy Policy explains how Bridges of Hope collects, uses, and protects information through
          our website, family portal app, and staff systems. Because we operate a residential care facility,
          some of the information we handle is sensitive health-related information — we treat it accordingly.
        </p>
      ),
    },
    {
      id: 'collect',
      title: 'Information we collect',
      body: (
        <ul>
          <li><strong>Account information</strong> — name, email, phone number, and account role.</li>
          <li><strong>Admission and care information</strong> — admission requests, resident progress reports, appointment and visitation records, and care-team messages, submitted by families or entered by staff.</li>
          <li><strong>Usage information</strong> — basic technical data (device type, app version) needed to keep the Services running reliably.</li>
        </ul>
      ),
    },
    {
      id: 'use',
      title: 'How we use it',
      body: (
        <ul>
          <li>To coordinate care — admissions, discharges, appointments, and progress updates between staff and family.</li>
          <li>To send notifications relevant to a resident's care (e.g. a new report or an admission status change).</li>
          <li>To maintain the security and integrity of resident and account records.</li>
        </ul>
      ),
    },
    {
      id: 'share',
      title: 'How we share it',
      body: (
        <p>
          We do not sell personal or health-related information. Resident care information is only visible to
          that resident's authorized family contacts and the assigned care team, and is shared with outside
          parties only when required by law or with explicit consent (for example, referrals to another
          healthcare provider).
        </p>
      ),
    },
    {
      id: 'security',
      title: 'Data storage and security',
      body: (
        <p>
          Account and care data is stored with access-controlled cloud infrastructure (Supabase), with
          role-based permissions so staff and family accounts can only reach the records they're authorized
          to see. No system is perfectly secure, but we apply reasonable technical and organizational
          safeguards appropriate to the sensitivity of this data.
        </p>
      ),
    },
    {
      id: 'rights',
      title: 'Your rights',
      body: (
        <p>
          You may request access to, correction of, or deletion of your personal information by contacting us
          below. Deletion requests for active resident care records may be limited where retention is required
          for continuity of care or by law.
        </p>
      ),
    },
    {
      id: 'cookies-ref',
      title: 'Cookies and local storage',
      body: (
        <p>
          Our website uses a small amount of local storage for essential functions like keeping you signed in
          and remembering site preferences — see our <Link to="/cookies">Cookie Policy</Link> for details.
        </p>
      ),
    },
    {
      id: 'children',
      title: "Children's privacy",
      body: (
        <p>
          Our family portal may involve information about residents of any age, submitted by an authorized
          adult family member or guardian, not directly collected from children.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          We may update this Privacy Policy as the Services evolve. Material changes will be reflected by
          updating the date at the top of this page.
        </p>
      ),
    },
  ];

  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How we handle account information and resident care data across the Kalinga family portal and staff systems."
      updated="January 2026"
      summary={[
        'We never sell personal or health information — it’s visible only to a resident’s family and assigned care team.',
        'Care data is stored on access-controlled infrastructure with role-based permissions per account.',
        'You can request access to, correction of, or deletion of your information at any time.',
      ]}
      sections={sections}
    />
  );
}

export function CookiePolicy() {
  const sections = [
    {
      id: 'what-we-use',
      title: 'What we use',
      body: (
        <p>
          Our website and family portal app use a small set of essential cookies and local-storage entries to
          function — we don't use third-party advertising trackers.
        </p>
      ),
    },
    {
      id: 'essential',
      title: 'Essential storage',
      body: (
        <>
          <ul>
            <li><strong>Authentication</strong> — keeps you signed in securely between visits (via Supabase auth).</li>
            <li><strong>Preferences</strong> — remembers small UI choices, like whether you've dismissed a banner.</li>
          </ul>
          <p>These are required for the Services to work and can't be individually turned off without signing out.</p>
        </>
      ),
    },
    {
      id: 'not-used',
      title: "What we don't use",
      body: (
        <p>
          We don't use third-party advertising or cross-site tracking cookies. Any analytics we use are
          limited to understanding overall site usage, not tracking individuals across other websites.
        </p>
      ),
    },
    {
      id: 'managing',
      title: 'Managing cookies in your browser',
      body: (
        <p>
          Most browsers let you clear or block cookies through their settings. Doing so may sign you out of
          the Services or reset saved preferences.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          If the way we use cookies or local storage changes meaningfully, we'll update this page and the date
          above.
        </p>
      ),
    },
  ];

  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      intro="A short, honest page — because most cookie policies are longer than the actual list of cookies."
      updated="January 2026"
      summary={[
        'Essential-only: sign-in and basic preferences. No third-party ad trackers.',
        'Nothing here is used to follow you across other websites.',
        'Clearing cookies in your browser will simply sign you out.',
      ]}
      sections={sections}
    />
  );
}

export default function LegalPage() {
  return <TermsOfService />;
}
