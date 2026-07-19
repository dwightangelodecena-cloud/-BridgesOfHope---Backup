import React, { useState, useRef, useEffect } from 'react';
import { Home, User, LogOut, Pencil, X, ChevronRight, Calendar, BookUser, ClipboardList, FileText, Lock, Bell, Shield, Camera, Upload, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAsyncData } from '@/hooks/useAsyncData';
import { familyDataService } from '@/services/familyDataService';
import { LoadingState, ErrorState } from '@/components/family/shared/ui';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { FAMILY_PAGE_HEADERS } from '@/lib/familyPageHeaders';
import { useFamilyPageScroll } from '@/hooks/useFamilyPageScroll';
import {
  loadFamilyProfileAvatar,
  readImageFileAsDataUrl,
  resolveFamilyProfileAvatar,
  saveFamilyProfileAvatar,
  uploadFamilyProfileAvatarToCloud,
} from '@/lib/familyProfileAvatar';
import FamilySidebar from '@/components/family/FamilySidebar';
import FamilyMobileBottomNav from '@/components/family/FamilyMobileBottomNav';

const PROFILE_COMPLETENESS_DISMISSED_KEY = 'family_profile_completeness_dismissed_v1';

function getMissingProfileFields(fields) {
  const missing = [];
  if (!String(fields.fullName || '').trim()) missing.push('Full name');
  if (!String(fields.email || '').trim()) missing.push('Email');
  if (!String(fields.phone || '').trim()) missing.push('Phone number');
  if (!String(fields.address || '').trim()) missing.push('Address');
  return missing;
}

const Profile = () => {
  const navigate = useNavigate();
  const { scrollToTop } = useFamilyPageScroll();
  const [isExpanded, setIsExpanded] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSounds, setNotificationSounds] = useState(false);
  const [muteOption, setMuteOption] = useState('Until I change it');
  const [showMuteDropdown, setShowMuteDropdown] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [completenessDismissed, setCompletenessDismissed] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_COMPLETENESS_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [profileForm, setProfileForm] = useState(() => {
    const defaults = {
      fullName: 'Family User',
      email: '',
      phone: '',
      address: 'Cavite, Philippines',
    };
    try {
      const saved = localStorage.getItem('bh_family_profile');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [draftProfile, setDraftProfile] = useState(profileForm);
  const fileInputRef = useRef(null);
  const [familyNotifUserId, setFamilyNotifUserId] = useState('');
  const {
    data: profileSnapshot,
    loading: snapshotLoading,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useAsyncData(async () => familyDataService.getProfileSnapshot(), []);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      if (familyNotifUserId) {
        const publicUrl = await uploadFamilyProfileAvatarToCloud(file, familyNotifUserId);
        setProfileImage(publicUrl);
      } else {
        const dataUrl = await readImageFileAsDataUrl(file);
        setProfileImage(dataUrl);
      }
    } catch (err) {
      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        setProfileImage(dataUrl);
        if (familyNotifUserId) saveFamilyProfileAvatar(familyNotifUserId, dataUrl);
      } catch (fallbackErr) {
        setPhotoError(err?.message || fallbackErr?.message || 'Could not use that image.');
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleProfileInput = (e) => {
    const { name, value } = e.target;
    setDraftProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    setDraftProfile(profileForm);
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setDraftProfile(profileForm);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    setSaveNotice('');
    const payload = {
      full_name: draftProfile.fullName?.trim() || 'Family User',
      phone: draftProfile.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) {
        setSaveNotice(`Could not save profile: ${error.message}`);
        return;
      }
      await supabase.auth.updateUser({
        data: {
          full_name: payload.full_name,
          contact_number: payload.phone,
        },
      });
    }
    setProfileForm(draftProfile);
    localStorage.setItem('bh_family_profile', JSON.stringify(draftProfile));
    setIsEditingProfile(false);
    setSaveNotice('Profile updated successfully.');
    setTimeout(() => setSaveNotice(''), 1800);
  };

  useEffect(() => {
    let isMounted = true;

    const syncProfileFromSupabase = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const metadataName =
        user.user_metadata?.full_name ||
        [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ');
      const metadataPhone = user.user_metadata?.contact_number || '';

      let profileName = '';
      let profilePhone = '';
      if (user.id) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('full_name, phone, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        profileName = profileRow?.full_name || '';
        profilePhone = profileRow?.phone || '';
        if (profileRow?.avatar_url && isMounted) {
          setProfileImage(profileRow.avatar_url);
        }
      }

      const resolved = {
        fullName: profileName || metadataName || 'Family User',
        email: user.email || '',
        phone: profilePhone || metadataPhone || '',
        address: profileForm.address || 'Cavite, Philippines',
      };

      if (isMounted) {
        setProfileForm(resolved);
        setDraftProfile(resolved);
        localStorage.setItem('bh_family_profile', JSON.stringify(resolved));
        if (user?.id) setFamilyNotifUserId(user.id);
      }
    };

    syncProfileFromSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!familyNotifUserId) {
      setProfileImage(null);
      return undefined;
    }
    let cancelled = false;
    const local = loadFamilyProfileAvatar(familyNotifUserId);
    if (local) setProfileImage(local);
    void resolveFamilyProfileAvatar(familyNotifUserId).then((url) => {
      if (!cancelled && url) setProfileImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [familyNotifUserId]);

  const userInitials =
    profileForm.fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || 'FU';

  const missingProfileFields = getMissingProfileFields(draftProfile);
  const isProfileComplete = missingProfileFields.length === 0;
  const completenessPct = Math.round(
    ([draftProfile.fullName, draftProfile.email, draftProfile.phone, draftProfile.address].filter((v) => String(v || '').trim()).length / 4) * 100
  );

  useEffect(() => {
    if (!isProfileComplete) {
      setCompletenessDismissed(false);
      try {
        localStorage.removeItem(PROFILE_COMPLETENESS_DISMISSED_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [isProfileComplete]);

  const dismissCompletenessCard = () => {
    setCompletenessDismissed(true);
    try {
      localStorage.setItem(PROFILE_COMPLETENESS_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const showCompletenessCard = !snapshotLoading && !snapshotError && (!isProfileComplete || !completenessDismissed);

  return (
    <div className={`family-portal app-container fp-page${isEditingProfile ? ' fp-page--editing' : ''}`}>
      <style>{`
        .fp-page.app-container {
          display: flex;
          width: 100%;
          max-width: 100vw;
          min-height: 100vh;
          min-height: 100dvh;
          height: 100vh;
          height: 100dvh;
          background: #F8FAFF;
          font-family: 'DM Sans', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

        .fp-page .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .fp-page .scroll-content {
          flex: 1;
          padding: clamp(16px, 2.5vw, 28px) clamp(16px, 2.8vw, 32px) clamp(28px, 4vw, 44px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #F8FAFF;
        }
        .fp-page .scroll-content::-webkit-scrollbar { width: 5px; }
        .fp-page .scroll-content::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 999px; }

        .fp-content-wrap {
          width: 100%;
          max-width: min(760px, 100%);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2vw, 18px);
          animation: fpFadeIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        @keyframes fpFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Completeness card ── */
        .fp-completeness-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e9edf7;
          border-radius: 20px;
          padding: clamp(16px, 2.2vw, 20px) clamp(18px, 2.4vw, 22px);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
        }
        .fp-completeness-card--warning {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .fp-completeness-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .fp-completeness-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .fp-completeness-head-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .fp-completeness-dismiss {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }
        .fp-completeness-dismiss:hover {
          color: #64748b;
          background: #f1f5f9;
        }
        .fp-completeness-warning-text {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 600;
          color: #92400e;
          line-height: 1.45;
        }
        .fp-completeness-missing-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 2px;
        }
        .fp-completeness-missing-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #b45309;
        }
        .fp-completeness-fill--warning {
          background: linear-gradient(90deg, #f59e0b, #d97706) !important;
        }
        .fp-completeness-title {
          font-size: clamp(0.875rem, 0.5vw + 0.75rem, 0.9375rem);
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .fp-completeness-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }
        .fp-completeness-badge--complete { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
        .fp-completeness-badge--incomplete { background: #fffbeb; color: #92400e; border-color: #fde68a; }
        .fp-completeness-track {
          height: 6px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid #e9edf7;
          margin-bottom: 10px;
        }
        .fp-completeness-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #f54e25, #ea580c);
          transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fp-completeness-meta {
          font-size: 12px;
          color: #64748b;
          line-height: 1.45;
        }

        /* ── Profile hero card ── */
        .fp-profile-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e9edf7;
          border-radius: 24px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.07);
          width: 100%;
          overflow: hidden;
        }
        .fp-profile-hero {
          position: relative;
          padding: clamp(28px, 4vw, 40px) clamp(22px, 3vw, 32px) clamp(24px, 3vw, 32px);
          background: linear-gradient(128deg, #0f172a 0%, #1a2744 42%, #243056 100%);
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .fp-profile-hero::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 55% 80% at 0% 0%, rgba(245, 78, 37, 0.22) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 100% 100%, rgba(99, 102, 241, 0.18) 0%, transparent 50%);
          pointer-events: none;
        }
        .fp-profile-hero__deco {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .fp-profile-hero__deco--1 { top: -40px; right: -20px; width: 140px; height: 140px; background: rgba(255,255,255,0.05); }
        .fp-profile-hero__deco--2 { bottom: -30px; left: 20%; width: 90px; height: 90px; background: rgba(245,78,37,0.15); box-shadow: 0 0 40px rgba(245,78,37,0.2); }
        .fp-profile-hero__body {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }
        .fp-avatar-wrapper { position: relative; }
        .fp-avatar-ring {
          padding: 4px;
          border-radius: 50%;
          background: linear-gradient(145deg, #f54e25, #ea580c);
          box-shadow: 0 16px 40px rgba(245, 78, 37, 0.35);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .fp-avatar-wrapper:hover .fp-avatar-ring {
          transform: scale(1.03);
          box-shadow: 0 20px 48px rgba(245, 78, 37, 0.42);
        }
        .fp-avatar-circle {
          width: 148px;
          height: 148px;
          border-radius: 50%;
          background: linear-gradient(145deg, #f97316, #ea580c);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
          border: 3px solid rgba(255, 255, 255, 0.9);
        }
        .fp-avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
        .fp-avatar-edit-btn {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 40px;
          height: 40px;
          background: #fff;
          border-radius: 50%;
          border: 2px solid #f54e25;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .fp-avatar-edit-btn:hover { transform: scale(1.08); background: #fff7f4; }
        .fp-profile-name {
          margin: 0;
          font-size: clamp(1.25rem, 1.5vw + 0.85rem, 1.5rem);
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }
        .fp-profile-email {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 500;
        }
        .fp-profile-body {
          padding: clamp(18px, 2.4vw, 24px) clamp(20px, 2.6vw, 28px) clamp(22px, 2.8vw, 28px);
          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2vw, 18px);
        }

        .fp-save-notice {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #166534;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          animation: fpFadeIn 0.22s ease;
        }

        /* ── Section cards ── */
        .fp-section-card {
          background: #fff;
          border: 1px solid #e9edf7;
          border-radius: 20px;
          padding: clamp(18px, 2.4vw, 22px) clamp(20px, 2.6vw, 24px);
          box-shadow: 0 6px 22px rgba(15, 23, 42, 0.04);
          transition: box-shadow 0.2s ease;
        }
        .fp-section-card:hover { box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06); }
        .fp-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: clamp(14px, 2vw, 18px);
          flex-wrap: wrap;
        }
        .fp-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: clamp(0.9375rem, 0.5vw + 0.8rem, 1rem);
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .fp-section-title__icon {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background: linear-gradient(145deg, #fff5f0, #fff1eb);
          border: 1px solid #ffdfd3;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(245, 78, 37, 0.1);
        }
        .fp-section-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .fp-field { margin-bottom: 14px; }
        .fp-field:last-child { margin-bottom: 0; }
        .fp-field-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 7px;
        }
        .fp-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px 14px;
          min-height: 46px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          background: #fff;
          font-family: inherit;
        }
        .fp-input::placeholder { color: #94a3b8; font-weight: 500; }
        .fp-input:focus {
          border-color: #f54e25;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }
        .fp-input:disabled {
          background: #f8fafc;
          color: #475569;
          cursor: not-allowed;
          border-color: #e9edf7;
        }
        .fp-page.fp-page--editing .fp-input:not(:disabled) {
          background: #fffaf8;
          border-color: #fecaca;
        }

        .fp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #334155;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
          font-family: inherit;
        }
        .fp-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08); border-color: #d0dbf5; }
        .fp-btn--primary {
          border: none;
          background: linear-gradient(145deg, #f54e25, #ea580c);
          color: #fff;
          box-shadow: 0 8px 22px rgba(245, 78, 37, 0.28);
        }
        .fp-btn--primary:hover { box-shadow: 0 12px 28px rgba(245, 78, 37, 0.34); }

        /* ── Settings ── */
        .fp-settings-list { display: flex; flex-direction: column; gap: 4px; }
        .fp-settings-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          border-radius: 14px;
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s ease;
          border: 1px solid transparent;
        }
        .fp-settings-item:hover {
          background: #f8faff;
          border-color: #e9edf7;
          transform: translateX(2px);
        }
        .fp-settings-item__icon {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: #f4f7fe;
          border: 1px solid #e9edf7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fp-settings-item__text {
          flex: 1;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        .fp-settings-item__chevron { color: #94a3b8; flex-shrink: 0; }

        .fp-notif-expanded {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
        }
        .fp-notif-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 12px;
          border-radius: 12px;
          font-size: 14px;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease;
        }
        .fp-notif-row:hover { background: #f8faff; }
        .fp-notif-row-right {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 13px;
          position: relative;
        }
        .fp-toggle {
          width: 48px;
          height: 26px;
          border-radius: 13px;
          position: relative;
          cursor: pointer;
          transition: background 0.22s ease;
          flex-shrink: 0;
        }
        .fp-toggle__thumb {
          position: absolute;
          top: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          transition: left 0.22s ease;
        }

        .fp-mute-dropdown {
          position: absolute;
          right: 0;
          top: 32px;
          background: #fff;
          border: 1px solid #e9edf7;
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
          min-width: 200px;
          z-index: 100;
          overflow: hidden;
          animation: fpFadeIn 0.18s ease;
        }
        .fp-mute-option {
          padding: 14px 20px;
          font-size: 14px;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .fp-mute-option:last-child { border-bottom: none; }
        .fp-mute-option:hover { background: #fff7f4; color: #f54e25; }
        .fp-mute-option--selected { color: #f54e25; font-weight: 800; }

        /* ── Photo modal ── */
        @keyframes fpOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fpModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .fp-photo-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(12px) saturate(1.2);
          -webkit-backdrop-filter: blur(12px) saturate(1.2);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: clamp(16px, 4vw, 24px);
          animation: fpOverlayIn 0.22s ease;
        }
        .fp-photo-modal {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 24px;
          padding: clamp(24px, 3.5vw, 30px);
          width: 100%;
          max-width: 440px;
          box-shadow:
            0 4px 24px rgba(15, 23, 42, 0.06),
            0 24px 64px rgba(15, 23, 42, 0.18);
          border: 1px solid rgba(233, 237, 247, 0.95);
          animation: fpModalIn 0.24s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }
        .fp-photo-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: clamp(20px, 3vw, 26px);
        }
        .fp-photo-modal-head__text { flex: 1; min-width: 0; }
        .fp-photo-modal-title {
          display: block;
          font-size: clamp(1.0625rem, 1vw + 0.85rem, 1.25rem);
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.025em;
          line-height: 1.2;
          margin: 0 0 6px;
        }
        .fp-photo-modal-subtitle {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
          font-weight: 500;
        }
        .fp-photo-modal-close {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          color: #64748b;
          transition: background 0.2s ease, transform 0.2s ease, color 0.2s ease;
        }
        .fp-photo-modal-close:hover {
          background: #e2e8f0;
          color: #0f172a;
          transform: rotate(90deg);
        }
        .fp-photo-modal-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .fp-photo-option {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          width: 100%;
          text-align: left;
          padding: clamp(16px, 2.4vw, 18px) clamp(16px, 2.6vw, 20px);
          border-radius: 18px;
          border: 1px solid #e9edf7;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
          font-family: inherit;
        }
        .fp-photo-option:hover {
          transform: translateY(-3px);
          border-color: rgba(245, 78, 37, 0.35);
          background: linear-gradient(180deg, #fffaf8 0%, #fff 100%);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
        }
        .fp-photo-option__icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(145deg, #fff5f0, #fff1eb);
          border: 1px solid #ffdfd3;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 6px 16px rgba(245, 78, 37, 0.12);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .fp-photo-option:hover .fp-photo-option__icon {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(245, 78, 37, 0.18);
        }
        .fp-photo-option__body { flex: 1; min-width: 0; padding-top: 2px; }
        .fp-photo-option__title {
          display: block;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .fp-photo-option__desc {
          display: block;
          font-size: 12px;
          color: #64748b;
          line-height: 1.45;
          font-weight: 500;
        }
        .fp-photo-option__arrow {
          flex-shrink: 0;
          color: #cbd5e1;
          margin-top: 12px;
          transition: transform 0.2s ease, color 0.2s ease;
        }
        .fp-photo-option:hover .fp-photo-option__arrow {
          color: #f54e25;
          transform: translateX(3px);
        }
        .fp-photo-error {
          margin-top: 14px;
          padding: 12px 14px;
          font-size: 12px;
          color: #dc2626;
          font-weight: 600;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          line-height: 1.45;
        }

        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .fp-page .scroll-content { padding: 14px 14px 90px !important; }
          .fp-profile-hero__body { gap: 14px; }
          .fp-avatar-circle { width: 120px; height: 120px; }
          .mobile-only { display: flex !important; }
          .mobile-bottom-nav {
            position: fixed; bottom: 0; left: 0; right: 0;
            height: 70px; background: #fff;
            border-top: 1px solid #eaeffb;
            justify-content: space-around; align-items: center;
            padding-bottom: env(safe-area-inset-bottom);
            z-index: 1000;
          }
        }
      `}</style>

      <FamilySidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <div className="main-view">

        <FamilyPageHeader {...FAMILY_PAGE_HEADERS.profile} onBrandPress={scrollToTop} showMobileLogo={false} />

        <div className="scroll-content">
          <div className="fp-content-wrap">

            {snapshotLoading ? <LoadingState label="Checking profile snapshot..." /> : null}
            {snapshotError ? <ErrorState label={snapshotError} onRetry={refreshSnapshot} /> : null}
            {showCompletenessCard ? (
            <div className={`fp-completeness-card${!isProfileComplete ? ' fp-completeness-card--warning' : ''}`}>
              <div className="fp-completeness-head">
                <div className="fp-completeness-title-wrap">
                  {!isProfileComplete ? <AlertTriangle size={18} color="#D97706" aria-hidden /> : null}
                  <span className="fp-completeness-title">
                    {isProfileComplete ? 'Profile Completeness' : 'Complete your profile'}
                  </span>
                </div>
                <div className="fp-completeness-head-right">
                  <span className={`fp-completeness-badge ${isProfileComplete ? 'fp-completeness-badge--complete' : 'fp-completeness-badge--incomplete'}`}>
                    {isProfileComplete ? 'Complete' : 'Incomplete'}
                  </span>
                  {isProfileComplete ? (
                    <button
                      type="button"
                      className="fp-completeness-dismiss"
                      onClick={dismissCompletenessCard}
                      aria-label="Dismiss profile completeness"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              {!isProfileComplete ? (
                <p className="fp-completeness-warning-text">
                  Add the missing details below so your care team can reach you.
                </p>
              ) : null}
              <div className="fp-completeness-track">
                <div
                  className={`fp-completeness-fill${!isProfileComplete ? ' fp-completeness-fill--warning' : ''}`}
                  style={{ width: `${completenessPct}%` }}
                />
              </div>
              {!isProfileComplete ? (
                <div className="fp-completeness-missing-list">
                  {missingProfileFields.map((field) => (
                    <div key={field} className="fp-completeness-missing-row">
                      <AlertTriangle size={14} color="#D97706" aria-hidden />
                      <span>{field} required</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="fp-completeness-meta">
                  {completenessPct}% complete · Profile source: {profileSnapshot?.fullName || 'Family User'} · last viewed {new Date().toLocaleString()}
                </p>
              )}
            </div>
            ) : null}

            <div className="fp-profile-card">
              {/* Hero header */}
              <div className="fp-profile-hero">
                <div className="fp-profile-hero__deco fp-profile-hero__deco--1" />
                <div className="fp-profile-hero__deco fp-profile-hero__deco--2" />
                <div className="fp-profile-hero__body">
                  <div className="fp-avatar-wrapper">
                    <div className="fp-avatar-ring">
                      <div className="fp-avatar-circle" onClick={() => setShowPhotoModal(true)}>
                        <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleImageChange} />
                        {profileImage
                          ? <img src={profileImage} alt="profile" />
                          : <User size={72} color="white" strokeWidth={1.5} />}
                      </div>
                    </div>
                    <button type="button" className="fp-avatar-edit-btn" onClick={() => setShowPhotoModal(true)} aria-label="Edit photo">
                      <Camera size={16} color="#F54E25" />
                    </button>
                  </div>
                  <div>
                    <h2 className="fp-profile-name">{profileForm.fullName}</h2>
                    {profileForm.email ? <div className="fp-profile-email">{profileForm.email}</div> : null}
                  </div>
                </div>
              </div>

              {showPhotoModal && (
                <div className="fp-photo-overlay" onClick={() => setShowPhotoModal(false)} role="presentation">
                  <div
                    className="fp-photo-modal"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="fp-photo-modal-title"
                    aria-describedby="fp-photo-modal-subtitle"
                  >
                    <div className="fp-photo-modal-head">
                      <div className="fp-photo-modal-head__text">
                        <h2 id="fp-photo-modal-title" className="fp-photo-modal-title">Add a Profile Picture</h2>
                        <p id="fp-photo-modal-subtitle" className="fp-photo-modal-subtitle">
                          Choose how you&apos;d like to upload your profile photo.
                        </p>
                      </div>
                      <button type="button" className="fp-photo-modal-close" onClick={() => setShowPhotoModal(false)} aria-label="Close">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="fp-photo-modal-options">
                      <button
                        type="button"
                        className="fp-photo-option"
                        onClick={() => { setShowPhotoModal(false); fileInputRef.current?.click(); }}
                      >
                        <span className="fp-photo-option__icon" aria-hidden>
                          <Upload size={22} color="#F54E25" />
                        </span>
                        <span className="fp-photo-option__body">
                          <span className="fp-photo-option__title">From this PC</span>
                          <span className="fp-photo-option__desc">Choose an existing image from your computer.</span>
                        </span>
                        <ChevronRight size={18} className="fp-photo-option__arrow" aria-hidden />
                      </button>
                    </div>
                    {photoError ? <div className="fp-photo-error" role="alert">{photoError}</div> : null}
                  </div>
                </div>
              )}

              <div className="fp-profile-body">
                {saveNotice && <div className="fp-save-notice">{saveNotice}</div>}

                {/* Profile Information */}
                <div className="fp-section-card">
                  <div className="fp-section-head">
                    <h3 className="fp-section-title">
                      <span className="fp-section-title__icon"><User size={14} color="#F54E25" /></span>
                      Profile Information
                    </h3>
                    {!isEditingProfile ? (
                      <button type="button" className="fp-btn fp-btn--primary" onClick={handleEditToggle}>
                        <Pencil size={14} /> Edit Profile
                      </button>
                    ) : (
                      <div className="fp-section-actions">
                        <button type="button" className="fp-btn" onClick={handleCancelEdit}>Cancel</button>
                        <button type="button" className="fp-btn fp-btn--primary" onClick={handleSaveProfile}>Save</button>
                      </div>
                    )}
                  </div>

                  <div className="fp-field">
                    <label className="fp-field-label">Full Name</label>
                    <input className="fp-input" name="fullName" value={draftProfile.fullName} onChange={handleProfileInput} disabled={!isEditingProfile} />
                  </div>
                  <div className="fp-field">
                    <label className="fp-field-label">Email</label>
                    <input className="fp-input" name="email" value={draftProfile.email} onChange={handleProfileInput} disabled={!isEditingProfile} />
                  </div>
                  <div className="fp-field">
                    <label className="fp-field-label">Phone Number</label>
                    <input className="fp-input" name="phone" value={draftProfile.phone} onChange={handleProfileInput} disabled={!isEditingProfile} />
                  </div>
                  <div className="fp-field">
                    <label className="fp-field-label">Address</label>
                    <input className="fp-input" name="address" value={draftProfile.address} onChange={handleProfileInput} disabled={!isEditingProfile} />
                  </div>
                </div>

                {/* Settings */}
                <div className="fp-section-card">
                  <h3 className="fp-section-title" style={{ marginBottom: 14 }}>
                    <span className="fp-section-title__icon"><Shield size={14} color="#F54E25" /></span>
                    Settings
                  </h3>
                  <div className="fp-settings-list">
                    <div className="fp-settings-item" onClick={() => navigate('/changepass')}>
                      <span className="fp-settings-item__icon"><Lock size={16} color="#4338ca" /></span>
                      <span className="fp-settings-item__text">Change Password</span>
                      <ChevronRight size={16} className="fp-settings-item__chevron" />
                    </div>
                    <div
                      className="fp-settings-item"
                      onClick={() => setNotificationOpen(!notificationOpen)}
                    >
                      <span className="fp-settings-item__icon"><Bell size={16} color="#4338ca" /></span>
                      <span className="fp-settings-item__text">Notification Settings</span>
                      <ChevronRight size={16} className="fp-settings-item__chevron" style={{ transform: notificationOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                    </div>
                  </div>
                  {notificationOpen && (
                    <div className="fp-notif-expanded">
                      <div className="fp-notif-row">
                        <span>Notification sounds</span>
                        <div
                          className="fp-toggle"
                          onClick={() => setNotificationSounds(!notificationSounds)}
                          style={{ background: notificationSounds ? '#F54E25' : '#D0D5DD' }}
                          role="switch"
                          aria-checked={notificationSounds}
                        >
                          <div className="fp-toggle__thumb" style={{ left: notificationSounds ? 25 : 3 }} />
                        </div>
                      </div>
                      <div className="fp-notif-row" onClick={() => setShowMuteDropdown(!showMuteDropdown)}>
                        <span>Mute Notifications</span>
                        <div className="fp-notif-row-right">
                          <span>{muteOption}</span>
                          <ChevronRight size={16} />
                          {showMuteDropdown && (
                            <div className="fp-mute-dropdown" onClick={(e) => e.stopPropagation()}>
                              {['1 Hour', '5 Hours', '12 Hours', '1 Day', 'Until I change it'].map((opt) => (
                                <div
                                  key={opt}
                                  className={`fp-mute-option${muteOption === opt ? ' fp-mute-option--selected' : ''}`}
                                  onClick={() => { setMuteOption(opt); setShowMuteDropdown(false); }}
                                >
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>

        <FamilyMobileBottomNav />

      </div>
      <FloatingChatHead />
    </div>
  );
};

export default Profile;