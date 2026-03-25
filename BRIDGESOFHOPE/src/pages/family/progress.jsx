import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, Calendar, Plus, X, Activity, Bed, UserCheck, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// Assets
import logo from '@/assets/logo2.png';
import successIcon from '@/assets/success.png';
import activityIcon from '@/assets/activity.png';

const Progress = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // --- STATE ---
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showDischargeSuccessModal, setShowDischargeSuccessModal] = useState(false);
    const [patientImages, setPatientImages] = useState({});
    const fileInputRefs = useRef([]);
    const detailsFileInputRef = useRef(null);

    const [patients, setPatients] = useState(() => {
        const saved = localStorage.getItem('bh_patients');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        const syncPatients = () => {
            const saved = localStorage.getItem('bh_patients');
            setPatients(saved ? JSON.parse(saved) : []);
        };
        window.addEventListener('storage', syncPatients);
        return () => window.removeEventListener('storage', syncPatients);
    }, []);

    const handleImageChange = (index, event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setPatientImages(prev => ({ ...prev, [index]: imageUrl }));
        }
    };

    const triggerFileInput = (index) => {
        fileInputRefs.current[index].click();
    };

    const handleDischarge = (id) => {
        const patientToDischarge = patients.find(p => p.id === id);
        if (!patientToDischarge) return;

        const savedPending = localStorage.getItem('bh_pending_discharges');
        const currentPending = savedPending ? JSON.parse(savedPending) : [];
        
        // Prevent duplicate entries if already requested
        if (currentPending.some(req => req.id === patientToDischarge.id || req.originalId === patientToDischarge.id)) {
            setShowDischargeSuccessModal(true);
            return;
        }

        const dischargeRequest = {
            ...patientToDischarge,
            requestTime: "Just now",
            familyNumber: "09123456789", // Mocked for existing defaults
            familyEmail: "Sample@email.com",
            patientNumber: "09123456789"
        };

        const updatedPending = [...currentPending, dischargeRequest];
        localStorage.setItem('bh_pending_discharges', JSON.stringify(updatedPending));
        window.dispatchEvent(new Event('storage'));

        setShowDischargeSuccessModal(true);
    };

    return (
        <div className="progress-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                .progress-container {
                    display: flex;
                    width: 100vw;
                    height: 100vh;
                    background: #F4F7FE;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    overflow: hidden;
                }

                /* SIDEBAR (Desktop) */
                .sidebar {
                    width: ${isExpanded ? '280px' : '110px'};
                    background: white;
                    border-right: 1px solid #F1F1F1;
                    display: flex;
                    flex-direction: column;
                    padding: 25px 0;
                    z-index: 100;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: pointer;
                }

                .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
                .sidebar-logo { width: ${isExpanded ? '180px' : '70px'}; transition: width 0.3s ease; height: auto; object-fit: contain; }

                .sidebar-nav-item {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 0 ${isExpanded ? '35px' : '0'};
                    justify-content: ${isExpanded ? 'flex-start' : 'center'};
                    gap: 20px;
                    margin-bottom: 25px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #707EAE;
                }

                .nav-item-active { color: #F54E25 !important; }
                .active-icon-box { background: #F54E25; color: white; padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; white-space: nowrap; }

                .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                
                .top-nav { height: 85px; background: white; display: flex; align-items: center; padding: 0 30px; border-bottom: 1px solid #F1F1F1; z-index: 300; }
                .top-nav-left { display: flex; align-items: center; gap: 40px; }
                .view-title { color: #F54E25; font-weight: 700; font-size: 20px; }
                .welcome-text { color: #1B2559; font-weight: 500; font-size: 16px; }
                .user-avatar-top { margin-left: auto; width: 45px; height: 45px; background: #F54E25; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
                
                .content-area { 
                    flex: 1; 
                    padding: 30px 40px; 
                    overflow-y: ${selectedPatient ? 'hidden' : 'auto'}; 
                    position: relative; 
                }

                .header-section { margin-bottom: 30px; }
                .header-section h1 { font-size: 28px; color: #1B2559; font-weight: 800; }
                .header-section h1 span { color: #F54E25; }

                .patient-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 25px; }
                .patient-card { 
                    background: white; 
                    border-radius: 24px; 
                    padding: 32px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.03); 
                    border: 1px solid #E9EDF7;
                    display: flex;
                    flex-direction: column;
                    min-height: 400px;
                }
                
                .card-header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; }
                .patient-img-wrapper { width: 80px; height: 80px; border-radius: 50%; background-color: #F4F7FE; border: 2px dashed #D0D5E8; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                .patient-img { width: 100%; height: 100%; object-fit: cover; }
                .patient-info-name { font-size: 22px; font-weight: 700; color: #1B2559; }
                .status-badge { background: #FFF9E6; color: #E6A500; font-size: 13px; padding: 6px 16px; border-radius: 12px; font-weight: 600; display: inline-block; margin-top: 6px; }
                
                .stats-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; margin-bottom: 30px; flex-grow: 1; }
                .stat-item { display: flex; align-items: center; gap: 12px; }
                .stat-label { font-size: 13px; color: #A3AED0; font-weight: 600; }
                .stat-value { font-size: 15px; color: #1B2559; font-weight: 700; }

                .progress-bar-container { width: 100%; height: 8px; background: #E9EDF7; border-radius: 10px; margin-top: 5px; position: relative; }
                .progress-fill { height: 100%; background: #4318FF; border-radius: 10px; transition: width 0.5s ease; }
                .progress-percent { font-size: 12px; font-weight: 700; color: #707EAE; margin-left: 10px; }

                .btn-view-details { width: 100%; background: #F54E25; color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 16px; }

                /* DETAILS OVERLAY */
                .details-overlay { 
                    position: fixed; 
                    top: 85px; 
                    left: ${isExpanded ? '280px' : '110px'}; 
                    right: 0;
                    bottom: 0;
                    background: #F4F7FE; 
                    z-index: 400; 
                    padding: 40px 60px; 
                    overflow-y: auto; 
                    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .details-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px; }
                .details-header h2 { font-size: 36px; color: #1B2559; font-weight: 800; }
                .details-header h2 span { color: #F54E25; }
                
                .patient-main-info-card { background: white; border-radius: 20px; padding: 45px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
                .profile-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
                .discharge-btn { background: #F54E25; color: white; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 16px; }
                
                .info-pill-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 40px 0; }
                .info-pill { background: #F4F7FE; padding: 20px; border-radius: 15px; display: flex; flex-direction: column; gap: 8px; }
                .info-pill-label { font-size: 13px; color: #A3AED0; display: flex; align-items: center; gap: 8px; font-weight: 600; }
                .info-pill-value { font-size: 16px; font-weight: 800; color: #1B2559; }

                .activities-bar { background: #F4F7FE; padding: 25px 35px; border-radius: 15px; display: flex; align-items: center; justify-content: space-between; }
                .activities-label { display: flex; align-items: center; gap: 15px; font-weight: 700; color: #A3AED0; font-size: 16px; }
                .no-activities { color: #A3AED0; font-size: 15px; font-weight: 500; }

                .side-stat-card { background: white; border-radius: 20px; padding: 35px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); margin-bottom: 25px; }
                .side-stat-header { display: flex; align-items: center; gap: 12px; color: #A3AED0; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
                .side-stat-value { font-size: 32px; font-weight: 800; color: #1B2559; }
                .side-stat-value span { color: #4318FF; }

                .report-history-section { margin-top: 50px; }
                .week-grid { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 25px; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
                .week-grid::-webkit-scrollbar { display: none; }
                .week-card { min-width: 135px; background: white; border-radius: 20px; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
                .week-circle { width: 85px; height: 85px; border-radius: 50%; background: #F4F7FE; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 800; color: #1B2559; }
                .week-label { font-weight: 700; color: #1B2559; font-size: 16px; text-align: center; line-height: 1.2; }

                /* ---- MOBILE ONLY ---- */
                .mobile-top-bar { display: none; }
                .mobile-bottom-nav { display: none; }

                @media (max-width: 768px) {
                    .sidebar { display: none; }
                    .top-nav { display: none; }

                    /* Mobile top bar - matches home.jsx style from image */
                    .mobile-top-bar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px 20px;
                        background: white;
                        border-bottom: 1px solid #F1F1F1;
                        position: sticky;
                        top: 0;
                        z-index: 300;
                    }
                    .mobile-top-bar-logo {
                        width: 48px;
                        height: auto;
                        object-fit: contain;
                    }
                    .mobile-top-bar-avatar {
                        width: 38px;
                        height: 38px;
                        background: #F54E25;
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        font-size: 13px;
                    }

                    .progress-container { flex-direction: column; overflow: auto; height: auto; min-height: 100vh; }
                    .main-view { overflow: visible; }

                    .content-area {
                        padding: 20px 16px 110px 16px;
                        overflow-y: visible;
                    }

                    .header-section { margin-bottom: 20px; }
                    .header-section h1 { font-size: 22px; }
                    .header-section p { font-size: 13px; }

                    /* Patient cards - match home.jsx card style */
                    .patient-grid { grid-template-columns: 1fr; gap: 14px; }
                    .patient-card {
                        padding: 20px;
                        min-height: auto;
                        border-radius: 18px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.05);
                    }
                    .card-header { margin-bottom: 16px; gap: 14px; }
                    .patient-img-wrapper {
                        width: 56px;
                        height: 56px;
                        border: 2px dashed #D0D5E8;
                        background-color: transparent;
                        border-radius: 50%;
                    }
                    .patient-info-name { font-size: 17px; }
                    .status-badge { font-size: 12px; padding: 4px 12px; margin-top: 4px; }

                    .stats-grid { grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
                    .stat-label { font-size: 11px; }
                    .stat-value { font-size: 13px; }
                    .btn-view-details { padding: 14px; font-size: 14px; border-radius: 14px; }

                    /* Admit card */
                    .admit-card-mobile { min-height: 100px !important; border-radius: 18px !important; }

                    /* Details overlay mobile */
                    .details-overlay {
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        padding: 20px 16px 100px 16px;
                        z-index: 600;
                    }
                    .details-header { margin-bottom: 20px; }
                    .details-header h2 { font-size: 22px; }

                    .patient-main-info-card { padding: 20px; border-radius: 18px; }
                    .profile-row { flex-direction: column; align-items: flex-start; gap: 16px; }
                    .discharge-btn { width: 100%; justify-content: center; padding: 14px; font-size: 15px; border-radius: 14px; }

                    .info-pill-container { grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
                    .info-pill { padding: 14px; border-radius: 12px; }
                    .info-pill-label { font-size: 11px; }
                    .info-pill-value { font-size: 14px; }

                    .activities-bar { padding: 16px 18px; border-radius: 12px; }
                    .activities-label { font-size: 14px; gap: 10px; }

                    /* Right column stacks below left */
                    .details-grid-inner { display: flex !important; flex-direction: column !important; }
                    .side-stat-card { padding: 20px; border-radius: 16px; margin-bottom: 14px; }
                    .side-stat-value { font-size: 26px; }

                    .report-history-section { margin-top: 30px; }
                    .week-circle { width: 55px; height: 55px; font-size: 22px; }
                    .week-card { min-width: 90px; padding: 18px 10px; gap: 12px; border-radius: 16px; }
                    .week-label { font-size: 13px; }

                    /* Bottom nav */
                    .mobile-bottom-nav {
                        display: flex;
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 75px;
                        background: white;
                        border-top: 1px solid #F1F1F1;
                        justify-content: space-around;
                        align-items: center;
                        z-index: 500;
                        padding-bottom: env(safe-area-inset-bottom);
                        box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
                    }
                    .mobile-nav-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        color: #A3AED0;
                        font-size: 10px;
                        font-weight: 700;
                        cursor: pointer;
                        padding: 6px 18px;
                        min-width: 50px;
                    }
                    .mobile-nav-item.active { color: #F54E25; }
                }
            `}</style>

            {/* Desktop Sidebar — UNTOUCHED */}
            <aside className="sidebar" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="sidebar-logo-container">
                    <img src={logo} alt="BH" className="sidebar-logo" />
                </div>
                <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
                    <Home size={22} />
                    <span className="sidebar-label">Dashboard</span>
                </div>
                <div className="sidebar-nav-item nav-item-active" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
                    <div className="active-icon-box">
                        <TrendingUp size={22} />
                    </div>
                    <span className="sidebar-label">Progress</span>
                </div>
                <div style={{ marginTop: 'auto', width: '100%' }}>
                    <div className="sidebar-nav-item" onClick={() => navigate('/profile')}><User size={22} /><span className="sidebar-label">Profile</span></div>
                    <div className="sidebar-nav-item" onClick={() => navigate('/login')}><LogOut size={22} color="#F54E25" /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
                </div>
            </aside>

            <main className="main-view">
                {/* Desktop top nav — UNTOUCHED */}
                <header className="top-nav">
                    <div className="top-nav-left">
                        <span className="view-title">Progress</span>
                        <span className="welcome-text">Welcome back</span>
                    </div>
                    <div className="user-avatar-top">JD</div>
                </header>

                {/* Mobile top bar */}
                <div className="mobile-top-bar">
                    <img src={logo} alt="BH" className="mobile-top-bar-logo" />
                    <div className="mobile-top-bar-avatar">JD</div>
                </div>

                <div className="content-area">
                    <div className="header-section">
                        <h1><span>Hello,</span> Jane Doe</h1>
                        <p style={{ color: '#A3AED0', marginTop: '5px', fontWeight: '500' }}>Here's an overview of your family members</p>
                    </div>

                    <div className="patient-grid">
                        {patients.map((patient, i) => (
                            <div key={patient.id} className="patient-card">
                                <div className="card-header">
                                    <div className="patient-img-wrapper" onClick={() => triggerFileInput(i)}>
                                        <input type="file" hidden accept="image/*" ref={el => fileInputRefs.current[i] = el} onChange={(e) => handleImageChange(i, e)} />
                                        {patientImages[i] ? <img src={patientImages[i]} alt="" className="patient-img" /> : <User size={32} color="#A3AED0" />}
                                    </div>
                                    <div>
                                        <div className="patient-info-name">{patient.name}</div>
                                        <span className="status-badge">{patient.status}</span>
                                    </div>
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <Calendar size={20} color="#4318FF" />
                                        <div>
                                            <div className="stat-label">Date of Admission</div>
                                            <div className="stat-value">{patient.admissionDate}</div>
                                        </div>
                                    </div>
                                    <div className="stat-item">
                                        <img src={successIcon} alt="success" style={{ width: 24, height: 24 }} />
                                        <div>
                                            <div className="stat-label">Success Rate</div>
                                            <div className="stat-value">{patient.successRate}</div>
                                        </div>
                                    </div>
                                    <div className="stat-item" style={{ gridColumn: '1 / 2' }}>
                                        <div style={{ width: '100%' }}>
                                            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <TrendingUp size={16} color="#22C55E" /> Recovery Progress
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div className="progress-bar-container" style={{ flex: 1 }}>
                                                    <div className="progress-fill" style={{ width: `${patient.progress}%` }}></div>
                                                </div>
                                                <span className="progress-percent">{patient.progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="stat-item">
                                        <img src={activityIcon} alt="activity" style={{ width: 24, height: 24 }} />
                                        <div>
                                            <div className="stat-label">Activities</div>
                                            <div className="stat-value" style={{ color: '#A3AED0', fontWeight: '500' }}>No Current Activities</div>
                                        </div>
                                    </div>
                                </div>

                                <button className="btn-view-details" onClick={() => setSelectedPatient(patient)}>
                                    <Activity size={18} /> View Details
                                </button>
                            </div>
                        ))}

                        <div className="patient-card admit-card-mobile" style={{ border: '2px dashed #E0E5F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent' }} onClick={() => navigate('/admission')}>
                            <Plus size={48} color="#A3AED0" strokeWidth={1} />
                            <span style={{ color: '#A3AED0', fontWeight: '600', marginTop: '10px' }}>Admit a Patient</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Nav */}
                <nav className="mobile-bottom-nav">
                    <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/progress')}>
                        <TrendingUp size={24} color="#F54E25" />
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Progress</span>
                    </div>
                    <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
                    <LogOut size={24} color="#A3AED0" onClick={() => navigate('/login')} />
                </nav>

                {selectedPatient && (
                    <div className="details-overlay">
                        <div className="details-header">
                            <h2>{selectedPatient.name}'s <span>Progress</span></h2>
                            <X size={32} color="#1B2559" style={{ cursor: 'pointer' }} onClick={() => setSelectedPatient(null)} />
                        </div>

                        <div className="details-grid-inner" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px' }}>
                            <div className="left-content">
                                <div className="patient-main-info-card">
                                    <div className="profile-row">
                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                            <div className="patient-img-wrapper" style={{ width: '70px', height: '70px', cursor: 'pointer' }} onClick={() => detailsFileInputRef.current.click()}>
                                                <input type="file" hidden accept="image/*" ref={detailsFileInputRef} onChange={(e) => { const file = e.target.files[0]; if (file) { const url = URL.createObjectURL(file); setPatientImages(prev => ({ ...prev, ['detail_' + selectedPatient.id]: url })); } }} />
                                                {patientImages['detail_' + selectedPatient.id] ? <img src={patientImages['detail_' + selectedPatient.id]} alt="" className="patient-img" /> : <User size={32} color="#A3AED0" />}
                                            </div>
                                            <div>
                                                <div className="patient-info-name" style={{ fontSize: '24px' }}>{selectedPatient.name}</div>
                                                <span className="status-badge" style={{ fontSize: '14px' }}>{selectedPatient.status}</span>
                                            </div>
                                        </div>
                                        <button className="discharge-btn" onClick={() => handleDischarge(selectedPatient.id)}>
                                            <UserCheck size={20} /> Discharge Patient
                                        </button>
                                    </div>

                                    <div className="info-pill-container">
                                        <div className="info-pill">
                                            <span className="info-pill-label"><Calendar size={14} color="#4318FF" /> Admission</span>
                                            <span className="info-pill-value">{selectedPatient.admissionDate}</span>
                                        </div>
                                        <div className="info-pill">
                                            <span className="info-pill-label"><Activity size={14} color="#4318FF" /> Reason</span>
                                            <span className="info-pill-value">{selectedPatient.reason}</span>
                                        </div>
                                        <div className="info-pill">
                                            <span className="info-pill-label"><User size={14} color="#4318FF" /> Admitted by</span>
                                            <span className="info-pill-value">{selectedPatient.admittedBy}</span>
                                        </div>
                                        <div className="info-pill">
                                            <span className="info-pill-label"><Bed size={14} color="#4318FF" /> Bed Level</span>
                                            <span className="info-pill-value">{selectedPatient.bedLevel}</span>
                                        </div>
                                    </div>

                                    <div className="activities-bar">
                                        <div className="activities-label">
                                            <img src={activityIcon} alt="" style={{ width: 22 }} />
                                            Activities
                                        </div>
                                        <span className="no-activities">No Current Activities</span>
                                    </div>
                                </div>

                                <div className="report-history-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', width: '100%' }}>
                                        <h3 style={{ color: '#1B2559', fontSize: '22px', fontWeight: 800 }}>Report History</h3>
                                        <span style={{ color: '#A3AED0', fontSize: '13px', fontWeight: 600 }}>Select a week</span>
                                    </div>
                                    <div className="week-grid">
                                        {[1, 2, 3, 4, 5, 6, 7].map(w => (
                                            <div key={w} className="week-card">
                                                <div className="week-circle">{w}</div>
                                                <span className="week-label">Week <br /> {w}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="right-content">
                                <div className="side-stat-card">
                                    <div className="side-stat-header">
                                        <img src={successIcon} alt="" style={{ width: 20 }} />
                                        Success Rate
                                    </div>
                                    <div className="side-stat-value">
                                        <span>{selectedPatient.successRate}</span> Success
                                    </div>
                                </div>

                                <div className="side-stat-card">
                                    <div className="side-stat-header">
                                        <TrendingUp size={20} color="#4318FF" />
                                        Progress
                                    </div>
                                    <div className="side-stat-value">{selectedPatient.progress}%</div>
                                    <div className="progress-bar-container" style={{ marginTop: '20px', height: '10px' }}>
                                        <div className="progress-fill" style={{ width: `${selectedPatient.progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showDischargeSuccessModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                        <div style={{ background: 'white', maxWidth: '400px', width: '90%', borderRadius: '24px', padding: '40px 30px', textAlign: 'center', animation: 'modalPop 0.3s ease-out' }}>
                            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto' }}>
                                <CheckCircle size={40} />
                            </div>
                            <h2 style={{ fontSize: '24px', color: '#1B2559', margin: '0 0 15px 0', fontWeight: '800' }}>Request Sent!</h2>
                            <p style={{ color: '#A3AED0', fontSize: '15px', marginBottom: '35px', lineHeight: '1.5', fontWeight: '500' }}>The admin will review your discharge request shortly.</p>
                            <button style={{ width: '100%', background: '#F54E25', color: 'white', padding: '16px', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }} onClick={() => { setShowDischargeSuccessModal(false); setSelectedPatient(null); }}>
                                Continue
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Progress;