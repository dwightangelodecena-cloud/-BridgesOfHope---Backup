import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import ClmPageShell from './ClmPageShell';

export default function CaseResourcesPage() {
  const navigate = useNavigate();

  return (
    <ClmPageShell
      title="Operations guide (internal)"
      lede="Reference for how BoH runs care, visits, and reporting. This facility is private; this content is not a government reporting package."
    >
      <div className="cl-hero">
        <p className="cl-hero-title">Operations Knowledge Base</p>
        <p className="cl-hero-sub">Internal standards for CLM execution, reporting, coordination, and resident support workflows.</p>
      </div>
      <div className="cl-card">
        <div className="cl-card-title">Recovery ladder</div>
        <p className="cl-qa-p" style={{ marginBottom: 10 }}>
          Progress can be modeled as a snakes-and-ladders style track (~2% per tile); authorized staff may adjust. Use Recovery Roadmap for patient positions.
        </p>
        <button type="button" className="cl-save-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/admin-recovery-roadmap')}>
          <CheckCircle2 size={18} /> Open recovery roadmap
        </button>
      </div>

      <div className="cl-qa-grid">
        <div className="cl-card">
          <h3 className="cl-qa-h2">CLM, Program, Nurse, Admin</h3>
          <p className="cl-qa-p"><strong>CLM</strong> — initial assessment, resident case file (social case study), psychological exam.</p>
          <p className="cl-qa-p"><strong>Nurse</strong> — medical assessment, medications/referrals, monitoring (all medical staff cover all residents; no one nurse per patient).</p>
          <p className="cl-qa-p"><strong>Program</strong> — counselors/facilitators; observation reports; grades patient progress and runs program activities.</p>
          <p className="cl-qa-p" style={{ marginBottom: 0 }}><strong>Admin</strong> — financial aspects.</p>
        </div>
        <div className="cl-card">
          <h3 className="cl-qa-h2">Bed scheme &amp; gender</h3>
          <p className="cl-qa-p">Rooms are not split by case type or severity. Bed assignment follows severity (e.g. highly suicidal residents are not on top bunks—lower or middle bunks only).</p>
          <p className="cl-qa-p" style={{ marginBottom: 0 }}>Female and male residents are always separated.</p>
        </div>
        <div className="cl-card">
          <h3 className="cl-qa-h2">Progress % &amp; status</h3>
          <p className="cl-qa-p">Progress is averaged from in-facility behavior: incidents, seminar participation, engagement vs. non-participation. <strong>Program Department grades residents.</strong> Declining / stable / improving comes from that grading and weekly inputs—not from nursing alone.</p>
          <p className="cl-qa-p" style={{ marginBottom: 0 }}>Departments deliberate together; guardian summaries consolidate CLM, Program, and Medical weekly inputs.</p>
        </div>
        <div className="cl-card">
          <h3 className="cl-qa-h2">Admission &amp; discharge</h3>
          <p className="cl-qa-p"><strong>Admission</strong> — typically Medical-led: fit for rehab depends on medical condition.</p>
          <p className="cl-qa-p"><strong>Inquiry / rescue</strong> — timing may be scheduled, or family may bring the person directly to the facility.</p>
          <p className="cl-qa-p"><strong>Discharge</strong> — clearances (admin for pullout; all departments for reintegration). If resident is ready but family resists: family meeting, waiver against program advice, risks explained; resident may stay.</p>
          <p className="cl-qa-p" style={{ marginBottom: 0 }}>Pickup is usually by family; outstanding balances may delay discharge per Admin and family agreement.</p>
        </div>
        <div className="cl-card">
          <h3 className="cl-qa-h2">Visitation &amp; appointments</h3>
          <p className="cl-qa-p">After medical clearance and general population, <strong>Program proposes visit windows</strong>. Family picks a day; Program confirms. Visits are <strong>viewing-style</strong> first; full in-person contact follows process.</p>
        </div>
        <div className="cl-card">
          <h3 className="cl-qa-h2">Weekly reports &amp; guardian summary</h3>
          <p className="cl-qa-p">Each resident has designated <strong>CLM</strong> and <strong>Program</strong> staff with separate weekly reports. Medical issues a medical weekly report (shared pool).</p>
          <p className="cl-qa-p" style={{ marginBottom: 0 }}>Deliberation covers interventions and accomplishments; Admin helps consolidate for guardians in this app.</p>
        </div>
      </div>
    </ClmPageShell>
  );
}
