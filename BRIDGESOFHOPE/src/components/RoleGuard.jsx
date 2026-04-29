import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const IDLE_MS = 3 * 60 * 1000;
const WARNING_SECONDS = 30;

/** Align with Supabase `is_staff()` JWT: user_metadata, then app_metadata. */
export function getAccountTypeFromUser(user) {
  if (!user) return null;
  const raw = user.user_metadata?.account_type ?? user.app_metadata?.account_type ?? 'family';
  const r = String(raw).trim().toLowerCase();
  if (r === 'nurse' || r === 'admin' || r === 'family') return r;
  if (r === 'staff' || r === 'case_load_manager' || r === 'case manager') return 'case_manager';
  return 'family';
}

/**
 * Prefer `public.profiles.account_type` (Table Editor / staff records), then JWT metadata.
 * Requires RLS to allow the signed-in user to read their own profile row (typical: id = auth.uid()).
 */
export async function resolveAccountRole(user) {
  if (!user?.id) return 'family';
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && data?.account_type != null && String(data.account_type).trim() !== '') {
      const r = String(data.account_type).trim().toLowerCase();
      if (r === 'nurse' || r === 'admin' || r === 'family') return r;
      if (r === 'staff' || r === 'case_load_manager' || r === 'case manager') return 'case_manager';
    }
  } catch {
    // fall through
  }
  return getAccountTypeFromUser(user);
}

function homeForRole(role) {
  if (role === 'admin') return '/admin-dashboard';
  if (role === 'nurse') return '/nurse-dashboard';
  if (role === 'case_manager') return '/case-dashboard';
  return '/home';
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {('family'|'nurse'|'admin'|'case_manager')[]} props.allowedRoles
 */
export function RoleGuard({ children, allowedRoles }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, user: null, role: null });
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ loading: false, user: null, role: null });
      return;
    }
    let cancelled = false;

    const applySession = async (session) => {
      const user = session?.user ?? null;
      if (!user) {
        if (!cancelled) setState({ loading: false, user: null, role: null });
        return;
      }
      const role = await resolveAccountRole(user);
      if (!cancelled) setState({ loading: false, user, role });
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await applySession(session);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!state.user) return;
    let warningInterval = null;
    let warningTimeout = null;
    let idleTimer = null;

    const clearWarning = () => {
      if (warningInterval) {
        window.clearInterval(warningInterval);
        warningInterval = null;
      }
      if (warningTimeout) {
        window.clearTimeout(warningTimeout);
        warningTimeout = null;
      }
      setIdleWarningSecondsLeft(0);
    };

    const startIdleCountdown = () => {
      clearWarning();
      setIdleWarningSecondsLeft(WARNING_SECONDS);
      warningInterval = window.setInterval(() => {
        setIdleWarningSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      warningTimeout = window.setTimeout(() => {
        window.location.reload();
      }, WARNING_SECONDS * 1000);
    };

    const armIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(startIdleCountdown, IDLE_MS);
    };

    const onActivity = () => {
      clearWarning();
      armIdleTimer();
    };

    armIdleTimer();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      clearWarning();
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [state.user]);

  if (!isSupabaseConfigured()) {
    return children;
  }

  if (state.loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#64748b',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!state.user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const role = state.role ?? getAccountTypeFromUser(state.user);
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return (
    <>
      {children}
      {idleWarningSecondsLeft > 0 && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: 'min(92vw, 460px)',
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, color: '#1E293B', fontWeight: 800 }}>Session idle warning</h3>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              No activity detected. This page will refresh in <strong>{idleWarningSecondsLeft}s</strong>.
              Move your mouse, scroll, or press any key to continue working.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
