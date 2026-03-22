import React, { useState } from 'react';
import { Home, TrendingUp, User, LogOut, X, Landmark, Users, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Asset import for the logo
import logo from '@/assets/logo2.png';

const Service = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false); // State for monthly fees expansion
  const [isAdmissionExpanded, setIsAdmissionExpanded] = useState(false); // New state for admission card expansion

  return (
    <div className="service-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .service-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Plus Jakarta Sans', sans-serif;
          overflow: hidden;
        }

        /* Sidebar Styling */
        .sidebar {
          width: 250px;
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          padding: 25px 0;
          z-index: 100;
        }

        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0px 0;
          margin-bottom: 40px;
        }

        .sidebar-logo {
          width: 100px;
          height: 80px;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 35px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #707EAE;
        }

        .nav-item-active {
          background: #F54E25;
          margin: 0 20px;
          border-radius: 12px;
          color: white !important;
        }

        .nav-item-active span { color: white !important; }

        .sidebar-label {
          font-weight: 700;
          font-size: 16px;
        }

        /* Main View Styling */
        .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .top-nav {
          height: 80px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 40px;
          border-bottom: 1px solid #F1F1F1;
        }

        .top-nav-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .view-title {
          align-items: stretch;
          color: #F54E25;
          font-weight: 800;
          font-size: 22px;
          display: flex;
        }

        .welcome-text {
          color: #1B2559;
          font-weight: 600;
          font-size: 18px;
          display: flex;
        }

        .user-avatar {
          margin-left: auto;
          width: 45px;
          height: 45px;
          background: #F54E25;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          box-shadow: 0 4px 10px rgba(245, 78, 37, 0.3);
        }

        .content-area {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
        }

        /* Header Section */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .header-main {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon-box {
          width: 80px;
          height: 80px;
          background: #F54E25;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 10px 20px rgba(245, 78, 37, 0.2);
        }

        .header-text h2 {
          color: #1B2559;
          font-size: 24px;
          font-weight: 800;
          margin: 0;
        }

        .header-text p {
          color: #A3AED0;
          font-size: 15px;
          margin: 4px 0 0 0;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .btn-admit {
          background: #F54E25;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .btn-admit:hover { transform: translateY(-2px); }

        .btn-close {
          color: #1B2559;
          cursor: pointer;
        }

        /* Pricing Grid */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 30px;
          align-items: start;
        }

        .admission-fee-card {
          background: linear-gradient(135deg, #FF7E5F 0%, #F54E25 100%);
          border-radius: 24px;
          padding: 40px;
          color: white;
          position: relative;
          box-shadow: 0 20px 40px rgba(245, 78, 37, 0.15);
          cursor: pointer;
        }

        .card-tag {
          position: absolute;
          top: 35px;
          right: 35px;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.9;
        }

        .fee-label {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .fee-amount {
          font-size: 56px;
          font-weight: 800;
          margin-bottom: 30px;
          letter-spacing: -1px;
        }

        .fee-details-list {
          list-style: none;
        }

        .fee-details-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 18px;
          margin-bottom: 25px;
          font-weight: 600;
          line-height: 1.3;
        }

        .fee-details-list li::before {
          content: "•";
          font-size: 24px;
        }

        /* Monthly Fees Side */
        .monthly-fees-container {
          display: flex;
          flex-direction: column;
        }

        .section-sub-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-sub-header h3 {
          color: #1B2559;
          font-size: 20px;
          font-weight: 800;
        }

        .payable-badge {
          background: #E9EDF7;
          color: #A3AED0;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 700;
        }

        .branch-card-list {
          background: white;
          border-radius: 20px;
          border: 1px solid #E9EDF7;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .branch-item {
          padding: 25px 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .branch-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .branch-name {
          color: #1B2559;
          font-weight: 800;
          font-size: 17px;
          display: block;
        }

        .branch-type {
          color: #A3AED0;
          font-size: 12px;
          font-weight: 600;
        }

        .branch-price {
          color: #05CD99;
          font-weight: 800;
          font-size: 22px;
        }

        .expand-trigger {
          border-top: 1px solid #F1F1F1;
          padding: 12px;
          display: flex;
          justify-content: center;
          color: #A3AED0;
          cursor: pointer;
        }

        .expanded-details {
          padding: 0 30px 30px 30px;
          border-top: 1px solid #F1F1F1;
          background: #fff;
        }

        .admission-expanded-details {
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
        }

        .admission-expanded-details h4 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 15px;
        }

        .admission-expanded-details ul {
          list-style: none;
          padding-left: 15px;
        }

        .admission-expanded-details li {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 10px;
          position: relative;
        }

        .admission-expanded-details li::before {
          content: "•";
          position: absolute;
          left: -15px;
        }

        .detail-group {
          margin-top: 25px;
        }

        .detail-group h4 {
          color: #1B2559;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .detail-group ul {
          list-style: none;
          padding-left: 15px;
        }

        .detail-group li {
          color: #707EAE;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          position: relative;
        }

        .detail-group li::before {
          content: "•";
          position: absolute;
          left: -15px;
          color: #A3AED0;
        }

        .detail-note {
          font-size: 11px;
          color: #A3AED0;
          font-weight: 500;
          margin-top: 4px;
          display: block;
        }

        .pwd-alert {
          background: #EBF3FF;
          border-radius: 12px;
          padding: 15px 25px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #4318FF;
          font-size: 14px;
          font-weight: 700;
        }

        .mobile-logo { display: none; }

        /* MOBILE OVERRIDES */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .top-nav { padding: 0 20px; position: relative; }
          .top-nav-left { width: 100%; justify-content: center; gap: 0; }
          .mobile-logo { display: block; width: 45px; height: 35px; position: absolute; left: 20px; }
          .welcome-text { display: none; }
          .view-title { font-size: 18px; text-align: center; margin: 0 auto; }
          .user-avatar { position: absolute; right: 20px; margin-left: 0; }
          .content-area { padding: 20px 15px; }
          .pricing-grid { grid-template-columns: 1fr; gap: 20px; }

          .page-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
            position: relative;
          }

          .header-main { flex-direction: column; gap: 10px; }

          .action-buttons .btn-close {
            position: absolute;
            top: 0;
            right: 0;
          }

          .action-buttons .btn-admit { display: none; }
          .mobile-admit-wrapper { display: block !important; margin-top: 20px; }
          .mobile-admit-wrapper .btn-admit { display: block !important; width: 100%; padding: 16px; font-size: 16px; }

          .admission-fee-card { padding: 30px 20px; }
          .fee-amount { font-size: 42px; margin-bottom: 20px; }
          .fee-label { font-size: 22px; }
          .fee-details-list li { font-size: 15px; margin-bottom: 15px; }
          .branch-item { padding: 20px; }
          .branch-price { font-size: 18px; }
          .branch-name { font-size: 15px; }
        }

        .mobile-admit-wrapper { display: none; }
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo-container">
          <img src={logo} alt="BH Logo" className="sidebar-logo" />
        </div>
        <div className="sidebar-nav-item nav-item-active" onClick={() => navigate('/home')}>
          <Home size={22} />
          <span className="sidebar-label">Dashboard</span>
        </div>
        <div className="sidebar-nav-item" onClick={() => navigate('/progress')}>
          <TrendingUp size={22} />
          <span className="sidebar-label">Progress</span>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-nav-item"><User size={22} /><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={() => navigate('/login')}>
            <LogOut size={22} color="#F54E25" /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">
        <header className="top-nav">
          <div className="top-nav-left">
            <img src={logo} alt="Logo" className="mobile-logo" />
            <span className="view-title">Services</span>
            <span className="welcome-text">Welcome back</span>
          </div>
          <div className="user-avatar">JD</div>
        </header>

        <div className="content-area">
          <div className="page-header">
            <div className="header-main">
              <div className="header-icon-box"><DollarSign size={42} strokeWidth={2.5} /></div>
              <div className="header-text">
                <h2>Fees & Inclusions</h2>
                <p>Transparent pricing for your peace of mind</p>
              </div>
            </div>
            <div className="action-buttons">
              <button className="btn-admit" onClick={() => navigate('/admission')}>Admit a patient</button>
              <X className="btn-close" size={32} onClick={() => navigate('/home')} />
            </div>
          </div>

          <div className="pricing-grid">
            <div className="admission-fee-card" onClick={() => setIsAdmissionExpanded(!isAdmissionExpanded)}>
              <span className="card-tag">Tap to see Inclusions</span>
              <div className="fee-label">Admission Fee</div>
              <div className="fee-amount">₱30,000</div>
              <ul className="fee-details-list">
                <li>One-time payment upon admission</li>
                <li>PWD-discounted rate</li>
                <li>The Initial Fee is paid at admission, and the <br /> Monthly Fee applies starting the NEXT MONTH.</li>
              </ul>
              {isAdmissionExpanded && (
                <div className="admission-expanded-details">
                  <h4>Includes:</h4>
                  <ul>
                    <li>Physical & Laboratory Tests</li>
                    <li>Psychiatric Evaluation</li>
                    <li>2 Psychological Evaluations (Admission & Reintegration)</li>
                    <li>Drug Test</li>
                    <li>Alcohol Test</li>
                    <li>Pregnancy Test (for female patients)</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="monthly-fees-container">
              <div className="section-sub-header">
                <h3>Monthly Fees</h3>
                <span className="payable-badge">Payable within 30 days</span>
              </div>

              <div className="branch-card-list">
                <div className="branch-item">
                  <div className="branch-info">
                    <Landmark size={24} color="#707EAE" />
                    <div><span className="branch-name">Imus Branch</span><span className="branch-type">City Rate</span></div>
                  </div>
                  <div className="branch-price">₱35,000</div>
                </div>

                <div className="branch-item" style={{ borderTop: '1px solid #F1F1F1' }}>
                  <div className="branch-info">
                    <Landmark size={24} color="#707EAE" />
                    <div><span className="branch-name">Amadeo Branch</span><span className="branch-type">Provincial Rate</span></div>
                  </div>
                  <div className="branch-price">₱33,000</div>
                </div>

                {isExpanded && (
                  <div className="expanded-details">
                    <div className="detail-group">
                      <h4>Accommodation & Meals</h4>
                      <ul>
                        <li>Air-conditioned rooms</li>
                        <li>Daily meals: Breakfast, Lunch, PM Snack, Dinner</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Health & Wellness</h4>
                      <ul>
                        <li>Personalized Health & Diet Plan</li>
                        <li>Psychoeducation Sessions</li>
                        <li>Relapse Prevention Seminar</li>
                        <li>Psychiatric & Psychological Evaluations</li>
                        <li>Individual Psychotherapy</li>
                        <li>Regular Doctor Monitoring</li>
                      </ul>
                      <span className="detail-note">Note: Follow-up psychiatric consultations not included</span>
                    </div>
                    <div className="detail-group">
                      <h4>Support & Safety</h4>
                      <ul>
                        <li>24/7 Medical Team</li>
                        <li>24/7 Security</li>
                        <li>Individual & Group Counseling</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Therapeutic & Holistic Care</h4>
                      <ul>
                        <li>Resident & Family Healing Dialogues</li>
                        <li>Spiritual Activities</li>
                        <li>Aftercare Program</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Additional Services</h4>
                      <ul>
                        <li>Laundry & Haircut (Included)</li>
                        <li>Medications & Personal Toiletries – To be provided by family</li>
                      </ul>
                    </div>
                  </div>
                )}
                <div className="expand-trigger" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              <div className="pwd-alert">
                <Users size={22} />
                <span>PWD-discounted rates available for eligible patients</span>
              </div>

              <div className="mobile-admit-wrapper">
                <button className="btn-admit" onClick={() => navigate('/admission')}>Admit a patient</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Service;