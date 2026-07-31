import React, { useState, useEffect } from 'react';
import { LayoutGrid, User, LogOut, Users, Calendar, FileText, ClipboardCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

import logo from '@/assets/kalingalogo.png';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { supabase } from '@/lib/supabase';
import { getPasswordPolicyError, getPasswordStrengthChecks, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import { formatAuthError } from '@/lib/authErrors';

function accountTypeLabel(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'nurse') return 'Nurse';
  if (s === 'admin') return 'Admin';
  if (s === 'program') return 'Program staff';
  if (s === 'family') return 'Family';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Staff';
}

function displayNameFromUserAndProfile(user, profileRow) {
  const meta =
    user?.user_metadata?.full_name ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ');
  const fromProfile = profileRow?.full_name?.trim();
  const emailLocal = String(user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return fromProfile || meta || emailLocal || 'Nurse';
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'N';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NurseProfile = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const [accountEmail, setAccountEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setProfileLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setProfileLoading(false);
        navigate('/login');
        return;
      }
      setAccountEmail(String(user.email || ''));
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, phone, account_type')
        .eq('id', user.id)
        .maybeSingle();
      if (!mounted) return;
      setDisplayName(displayNameFromUserAndProfile(user, profileRow));
      setAccountType(accountTypeLabel(profileRow?.account_type));
      setProfilePhone(String(profileRow?.phone || '').trim());
      setProfileLoading(false);
    })();
    return () => { mounted = false; };
  }, [navigate]);

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
      const { data: { user } } = await supabase.auth.getUser();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const badgeInitials = initialsFromName(displayName);

  return (
    <div className="app-container family-portal admin-portal-layout" style={familySidebarStyle(isExpanded)}>
      <style>{`
        .app-container {
          display: flex;
          width: 100%;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

        /* MAIN */
        .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .top-nav {
          height: 100px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 40px;
          border-bottom: 1px solid #F1F1F1;
        }

        .scroll-content {
          flex: 1;
          padding: 30px 40px 48px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
        }

        .np-wrap { width: 100%; max-width: 980px; }
        .np-hero {
          width: 100%;
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
        .np-hero-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #F54E25; margin-bottom: 8px; }
        .np-hero-title { font-size: 28px; font-weight: 900; color: #0F172A; line-height: 1.1; margin-bottom: 6px; }
        .np-hero-sub { font-size: 14px; color: #64748B; max-width: 620px; line-height: 1.5; font-weight: 500; }
        .np-hero-pill {
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          background: white;
          padding: 10px 12px;
          min-width: 170px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        }
        .np-card {
          width: 100%;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          padding: 26px;
          box-shadow: 0 8px 26px rgba(0,0,0,0.05);
          margin-bottom: 18px;
        }
        .np-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
        .np-panel { border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; background: #fff; }
        .np-side { border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px; background: #F8FAFC; }
        .np-side-title { font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 10px; }
        .np-side-item { font-size: 12px; color: #475569; line-height: 1.5; margin-bottom: 8px; font-weight: 600; }
        .np-label { font-size: 13px; font-weight: 700; color: #1B2559; margin-bottom: 6px; display: block; }
        .np-input { width: 100%; padding: 11px 12px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; margin-bottom: 14px; background: white; }
        .np-input:focus { outline: none; border-color: #F54E25; box-shadow: 0 0 0 2px rgba(245, 78, 37, 0.15); }
        .np-pw-field { position: relative; width: 100%; margin-bottom: 14px; }
        .np-input.np-input--pw { margin-bottom: 0; padding-right: 44px; box-sizing: border-box; }
        .np-pw-toggle {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          border: none; background: transparent; padding: 6px; cursor: pointer;
          color: #64748B; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; line-height: 0;
        }
        .np-pw-toggle:hover { color: #1B2559; background: #f1f5f9; }
        .np-pw-toggle:focus-visible { outline: 2px solid #F54E25; outline-offset: 2px; }
        .np-btn { border: none; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .np-btn-primary { background: linear-gradient(145deg, #F54E25, #EA5A37); color: white; box-shadow: 0 8px 18px rgba(245, 78, 37, 0.28); }
        .np-account-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
        .np-account-row:last-child { border-bottom: none; padding-bottom: 0; }
        .np-account-k { color: #64748B; font-weight: 600; }
        .np-account-v { color: #0F172A; font-weight: 700; text-align: right; word-break: break-word; }
        @media (max-width: 980px) {
          .np-grid { grid-template-columns: 1fr; }
          .np-side { order: -1; }
        }

        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .app-container { flex-direction: column; height: 100vh; overflow: hidden; }
          .main-view { margin-left: 0 !important; transition: none !important; }
          .mobile-top-bar {
            position: sticky;
            top: 0;
            z-index: 300;
            width: 90vw;
            padding: 0 20px;
            height: 64px;
            background: white;
            border-bottom: 1px solid #F1F1F1;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .mobile-top-bar-title {
            font-size: 16px;
            font-weight: 800;
            color: #F54E25;
          }
          .scroll-content { padding: 15px !important; padding-bottom: 100px !important; align-items: flex-start !important; overflow-y: auto; }
          .np-wrap { max-width: 100%; }
          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            min-height: 72px;
            background: white;
            border-top: 1px solid #F1F1F1;
            display: flex;
            justify-content: space-around;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px 2px;
            padding: 6px 4px;
            z-index: 1000;
            padding-bottom: calc(6px + env(safe-area-inset-bottom));
            box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
          }
          .mob-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            font-weight: 700;
            color: #A3AED0;
            cursor: pointer;
            min-width: 0;
            flex: 1 1 0;
            max-width: 72px;
          }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        dashboardPath="/nurse-dashboard"
        brandTagline="Nurse Portal"
        profilePath="/nurseprofile"
        profileLabel="Profile"
        onLogout={() => void handleLogout()}
      >
        <div
          className={`sidebar-nav-item${pathname === '/nurse-dashboard' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}
        >
          <div className="sidebar-icon-wrap"><LayoutGrid size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Dashboard</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/patient-database' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}
        >
          <div className="sidebar-icon-wrap"><Users size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Residents</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-pending-admissions' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-pending-admissions'); }}
        >
          <div className="sidebar-icon-wrap"><ClipboardCheck size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Pending Admissions</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-calendar' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-calendar'); }}
        >
          <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Calendar</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-medical-report' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-medical-report'); }}
        >
          <div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Medical Report</span>
        </div>
      </AdminSidebar>

      <div className="main-view admin-sidebar-offset">

        {/* DESKTOP TOP NAV */}
        <header className="top-nav">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#F54E25', fontWeight: 800, fontSize: 23 }}>{'Profile & security'}</span>
            <span style={{ color: '#1B2559', fontWeight: 600, fontSize: 17 }}>
              {profileLoading ? 'Loading…' : `Welcome, ${displayName}`}
            </span>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              width: 40,
              height: 40,
              background: '#F54E25',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
            }}
            aria-hidden
          >
            {badgeInitials}
          </div>
        </header>

        {/* MOBILE TOP BAR */}
        <div className="mobile-only mobile-top-bar">
          <img src={logo} alt="Kalinga" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span className="mobile-top-bar-title">Profile</span>
          <div
            style={{
              width: 36,
              height: 36,
              background: '#F54E25',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 11,
            }}
            aria-hidden
          >
            {badgeInitials}
          </div>
        </div>

        <div className="scroll-content">
          <div className="np-wrap">
            <section className="np-hero">
              <div>
                <div className="np-hero-kicker">Nurse settings</div>
                <div className="np-hero-title">Your account</div>
                <p className="np-hero-sub">
                  This page is tied to the nurse account you signed in with. Update your password here; profile details come from your staff record.
                </p>
              </div>
              <div className="np-hero-pill">
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{profileLoading ? '…' : accountType}</div>
              </div>
            </section>

            <section className="np-card">
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Account details</h2>
              {profileLoading ? (
                <p style={{ color: '#64748B', fontWeight: 600 }}>Loading your profile…</p>
              ) : (
                <div className="np-panel">
                  <div className="np-account-row">
                    <span className="np-account-k">Name</span>
                    <span className="np-account-v">{displayName}</span>
                  </div>
                  <div className="np-account-row">
                    <span className="np-account-k">Email</span>
                    <span className="np-account-v">{accountEmail || '—'}</span>
                  </div>
                  {profilePhone ? (
                    <div className="np-account-row">
                      <span className="np-account-k">Phone</span>
                      <span className="np-account-v">{profilePhone}</span>
                    </div>
                  ) : null}
                  <div className="np-account-row">
                    <span className="np-account-k">Account type</span>
                    <span className="np-account-v">{accountType}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="np-card">
              <div className="np-grid">
                <div className="np-panel">
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
                    <label className="np-label">Current password</label>
                    <div className="np-pw-field">
                      <input
                        className="np-input np-input--pw"
                        type={showCurrentPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="np-pw-toggle"
                        aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                        onClick={() => setShowCurrentPw((v) => !v)}
                      >
                        {showCurrentPw ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                      </button>
                    </div>
                    <label className="np-label">New password</label>
                    <div className="np-pw-field">
                      <input
                        className="np-input np-input--pw"
                        type={showNewPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ borderColor: newPassword && pwChecks.isValid ? '#10b981' : undefined }}
                      />
                      <button
                        type="button"
                        className="np-pw-toggle"
                        aria-label={showNewPw ? 'Hide password' : 'Show password'}
                        onClick={() => setShowNewPw((v) => !v)}
                      >
                        {showNewPw ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                      </button>
                    </div>
                    <div
                      style={{ fontSize: 12, color: '#64748B', marginTop: -8, marginBottom: 14, lineHeight: 1.45 }}
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
                    <label className="np-label">Confirm new password</label>
                    <div className="np-pw-field">
                      <input
                        className="np-input np-input--pw"
                        type={showConfirmPw ? 'text' : 'password'}
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
                      <button
                        type="button"
                        className="np-pw-toggle"
                        aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                        onClick={() => setShowConfirmPw((v) => !v)}
                      >
                        {showConfirmPw ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                      </button>
                    </div>
                    {confirmPassword !== '' && !passwordsMatch ? (
                      <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                        Passwords do not match.
                      </div>
                    ) : null}
                    {pwErr ? <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{pwErr}</div> : null}
                    {pwMsg ? <div style={{ color: '#166534', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{pwMsg}</div> : null}
                    <button type="submit" className="np-btn np-btn-primary" disabled={pwSaving}>
                      {pwSaving ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                </div>
                <aside className="np-side">
                  <div className="np-side-title">Password tips</div>
                  <div className="np-side-item">Use a unique password you do not reuse on other sites.</div>
                  <div className="np-side-item">After a successful change, use the new password on your next sign-in on other devices.</div>
                  <div className="np-side-item">If you sign in only with Google or another provider, email/password changes may not apply—use that provider&apos;s account security instead.</div>
                </aside>
              </div>
            </section>

          </div>
        </div>

        {/* MOBILE BOTTOM NAV — mirrors desktop sidebar */}
        <div className="mobile-only mobile-bottom-nav">
          <div className="mob-nav-item" onClick={() => navigate('/nurse-dashboard')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <LayoutGrid size={20} color="#707EAE" />
            </div>
            <span>Dashboard</span>
          </div>
          <div className="mob-nav-item" onClick={() => navigate('/patient-database')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <Users size={20} color="#707EAE" />
            </div>
            <span>Residents</span>
          </div>
          <div className="mob-nav-item" onClick={() => navigate('/nurse-calendar')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <Calendar size={20} color="#707EAE" />
            </div>
            <span>Calendar</span>
          </div>
          <div className="mob-nav-item" onClick={() => navigate('/nurse-medical-report')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <FileText size={20} color="#707EAE" />
            </div>
            <span>Medical</span>
          </div>
          <div className="mob-nav-item active" onClick={() => navigate('/nurseprofile')}>
            <User size={22} color="#F54E25" />
            <span>Profile</span>
          </div>
          <div className="mob-nav-item" onClick={() => void handleLogout()}>
            <LogOut size={22} color="#F54E25" />
            <span style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NurseProfile;