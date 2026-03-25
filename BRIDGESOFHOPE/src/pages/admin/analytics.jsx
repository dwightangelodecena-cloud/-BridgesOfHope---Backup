import React, { useState, useEffect } from 'react';
import { LayoutGrid, BarChart2, Store, LogOut, TrendingUp, AlertTriangle, Star, Clock, FileText, Download, Printer, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';

const Analytics = () => {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);

    // Dynamic Metrics State
    const [metrics, setMetrics] = useState({
        total: 15,
        approved: 13,
        pending: 0,
        declined: 2
    });

    useEffect(() => {
        // Load real live data from the system's localStorage
        const patients = JSON.parse(localStorage.getItem('bh_patients') || '[]');
        const p_admissions = JSON.parse(localStorage.getItem('bh_pending_admissions') || '[]');
        const p_discharges = JSON.parse(localStorage.getItem('bh_pending_discharges') || '[]');
        const declined_reqs = JSON.parse(localStorage.getItem('bh_declined_requests') || '[]');
        
        const approved = patients.length;
        const pending = p_admissions.length; 
        const declined = declined_reqs.length;
        
        // If there is ANY real data, use it. Otherwise, keep the default mockup stats for an empty system state.
        if (approved > 0 || pending > 0 || p_discharges.length > 0 || declined > 0) {
            const total = approved + pending + declined;
            setMetrics({ total, approved, pending, declined });
        }
    }, []);

    // Derived Pie Chart Variables
    const totalRequests = metrics.total > 0 ? metrics.total : 1;
    const appPerc = Math.round((metrics.approved / totalRequests) * 100);
    const penPerc = Math.round((metrics.pending / totalRequests) * 100);
    const decPerc = metrics.total > 0 ? 100 - appPerc - penPerc : 0;

    // Radius of pie adjusted to prevent clipping (Total visual diameter will be 180px)
    const strokeWidth = 90;
    const R = strokeWidth / 2; // Set inner radius to exactly half stroke to make it a solid pie
    const C = 2 * Math.PI * R;
    const appLen = (appPerc / 100) * C;
    const decLen = (decPerc / 100) * C;
    const penLen = (penPerc / 100) * C;

    return (
        <div className="dashboard-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1B2559' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .dashboard-outer { width: 99vw; overflow-x: hidden; }

                .desktop-sidebar {
                    width: ${isExpanded ? '280px' : '110px'};
                    background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: center; padding: 25px 0; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer;
                    position: fixed; top: 0; left: 0; height: 100vh;
                }
                .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
                .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
                .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; box-sizing: border-box; }
                .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; color: #707EAE; white-space: nowrap; }
                .icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; background: #E9EDF7; color: #1B2559; }
                .icon-box.active { background: #F54E25; color: white; }
                .icon-box.inactive { background: transparent; color: #A3AED0; }

                .dashboard-main { flex: 1; min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px; }
                
                .analytics-title { font-size: 28px; font-weight: 800; color: #000; }
                .analytics-sub { font-size: 13px; color: #707EAE; margin-top: 8px; margin-bottom: 28px; font-weight: 500; }
                
                .filters-export-panel { background: white; border-radius: 20px; padding: 25px 30px; border: 1px solid #E9EDF7; box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 25px; }
                .f-title { font-size: 14px; font-weight: 700; color: #1B2559; margin-bottom: 15px; }
                
                .dropdown { padding: 9px 14px; border: 1px solid #E9EDF7; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1B2559; display: flex; align-items: center; gap: 8px; background: white; cursor: pointer; }
                .btn-export { padding: 9px 14px; border: 1px solid #E9EDF7; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1B2559; display: flex; align-items: center; gap: 8px; background: white; cursor: pointer; transition: 0.2s; }
                .btn-export:hover { background: #F8F9FD; }

                .stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 25px; }
                .stat-box { background: white; border-radius: 12px; padding: 25px 20px; border: 1px solid #E9EDF7; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
                .stat-label-s { font-size: 12px; color: #707EAE; font-weight: 600; margin-bottom: 12px; }
                .stat-val-s { font-size: 28px; font-weight: 800; color: #1B2559; }

                .alerts-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                .alert-card { padding: 16px 20px; border-radius: 8px; color: white; display: flex; align-items: center; gap: 15px; font-size: 13px; font-weight: 600; line-height: 1.4; }
                .alert-icon { width: 32px; height: 32px; border-radius: 50%; background: white; color: inherit; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

                .charts-row { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 25px; margin-bottom: 25px; }
                .chart-box { background: white; border-radius: 20px; padding: 30px; border: 1px solid #E9EDF7; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                .chart-title { font-size: 15px; font-weight: 800; color: #1B2559; margin-bottom: 25px; }
                
                .axis-text { fill: #A3AED0; font-size: 10px; font-weight: 600; font-family: 'Inter', sans-serif; }
                .axis-line { stroke: #F1F1F1; stroke-width: 1; stroke-dasharray: 4,4; }
                
                .db-mobile-only { display: none; }

                .y-axis-label-line {
                    position: absolute;
                    left: -25px;
                    top: 50%;
                    transform: translateY(-50%) rotate(-90deg);
                    font-size: 10px;
                    color: #A3AED0;
                    font-weight: bold;
                }

                @media (max-width: 1200px) {
                    .stats-row { grid-template-columns: repeat(3, 1fr); }
                    .alerts-row { grid-template-columns: repeat(2, 1fr); }
                    .charts-row { grid-template-columns: 1fr; }
                }

                @media (max-width: 768px) {
                    .desktop-sidebar { display: none !important; }
                    .dashboard-outer { flex-direction: column !important; }
                    .dashboard-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 15px 100px 15px !important; }
                    .db-mobile-only { display: flex !important; }
                    .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
                    .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
                    .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; cursor: pointer; }
                    .mob-nav-item.active { color: #F54E25; }
                    
                    .dropdown, .btn-export { padding: 6px 10px; font-size: 11px; }
                    .stats-row { grid-template-columns: repeat(2, 1fr); }
                    .alerts-row { grid-template-columns: 1fr; }
                    
                    /* MOBILE ONLY RESPONSIVE CHART FIXES */
                    .y-axis-label-line {
                        left: -35px !important; /* Move label way to the left so it stops overlapping numbers */
                    }
                    .chart-container-line {
                        margin-left: 15px; /* Give svg room so numbers aren't cut */
                        width: calc(100% - 15px) !important;
                    }
                }
            `}</style>

            {/* SIDEBAR */}
            <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="sidebar-logo-container">
                    <img src={logoBH} alt="BH" className="sidebar-logo" />
                </div>
                <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
                    <div className="icon-box inactive"><LayoutGrid size={22} /></div>
                    <span className="sidebar-label">Dashboard</span>
                </div>
                <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
                    <div className="icon-box active"><BarChart2 size={24} /></div>
                    <span className="sidebar-label" style={{ color: '#F54E25' }}>Analytics</span>
                </div>
                <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
                    <div className="icon-box inactive"><Store size={22} /></div>
                    <span className="sidebar-label">Patient Database</span>
                </div>
                <div style={{ marginTop: 'auto', width: '100%', paddingBottom: '20px' }}>
                    <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
                        <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px' }} />
                        <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
                    </div>
                </div>
            </aside>

            {/* MOBILE TOP BAR */}
            <div className="db-mobile-only db-mobile-top-bar">
                <img src={logoBH} alt="BH" style={{ height: 32 }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Analytics</span>
                <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
            </div>

            {/* MAIN CONTENT */}
            <main className="dashboard-main">
                <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                    <div className="analytics-title">Analytics</div>
                    <div className="analytics-sub">Overall data of the hospital</div>

                    {/* Filters & Export */}
                    <div className="filters-export-panel">
                        <div className="f-title">Filters & Export</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div className="dropdown">Monthly <ChevronDown size={14} /></div>
                                <div className="dropdown">All Programs <ChevronDown size={14} /></div>
                                <div className="dropdown">All Gender <ChevronDown size={14} /></div>
                                <div className="dropdown">All Ages <ChevronDown size={14} /></div>
                                <div className="dropdown">All Therapist <ChevronDown size={14} /></div>
                                <div className="dropdown">All Outcomes <ChevronDown size={14} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="btn-export"><FileText size={16} /> Export PDF</div>
                                <div className="btn-export"><Download size={16} /> Export CSV</div>
                                <div className="btn-export"><Printer size={16} /> Print</div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="stats-row">
                        <div className="stat-box">
                            <div className="stat-label-s">Total Requests</div>
                            <div className="stat-val-s">{metrics.total}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label-s">Approved</div>
                            <div className="stat-val-s">{metrics.approved}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label-s">Average Stay Duration</div>
                            <div className="stat-val-s">28 days</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label-s">Success Rate</div>
                            <div className="stat-val-s">87%</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-label-s">Active Users</div>
                            <div className="stat-val-s">{metrics.approved}</div>
                        </div>
                    </div>

                    {/* Alerts Row */}
                    <div className="alerts-row">
                        <div className="alert-card" style={{ background: '#086F37' }}>
                            <div className="alert-icon" style={{ color: '#086F37' }}><TrendingUp size={20} /></div>
                            Success rate increased by 5% this month
                        </div>
                        <div className="alert-card" style={{ background: '#F54E25' }}>
                            <div className="alert-icon" style={{ color: '#F54E25' }}><AlertTriangle size={20} /></div>
                            No-show rate is highest on Mondays
                        </div>
                        <div className="alert-card" style={{ background: '#1D4ED8' }}>
                            <div className="alert-icon" style={{ color: '#1D4ED8' }}><Star size={20} /></div>
                            Physical Therapy has the best completion rate
                        </div>
                        <div className="alert-card" style={{ background: '#086F37' }}>
                            <div className="alert-icon" style={{ color: '#086F37' }}><Clock size={20} /></div>
                            Average stay increased by 3 days
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="charts-row">
                        {/* Bar Chart */}
                        <div className="chart-box">
                            <div className="chart-title">Patients per Program</div>
                            <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                                <div style={{ left: '-25px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '10px', color: '#A3AED0', fontWeight: 'bold', position: 'absolute', whiteSpace: 'nowrap' }}>Number of Patients</div>
                                <div style={{ position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#1B2559', fontWeight: 'bold' }}>Programs</div>

                                <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                                    {[0, 20, 40, 60, 80].map((val, i) => (
                                        <g key={i}>
                                            <text x="30" y={155 - (val * 1.5)} className="axis-text" textAnchor="end">{val}</text>
                                            <line x1="40" y1={150 - (val * 1.5)} x2="500" y2={150 - (val * 1.5)} stroke="#F1F1F1" strokeDasharray="3 3" />
                                        </g>
                                    ))}
                                    <line x1="40" y1="150" x2="500" y2="150" stroke="#DFE3EA" strokeWidth="2" />

                                    {/* Bars: ~45, 62, 38 */}
                                    <rect x="70" y={150 - (45 * 1.5)} width="90" height={45 * 1.5} fill="#F54E25" rx="4" />
                                    <rect x="210" y={150 - (62 * 1.5)} width="90" height={62 * 1.5} fill="#F54E25" rx="4" />
                                    <rect x="350" y={150 - (38 * 1.5)} width="90" height={38 * 1.5} fill="#F54E25" rx="4" />

                                    {/* Labels rotated */}
                                    <g transform="translate(115, 175) rotate(-10)">
                                        <text className="axis-text" textAnchor="middle">Substance Abuse</text>
                                    </g>
                                    <g transform="translate(255, 175) rotate(-10)">
                                        <text className="axis-text" textAnchor="middle">Physical Therapy</text>
                                    </g>
                                    <g transform="translate(395, 175) rotate(-10)">
                                        <text className="axis-text" textAnchor="middle">Mental Health</text>
                                    </g>
                                </svg>
                            </div>
                        </div>

                        {/* Dynamic Pie Chart */}
                        <div className="chart-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="chart-title">Request Status Distribution</div>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, position: 'relative' }}>
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <g transform="rotate(-90 200 100)">
                                        {/* Colored circle segments using stroke-dasharray magic */}
                                        <circle cx="200" cy="100" r={R} fill="transparent" stroke="#086F37" strokeWidth={strokeWidth} strokeDasharray={`${appLen} ${C}`} />
                                        <circle cx="200" cy="100" r={R} fill="transparent" stroke="#F54E25" strokeWidth={strokeWidth} strokeDasharray={`${decLen} ${C}`} strokeDashoffset={-appLen} />
                                        <circle cx="200" cy="100" r={R} fill="transparent" stroke="#3B82F6" strokeWidth={strokeWidth} strokeDasharray={`${penLen} ${C}`} strokeDashoffset={-(appLen + decLen)} />
                                    </g>
                                </svg>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
                                <span style={{ fontSize: '13px', color: '#086F37', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#086F37', borderRadius: '50%' }}></span>Approved</span>
                                <span style={{ fontSize: '13px', color: '#F54E25', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#F54E25', borderRadius: '50%' }}></span>Declined</span>
                                <span style={{ fontSize: '13px', color: '#3B82F6', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#3B82F6', borderRadius: '50%' }}></span>Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Area Line Chart */}
                    <div className="chart-box">
                        <div className="chart-title">Admissions Over Time</div>
                        <div style={{ position: 'relative', height: '280px', width: '100%' }}>
                            <div className="y-axis-label-line">Number of Admissions</div>
                            <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#1B2559', fontWeight: 'bold' }}>Date</div>

                            {/* Inner wrapper strictly for layout without cutting labels */}
                            <div className="chart-container-line" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <svg width="100%" height="100%" viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                    {[0, 7, 14, 21, 28].map((val, i) => (
                                        <g key={i}>
                                            <text x="40" y={165 - (val * 5)} className="axis-text" textAnchor="end">{val}</text>
                                            <line x1="50" y1={160 - (val * 5)} x2="980" y2={160 - (val * 5)} stroke="#F1F1F1" strokeDasharray="3 3" />
                                        </g>
                                    ))}
                                    <line x1="50" y1="160" x2="980" y2="160" stroke="#DFE3EA" strokeWidth="2" />

                                    {/* Smooth path: perfectly calculated C curves between points */}
                                    <path d="M 50 100 C 114 100, 114 70, 178 70 C 242 70, 242 85, 306 85 C 370 85, 370 50, 434 50 C 498 50, 498 65, 562 65 C 626 65, 626 25, 690 25 C 754 25, 754 55, 818 55 C 882 55, 882 10, 946 10" stroke="#F54E25" strokeWidth="3.5" fill="none" strokeLinecap="round" />

                                    {/* Dots */}
                                    {[
                                        { x: 50, y: 100 },   // Wk1 (12)
                                        { x: 178, y: 70 },   // Wk2 (18)
                                        { x: 306, y: 85 },   // Wk3 (15)
                                        { x: 434, y: 50 },   // Wk4 (22)
                                        { x: 562, y: 65 },   // Wk5 (19)
                                        { x: 690, y: 25 },   // Wk6 (27)
                                        { x: 818, y: 55 },   // Wk7 (21)
                                        { x: 946, y: 10 }    // Wk8 (30)
                                    ].map((pt, i) => (
                                        <circle key={i} cx={pt.x} cy={pt.y} r="5.5" fill="#F54E25" />
                                    ))}

                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((wk, i) => (
                                        <text key={i} x={50 + i * 128} y="185" className="axis-text" textAnchor="middle">Week {wk}</text>
                                    ))}
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* MOBILE BOTTOM NAV */}
            <div className="db-mobile-only db-mobile-bottom-nav">
                <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}>
                    <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                        <LayoutGrid size={20} color="#A3AED0" />
                    </div>
                    <span>Dashboard</span>
                </div>
                <div className="mob-nav-item active">
                    <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
                        <BarChart2 size={20} color="white" />
                    </div>
                    <span style={{ color: '#F54E25' }}>Analytics</span>
                </div>
                <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}>
                    <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                        <Store size={20} color="#A3AED0" />
                    </div>
                    <span>Facility</span>
                </div>
                <div className="mob-nav-item" onClick={() => navigate('/login')}>
                    <LogOut size={22} color="#F54E25" />
                    <span style={{ color: '#F54E25' }}>Logout</span>
                </div>
            </div>

        </div>
    );
};

export default Analytics;
