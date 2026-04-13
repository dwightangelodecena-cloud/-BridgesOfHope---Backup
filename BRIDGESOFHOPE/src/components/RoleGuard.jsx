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
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ loading: false, user: null });
      return;
    }
    let cancelled = false;

    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setState({ loading: false, user: session?.user ?? null });
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState({ loading: false, user: session?.user ?? null });
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

  const role = getAccountTypeFromUser(state.user);
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return children;
}
