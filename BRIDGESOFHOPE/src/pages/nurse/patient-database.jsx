import React, { useState } from 'react';
import { LayoutGrid, FileText, LogOut, Search, Filter, Trash2, User, Check, X, Edit2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';

const PatientDatabasePage = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingRow, setDeletingRow] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const initialPatients = [
    { name: "John Anderson", age: 34, concern: "Substance Abuse Recovery", status: "Improving", date: "2026-01-15", progress: 65 },
    { name: "Sarah Mitchell", age: 28, concern: "Substance Abuse Recovery", status: "Stable", date: "2026-01-08", progress: 75 },
    { name: "Michael Johnson", age: 42, concern: "Substance Abuse Recovery", status: "Improving", date: "2025-12-20", progress: 75 },
    { name: "Emily Davis", age: 31, concern: "Substance Abuse Recovery", status: "Declining", date: "2026-01-22", progress: 45 },
    { name: "Robert Brown", age: 39, concern: "Substance Abuse Recovery", status: "Improving", date: "2025-12-28", progress: 80 },
  ];

  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Primary Concern');

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (index) => {
    setDeletingRow(index);
    setTimeout(() => {
      setPatients(prev => prev.filter((_, i) => i !== index));
      setDeletingIndex(null);
      setShowPasswordInput(false);
      setDeletePassword('');
      setDeletingRow(null);
    }, 400);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Improving': return { background: '#E6FFFA', color: '#1D7A68', border: '1px solid #B2F5EA' };
      case 'Stable': return { background: '#E6F0FF', color: '#1D58A6', border: '1px solid #B2CCFF' };
      case 'Declining': return { background: '#FFF5F5', color: '#A61D24', border: '1px solid #FEB2B2' };
      default: return { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'Declining': return '#F87171';
      default: return '#2563EB';
    }
  };

  return (
    <div className="db-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
        }

        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 40px;
        }

        .sidebar-logo {
          width: ${isExpanded ? '120px' : '70px'};
          transition: width 0.3s ease;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '35px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 20px;
          margin-bottom: 25px;
          box-sizing: border-box;
        }

        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 700;
          font-size: 18px;
          color: #707EAE;
          white-space: nowrap;
        }

        .db-main {
          flex: 1;
          width: 94vw;
          min-height: 100vh;
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 40px;
        }

        .db-view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: white;
          background: #323D4E;
          padding: 6px 14px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .db-view-btn:hover { background: #1f2937; }

        .db-delete-btn {
          color: #EF4444;
          background: none;
          border: none;
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .db-delete-btn:hover { background: #FEF2F2; color: #B91C1C; }

        .db-row:hover { background: rgba(249,250,251,0.8); }

        @keyframes deleteRow {
          0%   { opacity: 1; transform: translateX(0) scaleY(1); background: #FEF2F2; }
          40%  { opacity: 0.6; transform: translateX(8px) scaleY(1); background: #FEE2E2; }
          100% { opacity: 0; transform: translateX(40px) scaleY(0); background: #FCA5A5; }
        }

        .db-row-deleting {
          animation: deleteRow 0.4s ease-out forwards;
          pointer-events: none;
        }

        .db-search-input {
          padding: 10px 12px 10px 36px;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          font-size: 13px;
          width: 250px;
          outline: none;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
          background: white;
          transition: border-color 0.15s;
        }
        .db-search-input:focus { border-color: #2563EB; }

        .db-filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          background: white;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }

        .db-sort-select {
          border: 1px solid #E9EDF7;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 13px;
          font-weight: 600;
          outline: none;
          color: #1B2559;
          cursor: pointer;
        }

        .delete-confirm-popover {
          position: absolute;
          right: 110%;
          top: 50%;
          transform: translateY(-50%);
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 25px;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          z-index: 10;
          white-space: nowrap;
        }

        .delete-pass-input {
          border: 1px solid #E9EDF7;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          width: 140px;
          outline: none;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
        }
        .delete-pass-input::placeholder { color: #A3AED0; }
        .delete-pass-input:focus { border-color: #F54E25; }

        .confirm-btn-yes {
          background: #22C55E;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .confirm-btn-yes:hover { background: #16A34A; }

        .confirm-btn-no {
          background: #EF4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .confirm-btn-no:hover { background: #DC2626; }

        .real-delete-btn {
          background: #F54E25;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 7px 16px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .real-delete-btn:hover { background: #d43d1a; }

        .info-card {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .vital-label { color: #A3AED0; font-size: 11px; font-weight: 600; margin-bottom: 2px; text-transform: uppercase; }
        .vital-value { color: #1B2559; font-size: 16px; font-weight: 800; }
        
        .week-card {
          flex: 1;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          padding: 30px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .week-number { font-size: 42px; font-weight: 800; color: #1B2559; }

        .db-mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .db-outer { flex-direction: column !important; width: 100vw; overflow-x: hidden; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; }
          .db-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .db-main > div:nth-child(2) { padding: 20px 12px !important; border-radius: 20px !important; width: 100% !important; }
          .db-table-mobile { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .db-controls-mobile { flex-direction: column !important; align-items: stretch !important; gap: 15px !important; }
          .db-search-input { width: 100% !important; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; }
          .mob-nav-item.active { color: #F54E25; }
          .view-top-row { flex-direction: column !important; gap: 16px !important; }
          .view-bottom-row { display: flex !important; flex-direction: column !important; gap: 16px !important; }
          .view-vitals-row { flex-wrap: wrap !important; gap: 12px !important; }
          .view-vitals-row > div { min-width: 45% !important; margin-bottom: 8px !important; }
          .view-weeks-row { flex-wrap: wrap !important; gap: 12px !important; }
          .view-weeks-row > div { min-width: 45% !important; flex: 1 1 45% !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="BH" className="sidebar-logo" />
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}>
          <div style={{ background: '#F4F7FE', padding: 12, borderRadius: 12, display: 'flex' }}>
            <FileText size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Report</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
          <div style={{ background: '#F54E25', color: 'white', padding: 12, borderRadius: 12, display: 'flex' }}>
            <LayoutGrid size={22} />
          </div>
          <span className="sidebar-label" style={{ color: '#F54E25' }}>Dashboard</span>
        </div>

        <div style={{ marginTop: 'auto', width: '100%', paddingBottom: '20px' }}>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurseprofile'); }}>
            <User size={22} color="#707EAE" />
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="db-mobile-only db-mobile-top-bar" style={{ padding: '0 20px', height: 64, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F1F1' }}>
        <img src={logoBH} alt="BH" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Patient Database</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
      </div>

      {/* MAIN CONTENT */}
      <main className="db-main">
        {/* Header Section */}
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1B2559', marginBottom: 4 }}>
              Patient Database
            </h1>
            <p
              onClick={() => setSelectedPatient(null)}
              style={{ fontSize: 13, color: selectedPatient ? '#4361EE' : '#A3AED0', fontWeight: 600, cursor: selectedPatient ? 'pointer' : 'default' }}
            >
              {selectedPatient ? "Patient Information" : "Patient Database"}
            </p>
          </div>
          {selectedPatient && (
            <X
              size={32}
              color="#1B2559"
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setSelectedPatient(null)}
            />
          )}
        </div>

        {selectedPatient ? (
          /* VIEW MODE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="view-top-row" style={{ display: 'flex', gap: 24, flexDirection: 'row' }}>

              {/* Card 1: Basic Info */}
              <div className="info-card" style={{ flex: '1.2', display: 'flex', gap: 24, padding: '24px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 84, height: 84, background: '#FF1F1F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={44} color="white" />
                  </div>
                  <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'white', padding: 6, borderRadius: '50%', border: '1px solid #E9EDF7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Edit2 size={14} color="#FF1F1F" />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Patient Name</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.name}</p>
                    </div>
                    <div style={{ textAlign: 'left', minWidth: '80px' }}>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Age</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.age}</p>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #F4F7FE', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Primary Concern</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#1B2559' }}>Substance Abuse</p>
                      </div>
                      <div style={{ textAlign: 'left', minWidth: '80px' }}>
                        <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Admission Date</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.date}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Status & Progress */}
              <div className="info-card" style={{ flex: '1.4', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Status</p>
                    <span style={{ background: '#E6FFFA', color: '#1D7A68', padding: '6px 14px', borderRadius: '20px', fontSize: 13, fontWeight: 800 }}>
                      {selectedPatient.status}
                    </span>
                  </div>
                  <div style={{ textAlign: 'left', minWidth: '150px' }}>
                    <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Last Date of Consultation</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>February 14, 2026</p>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #F4F7FE', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600 }}>Progress</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.progress}%</p>
                  </div>
                  <div style={{ width: '100%', height: 16, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${selectedPatient.progress}%`, height: '100%', background: '#2563EB', borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Card 3: Vitals */}
              <div className="info-card" style={{ flex: '1.4', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ flex: 1.2 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Current Weight</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>147 lbs</p></div>
                  <div style={{ flex: 1 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>HEIGHT</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>5'4 ft</p></div>
                  <div style={{ flex: 1 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>BP</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>100/80</p></div>
                  <div style={{ flex: 0.8 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>PR</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>71</p></div>
                </div>
                <div className="view-vitals-row" style={{ borderTop: '1px solid #F4F7FE', paddingTop: 16, display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                  <div style={{ flex: 1.2 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>RR</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>18</p></div>
                  <div style={{ flex: 1 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>T</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>36.5</p></div>
                  <div style={{ flex: 1.5 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>BMI</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>Substance 23.0</p></div>
                  <div style={{ flex: 0.8 }}><p style={{ color: '#A3AED0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>SPO2</p><p style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>97%</p></div>
                </div>
              </div>
            </div>

            <div className="view-bottom-row" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 24 }}>
              {/* Weekly Progress Section */}
              <div className="info-card" style={{ padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>Weekly Progress</h3>
                  <button style={{ background: '#323D4E', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Plus size={16} /> Create New Week Report
                  </button>
                </div>
                <div className="view-weeks-row" style={{ display: 'flex', gap: 24 }}>
                  {[1, 2, 3, 4].map(w => (
                    <div key={w} style={{
                      flex: 1,
                      background: 'white',
                      border: '1px solid #E9EDF7',
                      borderRadius: '16px',
                      padding: '28px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                    }}>
                      <p style={{ fontSize: 36, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{w}</p>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>Week</p>
                        <p style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>{w}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="info-card" style={{ padding: '32px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 24 }}>Additional Notes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 4, height: 4, background: '#1B2559', borderRadius: '50%', marginTop: 8, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.6, fontWeight: 500 }}>
                        Excellent progress. Patient demonstrates strong coping skills and has made significant behavioral changes.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TABLE VIEW */
          <div style={{
            background: 'white',
            padding: 40,
            border: '1px solid #E9EDF7',
            borderRadius: 30,
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}>
            {/* Controls */}
            <div className="db-controls-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: '#2563EB' }}>{filtered.length}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1B2559' }}>Patients</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1B2559' }}>
                  <span style={{ fontWeight: 600 }}>Sort:</span>
                  <select className="db-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    <option>Primary Concern</option>
                    <option>Admission Date</option>
                    <option>Patient Name</option>
                  </select>
                </div>
              </div>

              <div className="db-search-row-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A3AED0' }} />
                  <input
                    type="text"
                    className="db-search-input"
                    placeholder="Search Patient"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button className="db-filter-btn">
                  <Filter size={16} color="#A3AED0" />
                  Filter
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="db-table-mobile">
              <table style={{ width: '100%', textAlign: 'left', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Patient Name', 'Age', 'Primary Concern', 'Status', 'Admission Date', 'Progress (%)', 'Actions'].map((col, i) => (
                      <th key={col} style={{
                        padding: '12px 20px',
                        fontWeight: 500,
                        borderRight: i < 6 ? '1px solid #4B5563' : 'none',
                        whiteSpace: 'nowrap',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((patient, index) => (
                    <tr key={index} className={`db-row${deletingRow === index ? ' db-row-deleting' : ''}`} style={{ borderBottom: '1px solid #F4F7FE', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1B2559' }}>{patient.name}</td>
                      <td style={{ padding: '16px 20px', color: '#707EAE' }}>{patient.age}</td>
                      <td style={{ padding: '16px 20px', color: '#1B2559' }}>{patient.concern}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          ...getStatusStyle(patient.status),
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          display: 'inline-block',
                        }}>
                          {patient.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#1B2559', fontVariantNumeric: 'tabular-nums' }}>{patient.date}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 72, height: 6, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${patient.progress}%`, height: '100%', background: getProgressColor(patient.status), borderRadius: 99 }} />
                          </div>
                          <span style={{ color: '#1B2559', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600 }}>{patient.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                          {deletingIndex === index && (
                            <div className="delete-confirm-popover">
                              {!showPasswordInput ? (
                                <>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1B2559' }}>Do you want to Delete this patient?</span>
                                  <button
                                    onClick={() => setShowPasswordInput(true)}
                                    className="confirm-btn-yes"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => { setDeletingIndex(null); setShowPasswordInput(false); }}
                                    className="confirm-btn-no"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>Enter Password to Delete:</span>
                                  <input
                                    type="password"
                                    className="delete-pass-input"
                                    autoFocus
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="Enter Password"
                                  />
                                  <button className="real-delete-btn" onClick={() => handleDelete(index)}>
                                    Delete
                                  </button>
                                  <X
                                    size={18}
                                    color="#A3AED0"
                                    style={{ cursor: 'pointer', flexShrink: 0 }}
                                    onClick={() => { setShowPasswordInput(false); setDeletePassword(''); setDeletingIndex(null); }}
                                  />
                                </>
                              )}
                            </div>
                          )}

                          <button className="db-view-btn" onClick={() => setSelectedPatient(patient)}>View</button>

                          <button
                            className="db-delete-btn"
                            onClick={() => {
                              setDeletingIndex(deletingIndex === index ? null : index);
                              setShowPasswordInput(false);
                              setDeletePassword('');
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <div className="db-mobile-only db-mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/nurse-dashboard')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} color="#707EAE" />
          </div>
          <span>Report</span>
        </div>
        <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="white" />
          </div>
          <span>Dashboard</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/nurseprofile')}>
          <User size={22} />
          <span>Profile</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/login')}>
          <LogOut size={22} color="#F54E25" />
          <span style={{ color: '#F54E25' }}>Logout</span>
        </div>
      </div>
    </div>
  );
};

export default PatientDatabasePage;