import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/** Align with Supabase `is_staff()` JWT: user_metadata, then app_metadata. */
export function getAccountTypeFromUser(user) {
  if (!user) return null;
  const raw = user.user_metadata?.account_type ?? user.app_metadata?.account_type ?? 'family';
  const r = String(raw).trim().toLowerCase();
  if (r === 'nurse' || r === 'admin' || r === 'family') return r;
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
    }
  } catch {
    // fall through
  }
  return getAccountTypeFromUser(user);
}

function homeForRole(role) {
  if (role === 'admin') return '/admin-dashboard';
  if (role === 'nurse') return '/nurse-dashboard';
  return '/home';
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {('family'|'nurse'|'admin')[]} props.allowedRoles
 */
export function RoleGuard({ children, allowedRoles }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, user: null, role: null });

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

  return children;
}
