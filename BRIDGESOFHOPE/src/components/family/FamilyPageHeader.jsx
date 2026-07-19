import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FamilyHeaderBrand from '@/components/family/FamilyHeaderBrand';
import FamilyPageTitleBrand from '@/components/family/FamilyPageTitleBrand';
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

function NotificationTrigger({ notif, className = 'notifications-trigger', size = 20 }) {
  const count = notif.unreadCount ?? 0;
  const badge = count > 9 ? '9+' : String(count);

  return (
    <button
      type="button"
      className={className}
      aria-expanded={notif.open}
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      onClick={notif.toggle}
    >
      <Bell size={size} stroke="#fff" strokeWidth={2.25} aria-hidden />
      {count > 0 ? <span className="family-notif-badge">{badge}</span> : null}
    </button>
  );
}

function HeaderActions({ notif, onProfile }) {
  return (
    <>
      <div ref={notif.desktopRef} className="family-header-notif-wrap">
        <NotificationTrigger notif={notif} />
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
        <NotificationTrigger
          notif={notif}
          className="notifications-trigger family-notifications-trigger--mobile"
          size={18}
        />
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

function PageTitleBlock({ title, subtitle, className, onBrandPress }) {
  const brand = (
    <FamilyPageTitleBrand
      title={title}
      subtitle={subtitle}
      className={`${className}${subtitle ? '' : ' family-page-title-brand--no-sub'}`}
    />
  );

  if (!onBrandPress) return brand;

  return (
    <button type="button" className="family-page-header__title-btn" onClick={onBrandPress}>
      {brand}
    </button>
  );
}

/**
 * Unified family portal header (desktop + mobile) with notifications and profile avatar.
 */
export default function FamilyPageHeader({ title, subtitle = null, showMobileLogo = true, onBrandPress = null }) {
  const navigate = useNavigate();
  const { userId, initials } = useFamilyUser();
  const notif = useFamilyNotifications(userId);
  const onProfile = () => navigate('/profile');

  const notifProps = {
    ...notif,
    userId,
    initials,
  };

  const headerClass = `family-page-header${subtitle ? ' family-page-header--with-sub' : ''}`;

  return (
    <>
      <div className="family-page-header-shell">
        <header className={headerClass}>
          <div className="family-page-header__left">
            {title ? (
              <PageTitleBlock
                title={title}
                subtitle={subtitle}
                className="family-page-title-brand--desktop"
                onBrandPress={onBrandPress}
              />
            ) : null}
          </div>
          <div className="family-page-header__actions">
            <HeaderActions notif={notifProps} onProfile={onProfile} />
          </div>
        </header>
        <div className="family-page-header__accent" aria-hidden="true" />
      </div>

      <div className="family-mobile-top-bar-shell">
        <div className="family-mobile-top-bar">
          {showMobileLogo ? (
            <FamilyHeaderBrand className="family-header-brand--mobile-bar" onClick={onBrandPress} />
          ) : title ? (
            onBrandPress ? (
              <button type="button" className="family-mobile-top-bar__title-btn" onClick={onBrandPress}>
                <FamilyPageTitleBrand
                  title={title}
                  subtitle={subtitle}
                  className={`family-page-title-brand--mobile-bar${subtitle ? '' : ' family-page-title-brand--no-sub'}`}
                />
              </button>
            ) : (
              <FamilyPageTitleBrand
                title={title}
                subtitle={subtitle}
                className={`family-page-title-brand--mobile-bar${subtitle ? '' : ' family-page-title-brand--no-sub'}`}
              />
            )
          ) : null}
          <div className="family-mobile-top-bar__actions">
            <MobileHeaderActions notif={notifProps} onProfile={onProfile} />
          </div>
        </div>
        {showMobileLogo && subtitle ? (
          <p className="family-mobile-top-bar__page-sub">{subtitle}</p>
        ) : null}
        <div className="family-mobile-top-bar__accent" aria-hidden="true" />
      </div>
    </>
  );
}
