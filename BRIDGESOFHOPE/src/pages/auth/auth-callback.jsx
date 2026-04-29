import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resolveAccountRole } from '@/components/RoleGuard';

function navigateForRole(navigate, role) {
  const r = (role ?? 'family').toLowerCase();
  if (r === 'nurse') navigate('/nurse-dashboard', { replace: true });
  else if (r === 'admin') navigate('/admin-dashboard', { replace: true });
  else if (r === 'case_manager') navigate('/case-dashboard', { replace: true });
  else navigate('/home', { replace: true });
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message] = useState('Completing sign-in…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isSupabaseConfigured()) {
        navigate('/login', { replace: true });
        return;
      }

      const url = new URL(window.location.href);
      const oauthErr = url.searchParams.get('error');
      if (oauthErr) {
        const desc = url.searchParams.get('error_description') || oauthErr;
        await supabase.auth.signOut();
        navigate(
          `/login?oauth_error=${encodeURIComponent(desc)}`,
          { replace: true }
        );
        return;
      }

      const finishWithSession = async (session) => {
        if (!session?.user) {
          navigate('/login?oauth_error=no_session', { replace: true });
          return;
        }
        const accountRole = await resolveAccountRole(session.user);
        navigateForRole(navigate, accountRole);
      };

      try {
        const code = url.searchParams.get('code');
        let session = null;

        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(window.location.href);
          if (!exchangeError && exchangeData?.session) {
            session = exchangeData.session;
          } else if (exchangeError) {
            const { data: fallback } = await supabase.auth.getSession();
            session = fallback?.session ?? null;
            if (!session) throw exchangeError;
          }
        }

        if (!session) {
          const { data: got, error: sessionError } =
            await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          session = got?.session ?? null;
        }

        await finishWithSession(session);
      } catch {
        if (cancelled) return;
        const { data: lastChance } = await supabase.auth.getSession();
        if (lastChance?.session?.user) {
          await finishWithSession(lastChance.session);
          return;
        }
        await supabase.auth.signOut();
        navigate('/login?oauth_error=callback', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#334155',
      }}
    >
      <p style={{ fontSize: '1rem' }}>{message}</p>
    </div>
  );
}
