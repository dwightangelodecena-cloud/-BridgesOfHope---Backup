import React, { useState } from 'react';
import {
  X,
  Landmark,
  Users,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '@/hooks/useAsyncData';
import { familyDataService } from '@/services/familyDataService';
import { FAMILY_COLORS, StatusBadge, AuditLine, LoadingState } from '@/components/family/shared/ui';

/**
 * Fees & inclusions (billing snapshot + admission / monthly pricing).
 * Used on Home (modal) and can be reused elsewhere. Monthly expand state is local — does not touch sidebar.
 */
export default function FamilyFeesInclusionsPanel({ onClose }) {
  const navigate = useNavigate();
  const [isAdmissionExpanded, setIsAdmissionExpanded] = useState(false);
  const [isMonthlyFeesExpanded, setIsMonthlyFeesExpanded] = useState(false);
  const { data: billingSnapshot, loading: billingLoading } = useAsyncData(
    async () => familyDataService.getBillingSnapshot(),
    [],
  );

  return (
    <div className="fip-root">
      <style>{`
        .fip-root { font-family: 'DM Sans', -apple-system, sans-serif; display: flex; flex-direction: column; max-height: min(92dvh, 880px); min-height: 0; }
        .fip-sticky-top {
          flex-shrink: 0;
          padding: 16px 18px 14px;
          border-bottom: 1px solid #E9EDF7;
          background: #fff;
          border-radius: 22px 22px 0 0;
        }
        .fip-toolbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .fip-toolbar-main { flex: 1; min-width: 0; }
        .fip-toolbar-title { font-size: 17px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; margin: 0; }
        .fip-toolbar-sub { font-size: 12px; color: #64748B; margin: 4px 0 0; font-weight: 500; line-height: 1.4; }
        .fip-toolbar-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .fip-btn-admit {
          background: linear-gradient(135deg,#F54E25,#EA580C);
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 14px rgba(245,78,37,0.35);
        }
        .fip-btn-close {
          border: none;
          background: #F8FAFC;
          border-radius: 12px;
          padding: 8px;
          cursor: pointer;
          color: #64748B;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fip-btn-close:hover { color: #F54E25; background: #FFF1EB; }
        .fip-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px 18px 20px;
          background: ${FAMILY_COLORS.background};
        }
        .fip-stack { display: flex; flex-direction: column; gap: 16px; }
        .fip-billing {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 18px;
          padding: 16px 18px;
          box-shadow: 0 4px 14px rgba(15,23,42,0.05);
        }
        .fip-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 10px;
          flex-wrap: wrap;
        }
        .fip-section-title {
          font-size: 14px;
          font-weight: 800;
          color: #0F172A;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fip-section-card {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          padding: 18px 20px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.05);
        }
        .fip-section-header-block { margin-bottom: 14px; }
        .fip-section-kicker {
          font-size: 14px;
          font-weight: 800;
          color: #0F172A;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fip-section-sub { font-size: 11px; color: #94A3B8; margin-top: 4px; font-weight: 500; }
        .fip-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .fip-header-main { display: flex; align-items: center; gap: 14px; }
        .fip-header-icon {
          width: 52px;
          height: 52px;
          background: #F54E25;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 6px 16px rgba(245, 78, 37, 0.3);
          flex-shrink: 0;
        }
        .fip-header-text h2 {
          color: #0F172A;
          font-size: 17px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .fip-header-text p {
          color: #64748B;
          font-size: 12px;
          margin: 4px 0 0;
          font-weight: 500;
          line-height: 1.45;
          max-width: 36rem;
        }
        .fip-pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
          gap: 18px;
          align-items: start;
        }
        .fip-admission-card {
          background: linear-gradient(135deg, #F95C4B 0%, #D94F42 100%);
          border-radius: 20px;
          padding: 24px 22px;
          color: white;
          position: relative;
          box-shadow: 0 12px 32px rgba(245, 78, 37, 0.2);
          border: 1px solid rgba(255,255,255,0.12);
          cursor: pointer;
        }
        .fip-card-tag {
          position: absolute;
          top: 16px;
          right: 16px;
          font-size: 10px;
          font-weight: 700;
          opacity: 0.95;
          text-align: right;
          max-width: 120px;
          line-height: 1.3;
        }
        .fip-fee-label { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
        .fip-fee-amount {
          font-size: clamp(32px, 7vw, 48px);
          font-weight: 900;
          margin-bottom: 18px;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .fip-fee-list { list-style: none; margin: 0; padding: 0; }
        .fip-fee-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 16px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.35;
        }
        .fip-fee-list li::before { content: "•"; font-size: 20px; flex-shrink: 0; }
        .fip-admission-more {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
        }
        .fip-admission-more h4 { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
        .fip-admission-more ul { list-style: none; padding-left: 14px; margin: 0; }
        .fip-admission-more li { font-size: 14px; font-weight: 600; margin-bottom: 8px; position: relative; }
        .fip-admission-more li::before { content: "•"; position: absolute; left: -14px; }
        .fip-monthly { display: flex; flex-direction: column; gap: 12px; }
        .fip-sub-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .fip-sub-header h3 { color: #0F172A; font-size: 18px; font-weight: 800; margin: 0; }
        .fip-payable-badge {
          background: #EEF2FF;
          color: #3730A3;
          font-size: 11px;
          padding: 5px 11px;
          border-radius: 999px;
          font-weight: 700;
          border: 1px solid #C7D2FE;
        }
        .fip-branch-card {
          background: white;
          border-radius: 18px;
          border: 1px solid #E9EDF7;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15,23,42,0.04);
        }
        .fip-branch-row {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .fip-branch-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .fip-branch-name { color: #0F172A; font-weight: 800; font-size: 16px; display: block; }
        .fip-branch-type { color: #94A3B8; font-size: 12px; font-weight: 600; }
        .fip-branch-price { color: #05CD99; font-weight: 800; font-size: 20px; flex-shrink: 0; }
        .fip-expand-trigger {
          border-top: 1px solid #F1F5F9;
          padding: 12px;
          display: flex;
          justify-content: center;
          color: #94A3B8;
          cursor: pointer;
          background: #FAFBFF;
        }
        .fip-expand-trigger:hover { background: #F1F5F9; color: #64748B; }
        .fip-expanded-details {
          padding: 16px 20px 22px;
          border-top: 1px solid #F1F5F9;
          background: #fff;
        }
        .fip-detail-group { margin-top: 18px; }
        .fip-detail-group:first-child { margin-top: 0; }
        .fip-detail-group h4 {
          color: #0F172A;
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 10px;
        }
        .fip-detail-group ul { list-style: none; padding-left: 14px; margin: 0; }
        .fip-detail-group li {
          color: #64748B;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
          position: relative;
          line-height: 1.4;
        }
        .fip-detail-group li::before {
          content: "•";
          position: absolute;
          left: -14px;
          color: #94A3B8;
        }
        .fip-detail-note {
          font-size: 11px;
          color: #94A3B8;
          font-weight: 500;
          margin-top: 6px;
          display: block;
        }
        .fip-pwd-alert {
          background: #EEF4FF;
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #312E81;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid #DCE7FF;
        }
        .fip-mobile-admit { display: none; margin-top: 8px; }
        @media (max-width: 640px) {
          .fip-toolbar-actions .fip-btn-admit { display: none; }
          .fip-mobile-admit { display: block; }
          .fip-sticky-top { padding: 14px 14px 12px; }
          .fip-scroll { padding: 14px 14px 18px; }
          .fip-section-card { padding: 16px 14px; }
          .fip-pricing-grid { gap: 14px; }
          .fip-branch-row { padding: 16px 14px; }
          .fip-expanded-details { padding: 14px 16px 18px; }
        }
        .fip-mobile-admit .fip-btn-admit { width: 100%; padding: 14px 16px; font-size: 15px; }
      `}</style>

      {onClose ? (
        <div className="fip-sticky-top">
          <div className="fip-toolbar">
            <div className="fip-toolbar-main">
              <h1 className="fip-toolbar-title">Fees &amp; inclusions</h1>
              <p className="fip-toolbar-sub">
                Transparent pricing — admission, monthly care, and what is included
              </p>
            </div>
            <div className="fip-toolbar-actions">
              <button
                type="button"
                className="fip-btn-admit"
                onClick={() => {
                  onClose();
                  navigate('/progress', { state: { tab: 'admission' } });
                }}
              >
                Admit a patient
              </button>
              <button type="button" className="fip-btn-close" onClick={onClose} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fip-scroll">
        <div className="fip-stack">
          <div className="fip-billing">
            <div className="fip-section-head">
              <div className="fip-section-title">
                <DollarSign size={16} color="#F54E25" strokeWidth={2.25} />
                Billing snapshot
              </div>
              <StatusBadge label={billingSnapshot?.status || 'Pending'} tone="warning" />
            </div>
            {billingLoading ? <LoadingState label="Loading billing snapshot..." /> : null}
            {!billingLoading && billingSnapshot ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>
                    Outstanding: PHP{' '}
                    {billingSnapshot.outstanding?.toLocaleString?.() || billingSnapshot.outstanding}
                  </span>
                  <span>Next due: {billingSnapshot.nextDue}</span>
                </div>
                <AuditLine text="Front-end preview for family billing transparency." />
              </>
            ) : null}
            {!billingLoading && !billingSnapshot ? (
              <div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>
                No billing data loaded yet.
              </div>
            ) : null}
          </div>

          <div className="fip-section-card">
            {!onClose ? (
              <>
                <div className="fip-section-header-block">
                  <div className="fip-section-kicker">
                    <Sparkles size={16} color="#F54E25" />
                    Fees &amp; inclusions
                  </div>
                  <p className="fip-section-sub">
                    Transparent pricing — admission, monthly care, and what is included
                  </p>
                </div>
                <div className="fip-page-header">
                  <div className="fip-header-main">
                    <div className="fip-header-icon">
                      <DollarSign size={26} strokeWidth={2.25} />
                    </div>
                    <div className="fip-header-text">
                      <h2>Care packages</h2>
                      <p>Review one-time admission and ongoing monthly fees for your resident.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="fip-page-header" style={{ marginBottom: 12 }}>
                <div className="fip-header-main">
                  <div className="fip-header-icon">
                    <DollarSign size={26} strokeWidth={2.25} />
                  </div>
                  <div className="fip-header-text">
                    <h2>Care packages</h2>
                    <p>Review one-time admission and ongoing monthly fees for your resident.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="fip-pricing-grid">
              <div
                role="button"
                tabIndex={0}
                className="fip-admission-card"
                onClick={() => setIsAdmissionExpanded((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsAdmissionExpanded((v) => !v);
                  }
                }}
              >
                <span className="fip-card-tag">Tap to see inclusions</span>
                <div className="fip-fee-label">Admission Fee</div>
                <div className="fip-fee-amount">₱30,000</div>
                <ul className="fip-fee-list">
                  <li>One-time payment upon admission</li>
                  <li>PWD-discounted rate</li>
                  <li>
                    The Initial Fee is paid at admission, and the monthly fee applies starting the
                    next month.
                  </li>
                </ul>
                {isAdmissionExpanded ? (
                  <div className="fip-admission-more">
                    <h4>Includes:</h4>
                    <ul>
                      <li>Physical &amp; Laboratory Tests</li>
                      <li>Psychiatric Evaluation</li>
                      <li>2 Psychological Evaluations (Admission &amp; Reintegration)</li>
                      <li>Drug Test</li>
                      <li>Alcohol Test</li>
                      <li>Pregnancy Test (for female patients)</li>
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="fip-monthly">
                <div className="fip-sub-header">
                  <h3>Monthly Fees</h3>
                  <span className="fip-payable-badge">Payable within 30 days</span>
                </div>

                <div className="fip-branch-card">
                  <div className="fip-branch-row">
                    <div className="fip-branch-info">
                      <Landmark size={22} color="#707EAE" />
                      <div style={{ minWidth: 0 }}>
                        <span className="fip-branch-name">Imus Branch</span>
                        <span className="fip-branch-type" style={{ display: 'block' }}>
                          City Rate
                        </span>
                      </div>
                    </div>
                    <div className="fip-branch-price">₱35,000</div>
                  </div>

                  {isMonthlyFeesExpanded ? (
                    <div className="fip-expanded-details">
                      <div className="fip-detail-group">
                        <h4>Accommodation &amp; Meals</h4>
                        <ul>
                          <li>Air-conditioned rooms</li>
                          <li>Daily meals: Breakfast, Lunch, PM Snack, Dinner</li>
                        </ul>
                      </div>
                      <div className="fip-detail-group">
                        <h4>Health &amp; Wellness</h4>
                        <ul>
                          <li>Personalized Health &amp; Diet Plan</li>
                          <li>Psychoeducation Sessions</li>
                          <li>Relapse Prevention Seminar</li>
                          <li>Psychiatric &amp; Psychological Evaluations</li>
                          <li>Individual Psychotherapy</li>
                          <li>Regular Doctor Monitoring</li>
                        </ul>
                        <span className="fip-detail-note">
                          Note: Follow-up psychiatric consultations not included
                        </span>
                      </div>
                      <div className="fip-detail-group">
                        <h4>Support &amp; Safety</h4>
                        <ul>
                          <li>24/7 Medical Team</li>
                          <li>24/7 Security</li>
                          <li>Individual &amp; Group Counseling</li>
                        </ul>
                      </div>
                      <div className="fip-detail-group">
                        <h4>Therapeutic &amp; Holistic Care</h4>
                        <ul>
                          <li>Resident &amp; Family Healing Dialogues</li>
                          <li>Spiritual Activities</li>
                          <li>Aftercare Program</li>
                        </ul>
                      </div>
                      <div className="fip-detail-group">
                        <h4>Additional Services</h4>
                        <ul>
                          <li>Laundry &amp; Haircut (Included)</li>
                          <li>Medications &amp; Personal Toiletries – To be provided by family</li>
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  <div
                    role="button"
                    tabIndex={0}
                    className="fip-expand-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMonthlyFeesExpanded((v) => !v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsMonthlyFeesExpanded((v) => !v);
                      }
                    }}
                  >
                    {isMonthlyFeesExpanded ? (
                      <ChevronUp size={22} aria-hidden />
                    ) : (
                      <ChevronDown size={22} aria-hidden />
                    )}
                  </div>
                </div>

                <div className="fip-pwd-alert">
                  <Users size={20} color="#312E81" aria-hidden />
                  <span>PWD-discounted rates available for eligible patients</span>
                </div>

                <div className="fip-mobile-admit">
                  <button
                    type="button"
                    className="fip-btn-admit"
                    onClick={() => {
                      if (onClose) onClose();
                      navigate('/progress', { state: { tab: 'admission' } });
                    }}
                  >
                    Admit a patient
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
