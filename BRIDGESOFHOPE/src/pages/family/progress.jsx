import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, Calendar, Plus, X, Activity, Bed, UserCheck, CheckCircle, Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData, APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { useAsyncData } from '@/hooks/useAsyncData';
import { familyDataService } from '@/services/familyDataService';
import { FAMILY_COLORS, StatusBadge, Timeline, AuditLine, LoadingState, ErrorState } from '@/components/family/shared/ui';

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
    const [showDischargeFormModal, setShowDischargeFormModal] = useState(false);
    const [dischargeForm, setDischargeForm] = useState({
        reasonCategory: '',
        reasonDetails: '',
        preferredDate: '',
        pickupAuthorized: '',
        followUpPhone: '',
        otherInfo: ''
    });
    const [dischargeFormErrors, setDischargeFormErrors] = useState({});
    const [patientImages, setPatientImages] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [patientNotes, setPatientNotes] = useState({});
    const [displayName, setDisplayName] = useState('Family User');
    const [userInitials, setUserInitials] = useState('FU');
    const fileInputRefs = useRef([]);
    const detailsFileInputRef = useRef(null);
    const notificationsDesktopRef = useRef(null);
    const notificationsMobileRef = useRef(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationItems = [
        'Submit missing laboratory result before Friday.',
        'Family support session is scheduled on April 5, 10:00 AM.',
        'Weekly report reviewed by your assigned counselor.',
    ];

    const [patients, setPatients] = useState([]);
    const {
        data: sharedSummary,
        loading: summaryLoading,
        error: summaryError,
        refresh: refreshSummary,
    } = useAsyncData(async () => familyDataService.getRequestsSummary(), []);

    useEffect(() => {
        let cancelled = false;

        const loadPatients = async () => {
            if (!isSupabaseConfigured()) {
                const saved = localStorage.getItem('bh_patients');
                setPatients(saved ? JSON.parse(saved) : []);
                return;
            }
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                setPatients([]);
                return;
            }
            const { data, error } = await supabase
                .from('patients')
                .select('id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at')
                .eq('family_id', user.id)
                .is('discharged_at', null)
                .order('admitted_at', { ascending: false });

            if (cancelled) return;
            if (error) {
                console.warn('[patients]', error.message);
                setPatients([]);
                return;
            }
            setPatients((data || []).map((r) => uiPatientFromRow(r)).filter(Boolean));
        };

        loadPatients();
        window.addEventListener('storage', loadPatients);
        window.addEventListener(APP_DATA_REFRESH, loadPatients);
        return () => {
            cancelled = true;
            window.removeEventListener('storage', loadPatients);
            window.removeEventListener(APP_DATA_REFRESH, loadPatients);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const deriveInitials = (name) =>
            name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('') || 'FU';

        const loadUser = async () => {
            const { data } = await supabase.auth.getUser();
            const user = data?.user;

            const fallbackProfile = localStorage.getItem('bh_family_profile');
            const fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;

            let resolvedName =
                user?.user_metadata?.full_name ||
                [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
                fallbackName ||
                'Family User';

            if (user?.id) {
                const { data: profileRow } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profileRow?.full_name) resolvedName = profileRow.full_name;
            }

            if (isMounted) {
                setDisplayName(resolvedName);
                setUserInitials(deriveInitials(resolvedName));
            }
        };

        loadUser();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!showNotifications) return;
        const onDoc = (e) => {
            const t = e.target;
            const inDesktop = notificationsDesktopRef.current?.contains(t);
            const inMobile = notificationsMobileRef.current?.contains(t);
            if (!inDesktop && !inMobile) setShowNotifications(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [showNotifications]);

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

    const openDischargeForm = () => {
        const profile = JSON.parse(localStorage.getItem('bh_family_profile') || '{}');
        setDischargeForm({
            reasonCategory: '',
            reasonDetails: '',
            preferredDate: '',
            pickupAuthorized: '',
            followUpPhone: profile.phone || '',
            otherInfo: ''
        });
        setDischargeFormErrors({});
        setShowDischargeFormModal(true);
    };

    const handleDischargeFormChange = (e) => {
        const { name, value } = e.target;
        setDischargeForm((prev) => ({ ...prev, [name]: value }));
        if (dischargeFormErrors[name] || dischargeFormErrors.submit) {
            setDischargeFormErrors((prev) => {
                const next = { ...prev, [name]: '' };
                delete next.submit;
                return next;
            });
        }
    };

    const submitDischargeRequest = async () => {
        if (!selectedPatient) return;

        const errs = {};
        if (!dischargeForm.reasonCategory) {
            errs.reasonCategory = 'Please select a reason for discharge.';
        }
        const details = dischargeForm.reasonDetails.trim();
        if (!details) {
            errs.reasonDetails = 'Please describe why the patient should be discharged.';
        } else if (details.length < 15) {
            errs.reasonDetails = 'Please add more detail (at least 15 characters).';
        }
        const phone = dischargeForm.followUpPhone.trim();
        if (phone && !/^[0-9]{10,13}$/.test(phone)) {
            errs.followUpPhone = 'Enter a valid contact number (10–13 digits).';
        }
        if (Object.keys(errs).length) {
            setDischargeFormErrors(errs);
            return;
        }

        const patientToDischarge = patients.find((p) => p.id === selectedPatient.id);
        if (!patientToDischarge) return;

        if (!isSupabaseConfigured()) {
            const savedPending = localStorage.getItem('bh_pending_discharges');
            const currentPending = savedPending ? JSON.parse(savedPending) : [];
            if (currentPending.some((req) => req.id === patientToDischarge.id || req.originalId === patientToDischarge.id)) {
                setShowDischargeFormModal(false);
                setShowDischargeSuccessModal(true);
                return;
            }
            const profile = JSON.parse(localStorage.getItem('bh_family_profile') || '{}');
            const dischargeRequest = {
                ...patientToDischarge,
                requestTime: new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                familyNumber: phone || profile.phone || '09123456789',
                familyEmail: profile.email || 'Sample@email.com',
                patientNumber: profile.phone || '09123456789',
                dischargeReasonCategory: dischargeForm.reasonCategory,
                dischargeReasonDetails: details,
                preferredDischargeDate: dischargeForm.preferredDate || null,
                pickupAuthorized: dischargeForm.pickupAuthorized.trim() || null,
                followUpPhone: phone || null,
                dischargeOtherInfo: dischargeForm.otherInfo.trim() || null,
            };
            localStorage.setItem('bh_pending_discharges', JSON.stringify([...currentPending, dischargeRequest]));
            window.dispatchEvent(new Event('storage'));
            await appendActivityFeed(`Discharge request submitted for ${patientToDischarge.name}. Awaiting admin review.`);
            setShowDischargeFormModal(false);
            setShowDischargeSuccessModal(true);
            return;
        }

        const {
            data: { user },
            error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) {
            setDischargeFormErrors({ submit: 'Please sign in to submit a discharge request.' });
            return;
        }

        const { count: pendingCount, error: cntErr } = await supabase
            .from('discharge_requests')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', patientToDischarge.id)
            .eq('status', 'pending');

        if (cntErr) {
            setDischargeFormErrors({ submit: cntErr.message });
            return;
        }
        if ((pendingCount || 0) > 0) {
            setShowDischargeFormModal(false);
            setShowDischargeSuccessModal(true);
            return;
        }

        const { data: profileRow } = await supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle();
        const profilePhone = profileRow?.phone?.trim() || '';

        const { error } = await supabase.from('discharge_requests').insert({
            patient_id: patientToDischarge.id,
            family_id: user.id,
            reason_category: dischargeForm.reasonCategory,
            reason_details: details,
            preferred_discharge_date: dischargeForm.preferredDate || null,
            pickup_authorized: dischargeForm.pickupAuthorized.trim() || null,
            follow_up_phone: phone || null,
            other_info: dischargeForm.otherInfo.trim() || null,
            guardian_phone: phone || profilePhone || null,
            guardian_email: user.email || null,
        });

        if (error) {
            setDischargeFormErrors({ submit: error.message });
            return;
        }

        await appendActivityFeed(
            `Discharge request submitted for ${patientToDischarge.name}. Awaiting admin review.`,
            { familyId: user.id }
        );
        refreshAppData();
        setShowDischargeFormModal(false);
        setShowDischargeSuccessModal(true);
    };

    const filteredPatients = patients.filter((patient) => {
        const matchesSearch = patient.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || (patient.status || '').toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const avgProgress = patients.length
        ? Math.round(patients.reduce((sum, patient) => sum + (Number(patient.progress) || 0), 0) / patients.length)
        : 0;

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
                    box-sizing: border-box;
                    border: 2px solid transparent;
                    border-radius: 12px;
                }

                .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
                .sidebar-icon-wrap {
                    padding: 12px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; white-space: nowrap; color: #707EAE; }

                .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                
                .top-nav {
                    height: 85px;
                    background: white;
                    display: flex;
                    align-items: center;
                    padding: 0 30px;
                    border-bottom: 1px solid #F1F1F1;
                    z-index: 300;
                    box-sizing: border-box;
                }
                .top-nav-left { display: flex; align-items: center; gap: 40px; flex-wrap: wrap; min-width: 0; }
                .view-title { color: #F54E25; font-weight: 700; font-size: 20px; }
                .welcome-text { color: #1B2559; font-weight: 500; font-size: 16px; }
                .top-nav-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
                .user-avatar-top {
                    width: 40px;
                    height: 40px;
                    min-width: 40px;
                    min-height: 40px;
                    background: #F54E25;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 13px;
                    box-sizing: border-box;
                }

                .notifications-dropdown {
                    position: absolute;
                    top: calc(100% + 10px);
                    right: 0;
                    width: min(360px, calc(100vw - 48px));
                    background: white;
                    border: 1px solid #E9EDF7;
                    border-radius: 14px;
                    box-shadow: 0 12px 40px rgba(27, 37, 89, 0.12);
                    padding: 16px;
                    z-index: 500;
                }
                .notifications-trigger {
                    width: 40px;
                    height: 40px;
                    min-width: 40px;
                    min-height: 40px;
                    padding: 0;
                    box-sizing: border-box;
                    flex-shrink: 0;
                    border-radius: 50%;
                    border: none;
                    background: #F54E25;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    box-shadow: 0 2px 10px rgba(245, 78, 37, 0.4);
                }
                .notifications-trigger svg {
                    display: block;
                    width: 21px;
                    height: 21px;
                    stroke: #ffffff;
                    color: #ffffff;
                    flex-shrink: 0;
                }
                .notifications-trigger:hover {
                    background: #e0421a;
                    box-shadow: 0 4px 14px rgba(245, 78, 37, 0.5);
                }
                .notifications-trigger:focus-visible {
                    outline: 2px solid #1B2559;
                    outline-offset: 2px;
                }
                .notif-dropdown-title {
                    color: #1B2559;
                    font-weight: 800;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .notif-dropdown-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    margin-bottom: 10px;
                    color: #334155;
                    font-size: 13px;
                }
                
                .content-area { 
                    flex: 1; 
                    padding: 30px 40px; 
                    overflow-y: ${selectedPatient ? 'hidden' : 'auto'}; 
                    position: relative; 
                }

                .header-section { margin-bottom: 30px; }
                .header-section h1 { font-size: 28px; color: #1B2559; font-weight: 800; }
                .header-section h1 span { color: #F54E25; }
                .header-tools {
                    display: flex;
                    gap: 10px;
                    margin-top: 14px;
                    flex-wrap: wrap;
                }
                .tool-input {
                    background: white;
                    border: 1px solid #E9EDF7;
                    border-radius: 12px;
                    padding: 10px 12px;
                    font-size: 13px;
                    color: #1B2559;
                    min-width: 210px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                    margin-bottom: 22px;
                }
                .summary-card {
                    background: white;
                    border: 1px solid #E9EDF7;
                    border-radius: 16px;
                    padding: 14px 16px;
                }

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

                .discharge-form-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.45);
                    z-index: 7000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    backdrop-filter: blur(4px);
                }
                .discharge-form-box {
                    background: white;
                    border-radius: 20px;
                    width: 100%;
                    max-width: 520px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 28px 28px 24px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.15);
                    color-scheme: light;
                }
                .discharge-form-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1B2559;
                    margin: 0 0 6px 0;
                }
                .discharge-form-sub {
                    font-size: 13px;
                    color: #64748B;
                    margin-bottom: 20px;
                }
                .discharge-field { margin-bottom: 16px; text-align: left; }
                .discharge-field label {
                    display: block;
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .discharge-field .req { color: #F54E25; }
                .discharge-field input,
                .discharge-field select,
                .discharge-field textarea {
                    width: 100%;
                    padding: 12px 14px;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    font-size: 14px;
                    color: #1B2559;
                    background: #fff;
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .discharge-field textarea { min-height: 100px; resize: vertical; }
                .discharge-field select { cursor: pointer; }
                .discharge-field input:focus,
                .discharge-field select:focus,
                .discharge-field textarea:focus {
                    outline: none;
                    border-color: #F54E25;
                    box-shadow: 0 0 0 3px rgba(245, 78, 37, 0.12);
                }
                .discharge-field-error {
                    font-size: 12px;
                    color: #DC2626;
                    margin-top: 4px;
                    font-weight: 500;
                }
                .discharge-form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }
                .discharge-form-actions button {
                    flex: 1;
                    min-width: 120px;
                    padding: 14px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    border: none;
                }
                .discharge-btn-cancel {
                    background: #F1F5F9;
                    color: #475569;
                }
                .discharge-btn-submit {
                    background: #F54E25;
                    color: white;
                }
                
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
                    .mobile-top-bar-right {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .mobile-notifications-trigger.notifications-trigger {
                        width: 38px;
                        height: 38px;
                        min-width: 38px;
                        min-height: 38px;
                        padding: 0;
                    }
                    .mobile-notifications-trigger.notifications-trigger svg {
                        width: 18px;
                        height: 18px;
                    }
                    .mobile-notifications-dropdown.notifications-dropdown {
                        right: 0;
                        left: auto;
                        width: min(340px, calc(100vw - 40px));
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
                    .summary-grid { grid-template-columns: 1fr; }
                    .tool-input { width: 100%; min-width: 0; }

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
                    <div className="sidebar-icon-wrap">
                        <Home size={22} color="#707EAE" />
                    </div>
                    <span className="sidebar-label">Dashboard</span>
                </div>
                <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
                    <div className="sidebar-icon-wrap">
                        <TrendingUp size={22} color="#707EAE" />
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
                    <span className="welcome-text">Welcome back, {displayName}</span>
                    </div>
                    <div className="top-nav-actions">
                        <div ref={notificationsDesktopRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="notifications-trigger"
                                aria-expanded={showNotifications}
                                aria-label="Notifications"
                                onClick={() => setShowNotifications((v) => !v)}
                            >
                                <Bell size={20} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
                            </button>
                            {showNotifications && (
                                <div className="notifications-dropdown">
                                    <div className="notif-dropdown-title">
                                        <Bell size={16} color="#F54E25" /> Notifications
                                    </div>
                                    {notificationItems.map((item) => (
                                        <div key={item} className="notif-dropdown-row">
                                            <CheckCircle2 size={15} color="#2B31ED" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="user-avatar-top">{userInitials}</div>
                    </div>
                </header>

                {/* Mobile top bar */}
                <div className="mobile-top-bar">
                    <img src={logo} alt="BH" className="mobile-top-bar-logo" />
                    <div className="mobile-top-bar-right">
                        <div ref={notificationsMobileRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="notifications-trigger mobile-notifications-trigger"
                                aria-expanded={showNotifications}
                                aria-label="Notifications"
                                onClick={() => setShowNotifications((v) => !v)}
                            >
                                <Bell size={18} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
                            </button>
                            {showNotifications && (
                                <div className="notifications-dropdown mobile-notifications-dropdown">
                                    <div className="notif-dropdown-title">
                                        <Bell size={16} color="#F54E25" /> Notifications
                                    </div>
                                    {notificationItems.map((item) => (
                                        <div key={item} className="notif-dropdown-row">
                                            <CheckCircle2 size={15} color="#2B31ED" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mobile-top-bar-avatar">{userInitials}</div>
                    </div>
                </div>

                <div className="content-area" style={{ background: FAMILY_COLORS.background }}>
                    <div className="header-section">
                        <h1><span>Hello,</span> {displayName}</h1>
                        <p style={{ color: '#A3AED0', marginTop: '5px', fontWeight: '500' }}>Here's an overview of your family members</p>
                        <div className="header-tools">
                            <input
                                className="tool-input"
                                placeholder="Search patient by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <select className="tool-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">All statuses</option>
                                <option value="recovering">Recovering</option>
                                <option value="in treatment">In Treatment</option>
                                <option value="stable">Stable</option>
                            </select>
                        </div>
                    </div>
                    <div
                        style={{
                            background: '#fff',
                            border: `1px solid ${FAMILY_COLORS.surface}`,
                            borderRadius: 16,
                            padding: 14,
                            marginBottom: 14,
                        }}
                        tabIndex={0}
                        aria-label="Progress and request overview"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ color: FAMILY_COLORS.text, fontWeight: 800 }}>Care Request Overview</div>
                            <StatusBadge label={(sharedSummary?.total || 0) > 0 ? 'Needs attention' : 'Stable'} tone={(sharedSummary?.total || 0) > 0 ? 'warning' : 'success'} />
                        </div>
                        {summaryLoading ? <LoadingState label="Loading request overview..." /> : null}
                        {summaryError ? <ErrorState label={summaryError} onRetry={refreshSummary} /> : null}
                        {!summaryLoading && !summaryError ? (
                            <>
                                <Timeline
                                    items={[
                                        { label: `Admission requests: ${sharedSummary?.admissions || 0}`, active: (sharedSummary?.admissions || 0) > 0, meta: 'Family initiated' },
                                        { label: `Discharge requests: ${sharedSummary?.discharges || 0}`, active: (sharedSummary?.discharges || 0) > 0, meta: 'Awaiting staff confirmation' },
                                    ]}
                                />
                                <AuditLine text={`Viewed ${new Date().toLocaleString()}`} />
                            </>
                        ) : null}
                    </div>

                    <div className="summary-grid">
                        <div className="summary-card">
                            <div style={{ color: '#64748B', fontWeight: 700, fontSize: 12 }}>TOTAL PATIENTS</div>
                            <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 26, marginTop: 8 }}>{patients.length}</div>
                        </div>
                        <div className="summary-card">
                            <div style={{ color: '#64748B', fontWeight: 700, fontSize: 12 }}>AVERAGE PROGRESS</div>
                            <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 26, marginTop: 8 }}>{avgProgress}%</div>
                        </div>
                        <div className="summary-card">
                            <div style={{ color: '#64748B', fontWeight: 700, fontSize: 12 }}>DISCHARGE READY (ATLEAST 80% OF PATIENT PROGRESS)</div>
                            <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 26, marginTop: 8 }}>
                                {patients.filter((p) => (Number(p.progress) || 0) >= 80).length}
                            </div>
                        </div>
                    </div>

                    <div className="patient-grid">
                        {filteredPatients.map((patient, i) => (
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
                        {filteredPatients.length === 0 && (
                            <div className="patient-card" style={{ minHeight: '180px', justifyContent: 'center', alignItems: 'center' }}>
                                <p style={{ color: '#94A3B8', fontWeight: 600 }}>No patients found for your current filter.</p>
                            </div>
                        )}

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
                                        <button type="button" className="discharge-btn" onClick={openDischargeForm}>
                                            <UserCheck size={20} /> Request discharge
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
                                    <div style={{ marginTop: 18 }}>
                                        <div style={{ color: '#64748B', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Family Notes</div>
                                        <textarea
                                            value={patientNotes[selectedPatient.id] || ''}
                                            onChange={(e) => setPatientNotes((prev) => ({ ...prev, [selectedPatient.id]: e.target.value }))}
                                            placeholder="Add quick notes or reminders for this patient..."
                                            style={{ width: '100%', minHeight: 90, border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, resize: 'vertical', fontFamily: 'inherit', background: '#fff', color: '#1B2559', colorScheme: 'light' }}
                                        />
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

                {showDischargeFormModal && selectedPatient && (
                    <div
                        className="discharge-form-overlay"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="discharge-form-title"
                        onClick={() => setShowDischargeFormModal(false)}
                    >
                        <div className="discharge-form-box" onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <h2 id="discharge-form-title" className="discharge-form-title">Discharge request</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowDischargeFormModal(false)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#64748B' }}
                                    aria-label="Close"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <p className="discharge-form-sub">
                                For patient: <strong>{selectedPatient.name}</strong>. This will be sent to the administrator for review.
                            </p>

                            <div className="discharge-field">
                                <label htmlFor="reasonCategory"><span className="req">*</span> Reason for discharge</label>
                                <select
                                    id="reasonCategory"
                                    name="reasonCategory"
                                    value={dischargeForm.reasonCategory}
                                    onChange={handleDischargeFormChange}
                                >
                                    <option value="">Select a reason</option>
                                    <option value="Treatment program completed">Treatment program completed</option>
                                    <option value="Medical / clinical recommendation">Medical / clinical recommendation</option>
                                    <option value="Family or guardian request">Family or guardian request</option>
                                    <option value="Patient request">Patient request</option>
                                    <option value="Transfer to another facility">Transfer to another facility</option>
                                    <option value="Financial or insurance">Financial or insurance</option>
                                    <option value="Other">Other</option>
                                </select>
                                {dischargeFormErrors.reasonCategory && (
                                    <div className="discharge-field-error">{dischargeFormErrors.reasonCategory}</div>
                                )}
                            </div>

                            <div className="discharge-field">
                                <label htmlFor="reasonDetails"><span className="req">*</span> Detailed explanation</label>
                                <textarea
                                    id="reasonDetails"
                                    name="reasonDetails"
                                    value={dischargeForm.reasonDetails}
                                    onChange={handleDischargeFormChange}
                                    placeholder="Describe the situation and why discharge is appropriate at this time..."
                                />
                                {dischargeFormErrors.reasonDetails && (
                                    <div className="discharge-field-error">{dischargeFormErrors.reasonDetails}</div>
                                )}
                            </div>

                            <div className="discharge-field">
                                <label htmlFor="preferredDate">Preferred discharge date</label>
                                <input
                                    id="preferredDate"
                                    name="preferredDate"
                                    type="date"
                                    value={dischargeForm.preferredDate}
                                    onChange={handleDischargeFormChange}
                                />
                            </div>

                            <div className="discharge-field">
                                <label htmlFor="pickupAuthorized">Person authorized to pick up patient (optional)</label>
                                <input
                                    id="pickupAuthorized"
                                    name="pickupAuthorized"
                                    type="text"
                                    value={dischargeForm.pickupAuthorized}
                                    onChange={handleDischargeFormChange}
                                    placeholder="Full name and relationship"
                                />
                            </div>

                            <div className="discharge-field">
                                <label htmlFor="followUpPhone">Follow-up contact number</label>
                                <input
                                    id="followUpPhone"
                                    name="followUpPhone"
                                    type="tel"
                                    value={dischargeForm.followUpPhone}
                                    onChange={handleDischargeFormChange}
                                    placeholder="10–13 digits"
                                />
                                {dischargeFormErrors.followUpPhone && (
                                    <div className="discharge-field-error">{dischargeFormErrors.followUpPhone}</div>
                                )}
                            </div>

                            <div className="discharge-field">
                                <label htmlFor="otherInfo">Other information for the care team (optional)</label>
                                <textarea
                                    id="otherInfo"
                                    name="otherInfo"
                                    value={dischargeForm.otherInfo}
                                    onChange={handleDischargeFormChange}
                                    placeholder="Medications, aftercare needs, transportation, etc."
                                    style={{ minHeight: 72 }}
                                />
                            </div>

                            {dischargeFormErrors.submit && (
                                <div className="discharge-field-error" style={{ marginBottom: 8 }}>
                                    {dischargeFormErrors.submit}
                                </div>
                            )}

                            <div className="discharge-form-actions">
                                <button type="button" className="discharge-btn-cancel" onClick={() => setShowDischargeFormModal(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="discharge-btn-submit" onClick={submitDischargeRequest}>
                                    Submit request
                                </button>
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