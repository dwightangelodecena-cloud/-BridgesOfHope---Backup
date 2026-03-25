import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, MessageCircle, X, Send, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Asset imports
import logo from '@/assets/logo2.png';
import weeklyIcon from '@/assets/weekly.png';
import servicesIcon from '@/assets/services.png';
import admissionIcon from '@/assets/admission.png';

const HomeDashboard = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // AI Chat Logic State
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can I help you today?", sender: 'bot', time: '3:18 PM' }
  ]);
  const chatBodyRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isChatOpen, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: Date.now() + 1,
        text: "Thank you for reaching out to Bridges of Hope. How can I assist you with your recovery journey today?",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  const [patientImages, setPatientImages] = useState({});
  const fileInputRefs = useRef([]);

  // --- START OF SYNC LOGIC ---
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('bh_patients');
    const defaultPatients = [
      { id: 0, name: "John Doe", date: "January 15, 2026", progress: 65 },
      { id: 1, name: "Ivan Doe", date: "January 15, 2026", progress: 65 },
      { id: 2, name: "Jay Doe", date: "January 15, 2026", progress: 65 },
    ];
    return saved ? JSON.parse(saved) : defaultPatients;
  });

  // Listen for storage changes (updates from admission.jsx)
  useEffect(() => {
    const syncPatients = () => {
      const saved = localStorage.getItem('bh_patients');
      if (saved) {
        setPatients(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', syncPatients);
    // Also sync when the component focuses/mounts
    syncPatients();

    return () => window.removeEventListener('storage', syncPatients);
  }, []);
  // --- END OF SYNC LOGIC ---

  const handleImageChange = (index, event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setPatientImages(prev => ({ ...prev, [index]: imageUrl }));
    }
  };

  const triggerFileInput = (index) => {
    fileInputRefs.current[index].click(); // Fixed: Added missing closing parenthesis here
  };

  return (
    <div className="app-container">
      <style>{`
        .app-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

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
          padding: 30px 40px;
          overflow-y: auto;
        }

        .patient-card {
          width: 1100px;
          height: 140px;
          background: white;
          border-radius: 20px;
          padding: 0 35px;
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          border: 1px solid #E9EDF7;
          box-sizing: border-box;
        }

        .patient-img-placeholder {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #F4F7FE;
          margin-right: 25px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #A3AED0;
          cursor: pointer;
          overflow: hidden;
          position: relative;
        }

        .patient-attached-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .action-card {
          width: 190px;
          height: 190px;
          background: white;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid #E9EDF7;
          transition: all 0.2s ease;
        }

        .icon-square {
          width: 100px;
          height: 100px;
          background: #F54E25;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .icon-square img {
          width: 50px;
          height: auto;
          filter: brightness(0) invert(1);
        }

        .chat-window {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 2000;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .chat-header {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          border-bottom: 1px solid #F1F1F1;
        }

        .chat-body {
          flex: 1;
          padding: 20px;
          background: #F8F9FD;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: none;
        }

        .chat-body::-webkit-scrollbar { display: none; }

        .msg-bubble {
          max-width: 85%;
          padding: 12px 16px;
          font-size: 13.5px;
          line-height: 1.4;
          position: relative;
        }

        .msg-received {
          background: white;
          color: #1B2559;
          align-self: flex-start;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .msg-sent {
          background: #F54E25;
          color: white;
          align-self: flex-end;
          border-radius: 18px 18px 4px 18px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: white;
          width: fit-content;
          border-radius: 18px 18px 18px 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          background: #A3AED0;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        .report-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 3000;
        }

        .report-modal {
          width: 700px;
          max-height: 90vh;
          background: white;
          border-radius: 25px;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
        }

        .report-header {
          background: #F54E25;
          padding: 25px 35px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .report-section {
          padding: 20px 35px;
        }

        .section-title {
          color: #1B2559;
          font-weight: 800;
          font-size: 16px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-title::before {
          content: "";
          width: 4px;
          height: 20px;
          background: #F54E25;
          border-radius: 10px;
        }

        .report-content-box {
          background: #F8F9FD;
          padding: 15px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.6;
          color: #707EAE;
        }

        .report-list-item {
          background: #F8F9FD;
          padding: 12px 15px;
          border-radius: 10px;
          font-size: 13px;
          color: #1B2559;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .report-dot {
          width: 8px;
          height: 8px;
          background: #F54E25;
          border-radius: 50%;
          opacity: 0.5;
        }

        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .app-container { flex-direction: column; height: 100vh; overflow: hidden; }
          .mobile-top-bar { padding: 0 20px; height: 60px; background: white; border-bottom: 1px solid #F1F1F1; align-items: center; justify-content: space-between; }
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; }
          .layout-flex-mobile { flex-direction: column !important; }
          .action-section { order: -1; margin-bottom: 20px; } 
          .patient-section { order: 1; }
          .patient-card { width: 100% !important; height: auto !important; padding: 15px !important; margin-bottom: 10px !important; flex-direction: row !important; }
          .patient-img-placeholder { width: 50px !important; height: 50px !important; margin-right: 15px !important; }
          .mobile-action-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .mobile-action-grid .action-card { width: 100% !important; height: 100px !important; border-radius: 15px !important; }
          .mobile-action-grid .icon-square { width: 40px !important; height: 40px !important; margin-bottom: 5px !important; }
          .mobile-action-grid .icon-square img { width: 20px !important; }
          .mobile-action-grid span { font-size: 10px !important; }
          .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: white; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); z-index: 1000; }
          .recovery-text-mobile { font-size: 24px !important; }
          .chat-window { width: 320px; height: 450px; bottom: 85px; right: 15px; border-radius: 20px; }
          .report-modal { width: 95%; max-height: 85vh; }
        }
      `}</style>

      {/* REPORT MODAL */}
      {showReport && (
        <div className="report-overlay" onClick={() => setShowReport(false)}>
          <div className="report-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 35px', background: 'white', borderTop: '1px solid #F1F1F1', textAlign: 'center' }}>
              <button
                onClick={() => setShowReport(false)}
                style={{ background: '#F54E25', color: 'white', border: 'none', width: '100%', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,78,37,0.2)' }}>
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="BH" className="sidebar-logo" />
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
          <div style={{ background: '#F54E25', color: 'white', padding: 12, borderRadius: 12, display: 'flex' }}>
            <Home size={22} />
          </div>
          <span className="sidebar-label" style={{ color: '#F54E25' }}>Dashboard</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <TrendingUp size={22} color="#707EAE" />
            <span className="sidebar-label">Progress</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', width: '100%', paddingBottom: '20px' }}>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
            <User size={22} color="#707EAE" />
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">
        <header className="top-nav">
          <div style={{ display: 'flex', gap: 45 }}>
            <span style={{ color: '#F54E25', fontWeight: 800, fontSize: 23 }}>Dashboard</span>
            <span style={{ color: '#1B2559', fontWeight: 600, fontSize: 20 }}>Welcome back</span>
          </div>
          <div style={{ marginLeft: 'auto', width: 38, height: 38, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
        </header>

        <div className="mobile-only mobile-top-bar">
          <img src={logo} alt="BH" style={{ width: 50 }} />
          <div style={{ width: 34, height: 34, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>JD</div>
        </div>

        <div className="scroll-content">
          <div style={{ background: 'white', borderRadius: 15, padding: '20px', marginBottom: 20, border: '1px solid #E9EDF7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <h2 className="recovery-text-mobile" style={{ fontSize: '36px', fontWeight: 800, color: '#1B2559' }}>Recovery <span style={{ color: '#F54E25' }}>Streak</span></h2>
              <span style={{ fontWeight: 700, color: '#1B2559' }}>42 Days</span>
            </div>
            <div style={{ height: 10, background: '#F4F7FE', borderRadius: 10 }}><div style={{ width: '55%', height: '100%', background: '#F54E25', borderRadius: 10 }}></div></div>
            <p style={{ color: '#A3AED0', fontSize: '0.8rem', marginTop: 10, fontWeight: 600 }}>Next Milestone: 60 Days</p>
          </div>

          <div style={{ display: 'flex', gap: 30, flexDirection: 'row' }} className="layout-flex-mobile">
            <div className="patient-section" style={{ flex: 1 }}>
              <h3 style={{ color: '#1B2559', fontWeight: 800, marginBottom: 20 }}>Patient Details</h3>
              {patients.map((p, i) => (
                <div key={p.id} className="patient-card">
                  <div className="patient-img-placeholder" onClick={() => triggerFileInput(i)}>
                    <input type="file" hidden accept="image/*" ref={el => fileInputRefs.current[i] = el} onChange={(e) => handleImageChange(i, e)} />
                    {patientImages[i] ? <img src={patientImages[i]} alt="" className="patient-attached-img" /> : <User size={24} color="#A3AED0" opacity={0.5} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1B2559' }}>{p.name}</span>
                      <span style={{ background: '#FFF9C4', color: '#856404', fontSize: '0.7rem', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>Recovering</span>
                    </div>
                    <div style={{ color: '#1B2559', fontSize: '0.9rem', fontWeight: 600 }}>{p.date}</div>
                    <div style={{ color: '#A3AED0', fontSize: '0.7rem' }}>Date of Admission</div>
                  </div>
                  <div className="desktop-only" style={{ width: 200, marginLeft: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 8 }}>
                      <span style={{ color: '#A3AED0' }}>Recovery Progress</span>
                      <span style={{ color: '#1B2559' }}>{p.progress}%</span>
                    </div>
                    <div style={{ height: 8, background: '#F4F7FE', borderRadius: 10 }}><div style={{ width: `${p.progress}%`, height: '100%', background: '#4318FF', borderRadius: 10 }}></div></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="action-section">
              <h3 style={{ color: '#707EAE', fontSize: '0.8rem', fontWeight: 700, marginBottom: 20 }}>Quick Actions</h3>
              <div className="mobile-action-grid" style={{ display: 'flex', flexDirection: 'row', gap: 20 }}>
                <div className="action-card" onClick={() => { setShowReport(true); setIsChatOpen(false); }}>
                  <div className="icon-square"><img src={weeklyIcon} alt="Report" /></div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Weekly Report</span>
                </div>
                <div className="action-card" onClick={() => navigate('/services')}>
                  <div className="icon-square"><img src={servicesIcon} alt="Services" /></div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Services</span>
                </div>
                <div className="action-card" onClick={() => navigate('/admission')}>
                  <div className="icon-square"><img src={admissionIcon} alt="Admission" /></div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Admission</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mobile-only mobile-bottom-nav">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/home')}>
            <Home size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Home</span>
          </div>
          <TrendingUp size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
          <LogOut size={24} color="#F54E25" onClick={() => navigate('/login')} />
        </div>
      </div>

      {isChatOpen && !showReport && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: '#F54E25', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1B2559' }}>Support AI</div>
                <div style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>Active now</div>
              </div>
            </div>
            <X size={20} color="#A3AED0" style={{ cursor: 'pointer' }} onClick={() => setIsChatOpen(false)} />
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`msg-bubble ${msg.sender === 'bot' ? 'msg-received' : 'msg-sent'}`}>
                {msg.text}
                <div style={{ fontSize: '9px', marginTop: 6, opacity: 0.6, textAlign: msg.sender === 'bot' ? 'left' : 'right' }}>{msg.time}</div>
              </div>
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <div className="dot"></div><div className="dot"></div><div className="dot"></div>
              </div>
            )}
          </div>

          <div style={{ padding: '15px 20px', background: 'white', display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid #F1F1F1' }}>
            <input
              style={{ flex: 1, border: 'none', background: '#F4F7FE', borderRadius: '15px', padding: '12px 18px', outline: 'none', fontSize: '13px', color: '#1B2559' }}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              style={{ background: inputValue.trim() ? '#F54E25' : '#E9EDF7', width: 40, height: 40, borderRadius: '12px', border: 'none', cursor: 'pointer' }}
            >
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      )}

      {!showReport && (
        <div
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{ position: 'fixed', bottom: window.innerWidth < 768 ? 90 : 30, right: 20, width: 60, height: 60, background: '#F54E25', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px rgba(245,78,37,0.4)', zIndex: 1000, cursor: 'pointer' }}
        >
          {isChatOpen ? <X size={28} /> : <MessageCircle size={28} />}
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;