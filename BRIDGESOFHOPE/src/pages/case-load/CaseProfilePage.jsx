import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPasswordPolicyError, getPasswordStrengthChecks, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import { formatAuthError } from '@/lib/authErrors';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseProfilePage() {
  const navigate = useNavigate();
  const { me, patients } = useCaseLoad();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
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
    <ClmPageShell
      narrow
      title="Profile"
      lede="Your CLM account and shortcuts to internal tools."
    >
      <div className="cl-hero" style={{ marginBottom: 14 }}>
        <p className="cl-hero-title">CLM Account Center</p>
        <p className="cl-hero-sub">Access your core workspace actions, reporting history, and policy references from one place.</p>
      </div>
      <div className="cl-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: '#FFF7ED',
            color: '#F54E25',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          >
            <User size={28} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>{me.fullName || 'Case Load Manager'}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{me.email || '—'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>Role: Case Load Manager · Caseload: {patients.length} active</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" className="cl-save-btn" style={{ background: '#1B2559', width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/case-dashboard/reports')}>
            <FileText size={18} /> CLM report history
          </button>
          <button type="button" className="cl-save-btn" style={{ background: '#64748b', width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/case-dashboard/resources')}>
            <BookOpen size={18} /> Operations guide
          </button>
          <button type="button" className="cl-save-btn" style={{ background: '#0F766E', width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/admin-recovery-roadmap')}>
            <CheckCircle2 size={18} /> Recovery roadmap
          </button>
          <button type="button" className="cl-save-btn" style={{ background: '#F54E25', width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/login')}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </div>

      <div className="cl-card" style={{ marginTop: 14 }}>
        <div className="cl-card-title">Change password</div>
        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 14px', lineHeight: 1.5 }}>
          Update your CLM sign-in password. Enter your current password first for verification.
        </p>
        <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 10 }}>
          <div>
            <label className="cl-label">Current password</label>
            <input
              className="cl-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="cl-label">New password</label>
            <input
              className="cl-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ borderColor: newPassword && pwChecks.isValid ? '#10b981' : undefined }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Requirements</div>
            {[
              ['lengthOk', `At least ${PASSWORD_MIN_LENGTH} characters`],
              ['upper', 'One uppercase letter'],
              ['lower', 'One lowercase letter'],
              ['number', 'One number'],
              ['special', 'One special character (!@#$... )'],
              ['noSpaces', 'No spaces'],
            ].map(([key, label]) => (
              <div key={key} style={{ color: pwChecks[key] ? '#166534' : '#94a3b8' }}>
                {pwChecks[key] ? '✓ ' : '○ '}
                {label}
              </div>
            ))}
          </div>
          <div>
            <label className="cl-label">Confirm new password</label>
            <input
              className="cl-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                borderColor: confirmPassword === '' ? undefined : passwordsMatch ? '#10b981' : '#ef4444',
              }}
            />
          </div>
          {confirmPassword !== '' && !passwordsMatch ? (
            <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>Passwords do not match.</div>
          ) : null}
          {pwErr ? <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>{pwErr}</div> : null}
          {pwMsg ? <div style={{ color: '#166534', fontSize: 12, fontWeight: 700 }}>{pwMsg}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="cl-save-btn" disabled={pwSaving}>
              {pwSaving ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </ClmPageShell>
  );
}
