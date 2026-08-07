import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const DESKTOP_IDLE_MS = 3 * 60 * 1000;
const MOBILE_IDLE_MS = 12 * 60 * 1000;
const WARNING_SECONDS = 30;

/** Admin accounts get a much stricter lock: idle blacks out the screen and requires
 *  the account password to resume, instead of the softer warning-then-reload other roles get. */
const ADMIN_LOCK_IDLE_MS = 2 * 60 * 1000;

function idleTimeoutMs() {
  if (typeof window === 'undefined') return DESKTOP_IDLE_MS;
  const mobile =
    window.matchMedia('(max-width: 899px)').matches ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return mobile ? MOBILE_IDLE_MS : DESKTOP_IDLE_MS;
}

/** Align with Supabase `is_staff()` JWT: user_metadata, then app_metadata. */
export function getAccountTypeFromUser(user) {
  if (!user) return null;
  const raw = user.user_metadata?.account_type ?? user.app_metadata?.account_type ?? 'family';
  const r = String(raw).trim().toLowerCase();
  if (r === 'nurse' || r === 'admin' || r === 'family' || r === 'program') return r;
  if (r === 'staff' || r === 'case_load_manager' || r === 'case manager' || r === 'case_manager') return 'program';
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
      if (r === 'nurse' || r === 'admin' || r === 'family' || r === 'program') return r;
      if (r === 'staff' || r === 'case_load_manager' || r === 'case manager' || r === 'case_manager') return 'program';
    }
  } catch {
    // fall through
  }
  return getAccountTypeFromUser(user);
}

function homeForRole(role) {
  if (role === 'admin') return '/admin-dashboard';
  if (role === 'nurse') return '/nurse-dashboard';
  if (role === 'program') return '/program';
  // Family portal is mobile-only now — there is no web dashboard to send them to.
  return '/get-the-app';
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {('family'|'nurse'|'admin'|'program')[]} props.allowedRoles
 */
export function RoleGuard({ children, allowedRoles }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, user: null, role: null });
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState(0);
  const [locked, setLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

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
    // Admin gets the stricter black-screen lock below instead of this soft warning.
    if (!state.user || state.role === 'admin') return;
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
      idleTimer = window.setTimeout(startIdleCountdown, idleTimeoutMs());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.id, state.role]);

  /** Admin-only: idle blacks out the screen; only the account password reopens it.
   *  Re-runs whenever `locked` flips — that's what restarts the idle countdown immediately
   *  after a successful unlock, instead of waiting for the next mouse move. */
  useEffect(() => {
    if (!state.user || state.role !== 'admin') return;
    let idleTimer = null;

    const armIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setLocked(true), ADMIN_LOCK_IDLE_MS);
    };

    const onActivity = () => {
      // Once locked, only a correct password (handleUnlock) should clear it — activity
      // alone (e.g. the mouse move that woke the screen back up) must not bypass it.
      if (!locked) armIdleTimer();
    };

    armIdleTimer();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
    // state.user is a fresh object on every Supabase auth event (token refresh, tab
    // re-sync, ...) even for the same logged-in user — depending on it directly would
    // tear down and re-arm this effect on every such event, resetting the idle timer
    // each time and potentially never reaching the threshold. state.user.id is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.id, state.role, locked]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPassword.trim() || !state.user?.email) return;
    setUnlocking(true);
    setUnlockError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: state.user.email,
      password: unlockPassword,
    });
    setUnlocking(false);
    if (error) {
      setUnlockError('Incorrect password. Try again.');
      return;
    }
    setUnlockPassword('');
    setUnlockError('');
    setLocked(false);
  };

  const handleLockedLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

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
      {locked && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <form
            onSubmit={handleUnlock}
            role="dialog"
            aria-modal="true"
            aria-label="Session locked"
            style={{
              width: 'min(92vw, 400px)',
              background: '#111827',
              border: '1px solid #1F2937',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              padding: 26,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(245, 78, 37, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                fontSize: 22,
              }}
              aria-hidden="true"
            >
              🔒
            </div>
            <h3 style={{ margin: 0, fontSize: 19, color: '#FFFFFF', fontWeight: 800 }}>Session locked</h3>
            <p style={{ margin: '8px 0 18px', fontSize: 13.5, color: '#94A3B8', lineHeight: 1.5 }}>
              You&apos;ve been idle for a while. Enter your admin password to keep working.
            </p>
            <input
              type="password"
              autoFocus
              value={unlockPassword}
              onChange={(e) => {
                setUnlockPassword(e.target.value);
                if (unlockError) setUnlockError('');
              }}
              placeholder="Admin password"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px',
                fontSize: 14,
                borderRadius: 10,
                border: `1px solid ${unlockError ? '#F87171' : '#374151'}`,
                background: '#1F2937',
                color: '#FFFFFF',
                outline: 'none',
              }}
            />
            {unlockError && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#F87171', fontWeight: 600 }}>{unlockError}</p>
            )}
            <button
              type="submit"
              disabled={unlocking || !unlockPassword.trim()}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '11px 14px',
                fontSize: 14,
                fontWeight: 800,
                color: '#FFFFFF',
                background: unlocking || !unlockPassword.trim() ? '#7C2D12' : '#F54E25',
                border: 'none',
                borderRadius: 10,
                cursor: unlocking || !unlockPassword.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
            <button
              type="button"
              onClick={handleLockedLogout}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '9px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#94A3B8',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Not you? Log out instead
            </button>
          </form>
        </div>
      )}
    </>
  );
}
