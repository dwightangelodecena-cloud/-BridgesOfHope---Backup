import React from 'react';
import {
  Users,
  Calendar as CalendarIcon,
  FileText,
  LogOut,
  ArrowRightSquare,
} from 'lucide-react';

/** Bottom navigation for program pages on mobile. Desktop nav now reuses the shared
 * AdminSidebar component (same as nurse/admin) instead of this file's old bespoke aside —
 * see patient-database.jsx / program-calendar.jsx / program-discharge.jsx / weekly-report.jsx. */
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
