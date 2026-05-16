import React from 'react';
import {
  Users,
  Calendar as CalendarIcon,
  FileText,
  LogOut,
  ArrowRightSquare,
} from 'lucide-react';
import logo from '@/assets/kalingalogo.png';

const NAV_ITEMS = [
  { id: 'residents', label: 'Assigned residents', path: '/program', Icon: Users },
  { id: 'discharge', label: 'Discharge management', path: '/program-discharge', Icon: ArrowRightSquare },
  { id: 'calendar', label: 'Calendar', path: '/program-calendar', Icon: CalendarIcon },
  { id: 'weekly', label: 'Weekly Report', path: '/program-weekly-report', Icon: FileText },
];

/** Desktop sidebar for program workspace ? residents, discharge, calendar, weekly report. */
export function ProgramSidebar({
  isExpanded,
  setIsExpanded,
  navigate,
  active,
  onResidentsActivate,
}) {
  const handleResidents = (e) => {
    e.stopPropagation();
    if (onResidentsActivate) onResidentsActivate();
    else navigate('/program');
  };

  return (
    <>
      <style>{`
        .program-desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 25px 0 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow: hidden;
          box-sizing: border-box;
        }
        .program-sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 28px;
          align-self: center;
        }
        .program-sidebar-logo {
          width: ${isExpanded ? '120px' : '70px'};
          transition: width 0.3s ease;
        }
        .program-sidebar-nav-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        .program-sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '28px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 14px;
          margin-bottom: 6px;
          min-height: 48px;
          box-sizing: border-box;
        }
        .program-sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 600;
          font-size: 15px;
          color: #A3AED0;
          line-height: 1.25;
          white-space: normal;
          max-width: 210px;
        }
        .program-sidebar-footer {
          flex-shrink: 0;
          width: 100%;
          padding: 16px 0 20px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
        }
        @media (max-width: 768px) {
          .program-desktop-sidebar { display: none !important; }
        }
      `}</style>
      <aside
        className="desktop-sidebar program-desktop-sidebar"
        onClick={() => setIsExpanded((v) => !v)}
        aria-label="Program navigation"
      >
        <div className="program-sidebar-logo-container">
          <img src={logo} alt="Kalinga" className="program-sidebar-logo" />
        </div>
        <nav className="program-sidebar-nav-scroll">
          {NAV_ITEMS.map(({ id, label, path, Icon }) => {
            const isActive = active === id;
            const onClick =
              id === 'residents'
                ? handleResidents
                : (e) => {
                    e.stopPropagation();
                    navigate(path);
                  };
            return (
              <div
                key={id}
                className="program-sidebar-nav-item"
                onClick={onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(e);
                  }
                }}
              >
                {isActive ? (
                  <div
                    style={{
                      background: '#F54E25',
                      color: '#fff',
                      borderRadius: 12,
                      padding: 10,
                      display: 'flex',
                    }}
                  >
                    <Icon size={22} color="white" />
                  </div>
                ) : (
                  <Icon size={22} color="#707EAE" />
                )}
                <span
                  className="program-sidebar-label"
                  style={isActive ? { color: '#F54E25', fontWeight: 700 } : undefined}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </nav>
        <div className="program-sidebar-footer">
          <div
            className="program-sidebar-nav-item"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/login');
            }}
          >
            <LogOut size={22} color="#F54E25" style={{ flexShrink: 0 }} />
            <span className="program-sidebar-label" style={{ color: '#F54E25', fontWeight: 700 }}>
              Logout
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

/** Bottom navigation for program pages on mobile. */
export function ProgramMobileBottomNav({ navigate, active }) {
  const items = [
    { id: 'residents', short: 'Residents', path: '/program', Icon: Users },
    { id: 'discharge', short: 'Discharge', path: '/program-discharge', Icon: ArrowRightSquare },
    { id: 'calendar', short: 'Calendar', path: '/program-calendar', Icon: CalendarIcon },
    { id: 'weekly', short: 'Weekly', path: '/program-weekly-report', Icon: FileText },
  ];

  return (
    <>
      <style>{`
        .program-mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .program-mobile-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100vw;
            min-height: 72px;
            background: white;
            border-top: 1px solid #F1F1F1;
            justify-content: space-around;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px 2px;
            padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
            z-index: 1000;
            box-sizing: border-box;
          }
          .program-mobile-bottom-nav .mob-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            font-weight: 700;
            color: #A3AED0;
            cursor: pointer;
            min-width: 0;
            flex: 1 1 0;
            max-width: 72px;
          }
          .program-mobile-bottom-nav .mob-nav-item.active {
            color: #F54E25;
          }
        }
      `}</style>
      <div className="program-mobile-bottom-nav db-mobile-only mobile-only mobile-bottom-nav db-mobile-bottom-nav">
      {items.map(({ id, short, path, Icon }) => {
        const isActive = active === id;
        return (
          <div
            key={id}
            className={`mob-nav-item${isActive ? ' active' : ''}`}
            onClick={() => navigate(path)}
          >
            <div
              style={{
                background: isActive ? '#F54E25' : '#F4F7FE',
                padding: 10,
                borderRadius: 10,
                display: 'flex',
              }}
            >
              <Icon size={20} color={isActive ? 'white' : '#707EAE'} />
            </div>
            <span style={isActive ? { color: '#F54E25' } : undefined}>{short}</span>
          </div>
        );
      })}
      <div className="mob-nav-item" onClick={() => navigate('/login')}>
        <LogOut size={22} color="#F54E25" />
        <span style={{ color: '#F54E25' }}>Logout</span>
      </div>
    </div>
    </>
  );
}
