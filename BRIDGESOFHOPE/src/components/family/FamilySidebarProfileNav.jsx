import React from 'react';
import { useNavigate } from 'react-router-dom';
import FamilyHeaderAvatar from '@/components/family/FamilyHeaderAvatar';
import { useFamilyUser } from '@/hooks/useFamilyUser';

/**
 * Sidebar profile row with the user's photo/initials (matches header avatar).
 */
export default function FamilySidebarProfileNav({ isExpanded = false, isActive = false }) {
  const navigate = useNavigate();
  const { userId, initials } = useFamilyUser();
  const goProfile = (e) => {
    e.stopPropagation();
    navigate('/profile');
  };

  return (
    <div
      className={`sidebar-nav-item${isActive ? ' sidebar-nav-active' : ''}`}
      onClick={goProfile}
    >
      <FamilyHeaderAvatar
        userId={userId}
        initials={initials}
        interactive={false}
        className="sidebar-profile-avatar user-avatar-top"
        size={isExpanded ? 40 : 36}
      />
      <span className="sidebar-label">Profile</span>
    </div>
  );
}
