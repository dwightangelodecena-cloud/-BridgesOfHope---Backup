import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightSquare, Users, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProgramSidebar, ProgramMobileBottomNav } from '@/components/program/ProgramSidebar';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiDischargeRequestFromRow } from '@/lib/dbMappers';
import {
  approveFamilyDischargeRequest,
  declineFamilyDischargeRequest,
} from '@/lib/dischargeRequestWorkflow';
import {
  getProgramStaffIdentityNames,
  isAssignedToProgramStaff,
} from '@/lib/programStaffIdentity';

function parseLocalPending() {
  try {
    const raw = localStorage.getItem('bh_pending_discharges');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function ProgramDischargeManagement() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [identityNames, setIdentityNames] = useState([]);
  const [programDisplayName, setProgramDisplayName] = useState('');
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const names = await getProgramStaffIdentityNames();
      setIdentityNames(names);

      if (isSupabaseConfigured()) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
          setProgramDisplayName(
            profile?.full_name ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              ''
          );
        }

        const { data: pendingRows, error: drErr } = await supabase
          .from('discharge_requests')
          .select('*, patients(id, full_name, case_load_manager)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (drErr) throw drErr;

        const patientIds = [
          ...new Set((pendingRows || []).map((r) => r.patient_id).filter(Boolean)),
        ];
        let patientsById = new Map();
        if (patientIds.length) {
          const { data: patientRows } = await supabase
            .from('patients')
            .select('id, full_name, case_load_manager')
            .in('id', patientIds);
          patientsById = new Map((patientRows || []).map((p) => [p.id, p]));
        }

        const filtered = (pendingRows || []).filter((row) => {
          const patient =
            (typeof row.patients === 'object' && row.patients) ||
            patientsById.get(row.patient_id);
          return isAssignedToProgramStaff(patient, row.patient_id, names);
        });
        setRequests(
          filtered.map((r) => uiDischargeRequestFromRow(r)).filter(Boolean)
        );
      } else {
        let patientsById = new Map();
        try {
          const patients = JSON.parse(localStorage.getItem('bh_patients') || '[]');
          patientsById = new Map(
            (Array.isArray(patients) ? patients : []).map((p) => [String(p.id), p])
          );
        } catch {
          /* ignore */
        }
        const local = parseLocalPending().filter((r) => {
          const pid = r.patient_id || r.patientId;
          const patient = patientsById.get(String(pid));
          return isAssignedToProgramStaff(patient, pid, names);
        });
        setRequests(
          local
            .map((r) =>
              uiDischargeRequestFromRow({
                id: r.id || r.dischargeRequestId,
                patient_id: r.patient_id || r.patientId,
                family_id: r.family_id,
                created_at: r.created_at || r.createdAt,
                reason_category: r.dischargeReasonCategory || r.reason_category,
                reason_details: r.dischargeReasonDetails || r.reason_details,
                preferred_discharge_date: r.preferredDischargeDate,
                pickup_authorized: r.pickupAuthorized,
                follow_up_phone: r.followUpPhone,
                other_info: r.dischargeOtherInfo,
                guardian_phone: r.familyNumber,
                guardian_email: r.familyEmail,
                patients: { full_name: r.name || r.patientName },
              })
            )
            .filter(Boolean)
        );
        setProgramDisplayName(names[0] || '');
      }
    } catch (e) {
      console.warn('[program-discharge] load failed:', e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onRefresh = () => void loadData();
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => window.removeEventListener(APP_DATA_REFRESH, onRefresh);
  }, [loadData]);

  const pendingCount = requests.length;

  const openDecision = (req, mode) => {
    setDecisionModal({ req, mode });
    setDecisionNote('');
    setActionError('');
  };

  const closeDecision = () => {
    if (actionBusy) return;
    setDecisionModal(null);
    setDecisionNote('');
    setActionError('');
  };

  const submitDecision = async () => {
    if (!decisionModal?.req) return;
    const note = decisionNote.trim();
    if (!note) {
      setActionError('Decision note is required.');
      return;
    }
    setActionBusy(true);
    setActionError('');
    const fn =
      decisionModal.mode === 'approve'
        ? approveFamilyDischargeRequest
        : declineFamilyDischargeRequest;
    const result = await fn(decisionModal.req, note);
    setActionBusy(false);
    if (!result.ok) {
      setActionError(result.error || 'Action failed.');
      return;
    }
    closeDecision();
    await loadData();
  };

  const emptyMessage = useMemo(() => {
    if (!identityNames.length && isSupabaseConfigured()) {
      return 'Sign in as program staff with a profile name that matches your residents’ case load manager.';
    }
    return 'No pending discharge requests for your assigned residents.';
  }, [identityNames.length]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F0F4FF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <ProgramSidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        navigate={navigate}
        active="discharge"
      />

      <main
        style={{
          flex: 1,
          marginLeft: isExpanded ? 280 : 110,
          padding: '24px 28px 48px',
          transition: 'margin-left .3s',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg,#1E293B 0%,#1D2D50 60%,#312e81 100%)',
            borderRadius: 22,
            padding: '24px 28px',
            marginBottom: 20,
            boxShadow: '0 10px 40px rgba(15,23,42,0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowRightSquare size={18} color="#fff" />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Program
                </span>
              </div>
              <h1 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>
                Discharge management
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', margin: '8px 0 0', fontSize: 13, lineHeight: 1.45, maxWidth: 560 }}>
                Family discharge requests for residents assigned to you as program staff
                {programDisplayName ? ` (${programDisplayName})` : ''}. Other program staff cannot see these requests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'inline-block',
                minWidth: 160,
              }}
            >
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Pending requests
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 900, color: '#FCA5A5', lineHeight: 1 }}>
                {loading ? '…' : pendingCount}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #E9EDF7',
            borderRadius: 22,
            padding: '22px 24px',
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
          }}
        >
          {loading ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>Loading discharge requests…</p>
          ) : requests.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{emptyMessage}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {requests.map((req) => (
                <div
                  key={req.dischargeRequestId || req.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 16,
                    padding: '18px 20px',
                    background: '#FAFBFF',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: '#EEF2FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={20} color="#4338CA" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#1B2559', fontSize: 16 }}>
                        {req.name}
                        {req.dischargeReasonCategory ? ` · ${req.dischargeReasonCategory}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{req.requestTime || 'Pending'}</div>
                      <div style={{ marginTop: 12, fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                        {req.familyNumber && <div>Family contact: {req.familyNumber}</div>}
                        {req.familyEmail && <div>Family email: {req.familyEmail}</div>}
                        {req.dischargeReasonDetails && (
                          <div style={{ marginTop: 8 }}>
                            <strong>Details:</strong> {req.dischargeReasonDetails}
                          </div>
                        )}
                        {req.preferredDischargeDate && (
                          <div>
                            <strong>Preferred date:</strong> {req.preferredDischargeDate}
                          </div>
                        )}
                        {req.pickupAuthorized && (
                          <div>
                            <strong>Authorized pickup:</strong> {req.pickupAuthorized}
                          </div>
                        )}
                        {req.followUpPhone && (
                          <div>
                            <strong>Follow-up:</strong> {req.followUpPhone}
                          </div>
                        )}
                        {req.dischargeOtherInfo && (
                          <div>
                            <strong>Other:</strong> {req.dischargeOtherInfo}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openDecision(req, 'approve')}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#10B981',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openDecision(req, 'decline')}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: '1px solid #FECACA',
                            background: '#FFF1F2',
                            color: '#BE123C',
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {decisionModal && (
        <div
          role="presentation"
          onClick={closeDecision}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 18,
              padding: '24px 28px',
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1B2559' }}>
                {decisionModal.mode === 'approve' ? 'Approve discharge' : 'Decline discharge'}
              </h2>
              <button type="button" onClick={closeDecision} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={22} color="#94A3B8" />
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px' }}>
              {decisionModal.req.name} — add a note for the family activity log.
            </p>
            <textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              rows={4}
              placeholder="Decision note (required)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                padding: 12,
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            {actionError && (
              <p style={{ color: '#DC2626', fontSize: 13, margin: '10px 0 0' }}>{actionError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeDecision}
                disabled={actionBusy}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitDecision()}
                disabled={actionBusy}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: decisionModal.mode === 'approve' ? '#10B981' : '#BE123C',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: actionBusy ? 'wait' : 'pointer',
                }}
              >
                {actionBusy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProgramMobileBottomNav navigate={navigate} active="discharge" />
    </div>
  );
}
