import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import FamilyHeaderAvatar from '@/components/family/FamilyHeaderAvatar';
import { useFamilyNotifications } from '@/hooks/useFamilyNotifications';
import { useFamilyUser } from '@/hooks/useFamilyUser';

function NotificationDropdown({
  open,
  items,
  onClearAll,
  onRemove,
  notificationDisplayText,
  className = 'family-notifications-dropdown',
}) {
  if (!open) return null;
  return (
    <div className={className} role="dialog" aria-label="Notifications">
      <div className="family-notif-dropdown-head">
        <div className="family-notif-dropdown-title">
          <Bell size={16} color="#F54E25" aria-hidden />
          Notifications
        </div>
        {items.length > 0 ? (
          <button type="button" className="family-notif-clear-all" onClick={(e) => { e.stopPropagation(); onClearAll(); }}>
            Clear all
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="family-notif-empty">No notifications.</div>
      ) : (
        items.map((item, idx) => (
          <div key={item.id || `n-${idx}`} className="family-notif-row">
            <CheckCircle2 size={15} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            <span className="family-notif-row-text">{notificationDisplayText(item)}</span>
            <button
              type="button"
              className="family-notif-remove-btn"
              aria-label="Remove notification"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item, idx);
              }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function HeaderActions({ notif, onProfile }) {
  return (
    <>
      <div ref={notif.desktopRef} className="family-header-notif-wrap">
        <button
          type="button"
          className="notifications-trigger"
          aria-expanded={notif.open}
          aria-label="Notifications"
          onClick={notif.toggle}
        >
          <Bell size={20} stroke="#fff" strokeWidth={2.25} aria-hidden />
        </button>
        <NotificationDropdown
          open={notif.open}
          items={notif.items}
          onClearAll={notif.clearAll}
          onRemove={notif.removeItem}
          notificationDisplayText={notif.notificationDisplayText}
        />
      </div>
      <FamilyHeaderAvatar userId={notif.userId} initials={notif.initials} onClick={onProfile} />
    </>
  );
}

function MobileHeaderActions({ notif, onProfile }) {
  return (
    <>
      <div ref={notif.mobileRef} className="family-header-notif-wrap">
        <button
          type="button"
          className="notifications-trigger family-notifications-trigger--mobile"
          aria-expanded={notif.open}
          aria-label="Notifications"
          onClick={notif.toggle}
        >
          <Bell size={18} stroke="#fff" strokeWidth={2.25} aria-hidden />
        </button>
        <NotificationDropdown
          open={notif.open}
          items={notif.items}
          onClearAll={notif.clearAll}
          onRemove={notif.removeItem}
          notificationDisplayText={notif.notificationDisplayText}
          className="family-notifications-dropdown family-notifications-dropdown--mobile"
        />
      </div>
      <FamilyHeaderAvatar
        userId={notif.userId}
        initials={notif.initials}
        onClick={onProfile}
        size={34}
        className="user-avatar-top family-header-avatar--mobile"
      />
    </>
  );
}

/**
 * Unified family portal header (desktop + mobile) with notifications and profile avatar.
 */
export default function FamilyPageHeader({ title, subtitle = null, showMobileLogo = true }) {
  const navigate = useNavigate();
  const { userId, initials } = useFamilyUser();
  const notif = useFamilyNotifications(userId);
  const onProfile = () => navigate('/profile');

  const notifProps = {
    ...notif,
    userId,
    initials,
  };

  return (
    <>
      <header className="family-page-header">
        <div className="family-page-header__left">
          <span className="family-page-header__title">{title}</span>
          {subtitle ? <span className="family-page-header__subtitle">{subtitle}</span> : null}
        </div>
        <div className="family-page-header__actions">
          <HeaderActions notif={notifProps} onProfile={onProfile} />
        </div>
      </header>

      <div className="family-mobile-top-bar">
        {showMobileLogo ? (
          <img src={logo} alt="Kalinga" className="family-mobile-top-bar__logo" />
        ) : (
          <span className="family-page-header__title">{title}</span>
        )}
        <div className="family-mobile-top-bar__actions">
          <MobileHeaderActions notif={notifProps} onProfile={onProfile} />
        </div>
      </div>
    </>
  );
}

