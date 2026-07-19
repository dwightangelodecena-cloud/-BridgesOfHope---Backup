import React, { useEffect, useState } from 'react';
import { LayoutGrid, BookUser, LogOut, Users, ArrowRightSquare, Stethoscope, LayoutTemplate, ClipboardList, User, Calendar, FileText, MessageCircle, KeyRound } from 'lucide-react';
import { AdminMessagesNavItem } from '@/components/admin/AdminMessagesNavItem';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import logoBH from '@/assets/kalingalogo.png';
import { supabase } from '@/lib/supabase';
import { clearAdminApprovalPin, getAdminApprovalPin, setAdminApprovalPin, verifyAdminApprovalPin } from '@/lib/adminApprovalPin';
import { getPasswordPolicyError, getPasswordStrengthChecks, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import { formatAuthError } from '@/lib/authErrors';

const AdminProfile = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userId, setUserId] = useState('');
  const [savedPinExists, setSavedPinExists] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      const id = user?.id || 'global';
      setUserId(id);
      setAccountEmail(String(user?.email || ''));
      setSavedPinExists(Boolean(getAdminApprovalPin(id)));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSavePin = (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!/^\d{4}$/.test(newPin)) {
      setErr('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setErr('New PIN and confirmation do not match.');
      return;
    }
    if (savedPinExists && !verifyAdminApprovalPin(currentPin, userId, '')) {
      setErr('Current PIN is incorrect.');
      return;
    }
    setAdminApprovalPin(userId, newPin);
    setSavedPinExists(true);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setMsg('2FA approval PIN saved successfully.');
  };

  const handleClearPin = () => {
    clearAdminApprovalPin(userId);
    setSavedPinExists(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setErr('');
    setMsg('Saved PIN removed. System will fallback to env PIN if configured.');
  };

  const pwChecks = getPasswordStrengthChecks(newPassword);
  const passwordsMatch = confirmPassword !== '' && newPassword === confirmPassword;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    setPwMsg('');
    if (!String(currentPassword).trim()) {
      setPwErr('Enter your current password.');
      return;
    }
    const policyErr = getPasswordPolicyError(newPassword);
    if (policyErr) {
      setPwErr(policyErr);
      return;
    }
    if (!passwordsMatch) {
      setPwErr('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        setPwErr('Could not load your account email.');
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signErr) {
        setPwErr(formatAuthError(signErr));
        return;
      }
      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
      if (upErr) {
        setPwErr(formatAuthError(upErr));
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg('Password updated successfully.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="family-portal admin-portal-layout ap-outer" style={{display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .ap-outer { width: 100%; max-width: 100%; overflow-x: hidden; }
        .ap-main { flex: 1; min-height: 100vh;   padding: 34px 30px 42px; display: flex; flex-direction: column; align-items: center; }
        .ap-hero {
          max-width: 980px;
          border-radius: 22px;
          border: 1px solid rgba(245, 78, 37, 0.18);
          background: linear-gradient(145deg, #ffffff 0%, #fff9f7 55%, #fff4ef 100%);
          padding: 24px 26px;
          box-shadow: 0 10px 28px rgba(27, 37, 89, 0.06);
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ap-hero-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #F54E25; margin-bottom: 8px; }
        .ap-hero-title { font-size: 30px; font-weight: 900; color: #0F172A; line-height: 1.1; margin-bottom: 6px; }
        .ap-hero-sub { font-size: 14px; color: #64748B; max-width: 620px; line-height: 1.5; font-weight: 500; }
        .ap-hero-pill {
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          background: white;
          padding: 10px 12px;
          min-width: 170px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        }
        .ap-card {
          max-width: 980px;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          padding: 26px;
          box-shadow: 0 8px 26px rgba(0,0,0,0.05);
        }
        .ap-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
        .ap-panel {
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 18px;
          background: #fff;
        }
        .ap-side {
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 16px;
          background: #F8FAFC;
        }
        .ap-side-title { font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 10px; }
        .ap-side-item { font-size: 12px; color: #475569; line-height: 1.5; margin-bottom: 8px; font-weight: 600; }
        .ap-label { font-size: 13px; font-weight: 700; color: #1B2559; margin-bottom: 6px; display: block; }
        .ap-input { width: 100%; padding: 11px 12px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; margin-bottom: 14px; background: white; }
        .ap-input:focus { outline: none; border-color: #F54E25; box-shadow: 0 0 0 2px rgba(245, 78, 37, 0.15); }
        .ap-btn { border: none; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .ap-btn-primary { background: linear-gradient(145deg, #F54E25, #EA5A37); color: white; box-shadow: 0 8px 18px rgba(245, 78, 37, 0.28); }
        .ap-btn-secondary { background: #EEF2FF; color: #1B2559; margin-left: 10px; }
        @media (max-width: 980px) {
          .ap-grid { grid-template-columns: 1fr; }
          .ap-side { order: -1; }
        }
      `}</style>

      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <main className="ap-main admin-sidebar-offset">
        <section className="ap-hero">
          <div>
            <div className="ap-hero-kicker">Admin settings</div>
            <div className="ap-hero-title">Profile & Security</div>
            <p className="ap-hero-sub">Manage your login password and your 2FA approval PIN. Your PIN is required before critical admission and discharge decisions are finalized.</p>
          </div>
          <div className="ap-hero-pill">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2FA status</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: savedPinExists ? '#166534' : '#B45309', marginTop: 4 }}>
              {savedPinExists ? 'Configured' : 'Not set'}
            </div>
          </div>
        </section>

        <section className="ap-card">
          <div className="ap-grid">
            <div className="ap-panel">
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>2FA Approval PIN</h2>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                Set your own 4-digit PIN for admission/discharge approvals. This PIN is used by the 2FA approval modal.
              </p>

              <form onSubmit={handleSavePin}>
                {savedPinExists ? (
                  <>
                    <label className="ap-label">Current PIN</label>
                    <input className="ap-input" type="password" maxLength={4} inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                  </>
                ) : null}
                <label className="ap-label">New PIN (4 digits)</label>
                <input className="ap-input" type="password" maxLength={4} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                <label className="ap-label">Confirm New PIN</label>
                <input className="ap-input" type="password" maxLength={4} inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                {err ? <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div> : null}
                {msg ? <div style={{ color: '#166534', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{msg}</div> : null}
                <button type="submit" className="ap-btn ap-btn-primary">Save PIN</button>
                {savedPinExists ? <button type="button" className="ap-btn ap-btn-secondary" onClick={handleClearPin}>Remove Saved PIN</button> : null}
              </form>
            </div>

            <aside className="ap-side">
              <div className="ap-side-title">Security Notes</div>
              <div className="ap-side-item">Use a PIN only admins know. Avoid repeated numbers like 0000 or 1234.</div>
              <div className="ap-side-item">Changing your PIN updates approval checks immediately.</div>
              <div className="ap-side-item">If removed, system falls back to environment PIN when configured.</div>
            </aside>
          </div>
        </section>

        <section className="ap-card" style={{ marginTop: 18 }}>
          <div className="ap-grid">
            <div className="ap-panel">
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={22} color="#F54E25" aria-hidden />
                Change password
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                Update the password you use to sign in with email. You must enter your current password first.
                {accountEmail ? (
                  <span style={{ display: 'block', marginTop: 8, fontWeight: 600, color: '#475569' }}>
                    Account: {accountEmail}
                  </span>
                ) : null}
              </p>

              <form onSubmit={handleChangePassword}>
                <label className="ap-label">Current password</label>
                <input
                  className="ap-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <label className="ap-label">New password</label>
                <input
                  className="ap-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    borderColor: newPassword && pwChecks.isValid ? '#10b981' : undefined,
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748B',
                    marginTop: -8,
                    marginBottom: 14,
                    lineHeight: 1.45,
                  }}
                  aria-label="Password requirements"
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Requirements</div>
                  {[
                    ['lengthOk', `At least ${PASSWORD_MIN_LENGTH} characters`],
                    ['upper', 'One uppercase letter'],
                    ['lower', 'One lowercase letter'],
                    ['number', 'One number'],
                    ['special', 'One special character (!@#$… )'],
                    ['noSpaces', 'No spaces'],
                  ].map(([key, label]) => (
                    <div key={key} style={{ color: pwChecks[key] ? '#166534' : '#94a3b8' }}>
                      {pwChecks[key] ? '✓ ' : '○ '}
                      {label}
                    </div>
                  ))}
                </div>
                <label className="ap-label">Confirm new password</label>
                <input
                  className="ap-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    borderColor:
                      confirmPassword === ''
                        ? undefined
                        : passwordsMatch
                          ? '#10b981'
                          : '#ef4444',
                  }}
                />
                {confirmPassword !== '' && !passwordsMatch ? (
                  <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                    Passwords do not match.
                  </div>
                ) : null}
                {pwErr ? <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{pwErr}</div> : null}
                {pwMsg ? <div style={{ color: '#166534', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{pwMsg}</div> : null}
                <button type="submit" className="ap-btn ap-btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>

            <aside className="ap-side">
              <div className="ap-side-title">Password tips</div>
              <div className="ap-side-item">Use a unique password you do not reuse on other sites.</div>
              <div className="ap-side-item">After a successful change, use the new password on your next sign-in on other devices.</div>
              <div className="ap-side-item">If you sign in only with Google or another provider, email/password changes may not apply—use that provider&apos;s account security instead.</div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminProfile;
