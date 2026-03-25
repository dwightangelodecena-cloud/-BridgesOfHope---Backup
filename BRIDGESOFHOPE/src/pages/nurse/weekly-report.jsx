import React, { useState } from 'react';
import { Home, TrendingUp, User, LogOut, FileText, ChevronDown, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo2.png';

const WeeklyReport = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="wr-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .wr-container {
          display: flex;
          width: 99vw;
          min-height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #1B2559;
        }

        /* ---- SIDEBAR (exact home.jsx) ---- */
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

        /* ---- MAIN ---- */
        .wr-main {
          flex: 1;
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 40px;
          overflow-y: auto;
          min-height: 100vh;
        }

        /* ---- HEADER ---- */
        .wr-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
        }

        .wr-header h1 {
          font-size: 24px;
          font-weight: 800;
          color: #1B2559;
          margin-bottom: 4px;
        }

        .wr-header p {
          font-size: 13px;
          font-weight: 600;
          color: #A3AED0;
        }

        .wr-header-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        /* ---- FORM PAPER ---- */
        .wr-paper {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          border-radius: 30px;
          border: 1px solid #E9EDF7;
          padding: 48px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.03);
        }

        .wr-paper-title {
          font-size: 20px;
          font-weight: 900;
          color: #1B2559;
          margin-bottom: 40px;
          padding-bottom: 16px;
          border-bottom: 1px solid #F4F7FE;
        }

        /* ---- FORM ELEMENTS ---- */
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          margin-bottom: 40px;
        }

        .form-field { display: flex; flex-direction: column; }

        .form-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1B2559;
          margin-bottom: 6px;
        }

        .form-underline-input {
          background: transparent;
          border: none;
          border-bottom: 2px solid #1B2559;
          outline: none;
          padding: 6px 0;
          font-size: 14px;
          font-weight: 600;
          color: #1B2559;
          font-family: 'Inter', sans-serif;
          width: 100%;
        }

        .form-underline-input::placeholder { color: #A3AED0; font-weight: 400; }

        /* ---- SECTION ---- */
        .form-section { margin-bottom: 40px; }

        .section-title {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #1B2559;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-title::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 14px;
          background: #1B2559;
          border-radius: 2px;
        }

        /* ---- TEXTAREA ---- */
        .form-textarea {
          width: 100%;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 15px;
          height: 120px;
          background: white;
          outline: none;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
          resize: none;
          transition: border-color 0.2s;
        }

        .form-textarea:focus { border-color: #F54E25; }
        .form-textarea::placeholder { color: #A3AED0; }

        /* ---- SECTION FIELDS ---- */
        .section-fields { display: flex; flex-direction: column; gap: 32px; }

        /* ---- SUBMIT ---- */
        .submit-row {
          display: flex;
          justify-content: flex-end;
          padding-top: 40px;
        }

        .btn-submit {
          background: #F54E25;
          color: white;
          border: none;
          padding: 14px 48px;
          border-radius: 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(245,78,37,0.2);
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .btn-submit:hover { background: #d43d1a; transform: translateY(-1px); }
        .btn-submit:active { transform: scale(0.98); }

        /* ---- CONFIRM DIALOG ---- */
        .confirm-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          padding: 14px 20px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          animation: fadeInUp 0.2s ease-out;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .confirm-text {
          font-size: 14px;
          font-weight: 600;
          color: #1B2559;
          white-space: nowrap;
        }

        .confirm-btn-cancel {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }

        .confirm-btn-cancel:hover { background: #F4F7FE; }

        .confirm-btn-ok {
          background: #F54E25;
          border: none;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: white;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }

        .confirm-btn-ok:hover { background: #d43d1a; }

        .wr-header-btn { margin-right: 40px; }

        /* ---- MOBILE ---- */
        .mobile-only { display: none; }

        @media (max-width: 768px) {
          html, body { overflow-x: hidden; }
          .wr-container {
            flex-direction: column;
            overflow-x: hidden;
            width: 100vw;
          }

          .desktop-sidebar { display: none !important; }
          .mobile-only { display: flex !important; }

          /* Mobile top bar */
          .mobile-top-bar {
            position: sticky;
            top: 0;
            z-index: 300;
            width: 100vw;
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

          /* Main area */
          .wr-main {
            margin-left: 0 !important;
            width: 100vw;
            padding: 20px 16px 100px 16px;
            min-height: 100vh;
          }

          /* Header */
          .wr-header {
            flex-direction: column;
            gap: 6px;
            margin-bottom: 24px;
          }

          .wr-header h1 { font-size: 20px; }
          .wr-header p { font-size: 12px; }
          .wr-header-btn { display: none; }

          /* Paper */
          .wr-paper {
            padding: 24px 18px;
            border-radius: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.05);
          }

          .wr-paper-title { font-size: 17px; margin-bottom: 28px; }

          /* Form grid stacks to 1 col */
          .form-grid-2 {
            grid-template-columns: 1fr;
            gap: 24px;
            margin-bottom: 28px;
          }

          .form-section { margin-bottom: 28px; }
          .section-fields { gap: 24px; }

          .section-title { font-size: 12px; margin-bottom: 16px; }

          .form-label { font-size: 10px; }
          .form-underline-input { font-size: 13px; padding: 8px 0; }
          .form-textarea { font-size: 13px; height: 100px; padding: 12px; border-radius: 10px; }

          /* Confirm bar stacks on mobile */
          .confirm-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 18px;
            border-radius: 16px;
          }
          .confirm-text { font-size: 15px; text-align: center; }
          .confirm-btn-cancel, .confirm-btn-ok { padding: 14px; font-size: 14px; border-radius: 12px; }

          /* Submit button full width */
          .btn-submit { width: 100%; padding: 16px; font-size: 15px; border-radius: 14px; }
          .submit-row { padding-top: 28px; }

          /* Mobile bottom nav */
          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 72px;
            background: white;
            border-top: 1px solid #F1F1F1;
            display: flex;
            justify-content: space-around;
            align-items: center;
            z-index: 1000;
            padding-bottom: env(safe-area-inset-bottom);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
          }

          .mob-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            font-weight: 700;
            color: #A3AED0;
            cursor: pointer;
          }

          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      {/* DESKTOP SIDEBAR — matches image: logo, FileText active, LayoutGrid, LogOut */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="BH" className="sidebar-logo" />
        </div>

        <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
          <div style={{ background: '#F54E25', color: 'white', padding: 12, borderRadius: 12, display: 'flex' }}>
            <FileText size={22} />
          </div>
          <span className="sidebar-label" style={{ color: '#F54E25' }}>Report</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}>
          <div style={{ background: '#F4F7FE', padding: 12, borderRadius: 12, display: 'flex' }}>
            <LayoutGrid size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Dashboard</span>
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
      <div className="mobile-only mobile-top-bar">
        <img src={logo} alt="BH" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        <span className="mobile-top-bar-title">Weekly Report</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>JD</div>
      </div>

      {/* MAIN */}
      <main className="wr-main">

        {/* Header */}
        <div className="wr-header">
          <div>
            <h1>Weekly Report</h1>
            <p>Write your Weekly Reports</p>
          </div>
          <button className="wr-header-btn">
            <FileText size={18} color="#F54E25" />
            Weekly Report
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Paper */}
        <div className="wr-paper">
          <div className="wr-paper-title">Weekly Report</div>

          <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }}>

            {/* Week & Admission Date */}
            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label">Week:</label>
                <input type="text" className="form-underline-input" />
              </div>
              <div className="form-field">
                <label className="form-label">Admission Date:</label>
                <input type="text" className="form-underline-input" />
              </div>
            </div>

            {/* Patient Information */}
            <div className="form-section">
              <div className="section-title">Patient Information</div>
              <div className="section-fields">
                <div className="form-field">
                  <label className="form-label">Patient Name:</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Age:</label>
                    <input type="text" className="form-underline-input" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Primary Concern:</label>
                    <input type="text" className="form-underline-input" />
                  </div>
                </div>
              </div>
            </div>

            {/* Current Medications */}
            <div className="form-section">
              <div className="section-title">Current Medications</div>
              <textarea
                className="form-textarea"
                placeholder="List all current medications with dosages and frequency..."
              />
            </div>

            {/* BMI / Weight / Vital Signs */}
            <div className="form-section">
              <div className="section-title">BMI / Weight / Vital Signs</div>
              <div className="form-grid-2" style={{ rowGap: '32px' }}>
                <div className="form-field">
                  <label className="form-label">Weight (kg):</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Height (cm):</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">BMI:</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Blood Pressure:</label>
                  <input type="text" className="form-underline-input" placeholder="120/80" />
                </div>
                <div className="form-field">
                  <label className="form-label">PR:</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">RR:</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">SPO2:</label>
                  <input type="text" className="form-underline-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Temperature (°F):</label>
                  <input type="text" className="form-underline-input" />
                </div>
              </div>
            </div>

            {/* Intervention (Medication Management) */}
            <div className="form-section">
              <div className="section-title">Intervention (Medication Management)</div>
              <textarea
                className="form-textarea"
                placeholder="Describe any medication changes, adjustments, or interventions made this week..."
              />
            </div>

            {/* Diet Restrictions */}
            <div className="form-section">
              <div className="section-title">Diet Restrictions</div>
              <div className="section-fields">
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Dietary Restrictions:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="List any dietary restrictions, special diets, or nutritional requirements..."
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Food Allergies:</label>
                  <input type="text" className="form-underline-input" placeholder="List any known food allergies" />
                </div>
              </div>
            </div>

            {/* Intervention (Nutrition) */}
            <div className="form-section">
              <div className="section-title">Intervention (Nutrition)</div>
              <textarea
                className="form-textarea"
                placeholder="Document any nutritional interventions, meal plan adjustments, or consultations with dietitian..."
              />
            </div>

            {/* Ongoing Medical Concern */}
            <div className="form-section">
              <div className="section-title">Ongoing Medical Concern</div>
              <textarea
                className="form-textarea"
                placeholder="Detail any ongoing medical issues, chronic conditions, or health concerns requiring continuous monitoring..."
              />
            </div>

            {/* Upcoming Medical Procedure */}
            <div className="form-section">
              <div className="section-title">Upcoming Medical Procedure</div>
              <div className="section-fields">
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Procedure Description:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe any scheduled medical procedures, tests, or appointments..."
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Scheduled Date:</label>
                  <input type="text" className="form-underline-input" />
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="form-grid-2" style={{ marginBottom: 0 }}>
              <div className="form-field">
                <label className="form-label">Nurse's Name:</label>
                <input type="text" className="form-underline-input" />
              </div>
              <div className="form-field">
                <label className="form-label">Date:</label>
                <input type="text" className="form-underline-input" />
              </div>
            </div>

            {/* Submit */}
            <div className="submit-row">
              {showConfirm ? (
                <div className="confirm-bar">
                  <span className="confirm-text">Ready to submit the Report?</span>
                  <button type="button" className="confirm-btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button type="button" className="confirm-btn-ok" onClick={() => { setShowConfirm(false); navigate('/home'); }}>Confirm</button>
                </div>
              ) : (
                <button type="submit" className="btn-submit">Submit Report</button>
              )}
            </div>

          </form>
        </div>
      </main>

      {/* MOBILE BOTTOM NAV — mirrors desktop sidebar */}
      <div className="mobile-only mobile-bottom-nav">
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', color: 'white', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} />
          </div>
          <span>Report</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/patient-database')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="#707EAE" />
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

export default WeeklyReport;