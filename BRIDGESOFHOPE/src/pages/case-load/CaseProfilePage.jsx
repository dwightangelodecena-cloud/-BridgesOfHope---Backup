import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseProfilePage() {
  const navigate = useNavigate();
  const { me, patients } = useCaseLoad();

  return (
    <ClmPageShell
      narrow
      title="Profile"
      lede="Your CLM account and shortcuts to internal tools."
    >
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
    </ClmPageShell>
  );
}
