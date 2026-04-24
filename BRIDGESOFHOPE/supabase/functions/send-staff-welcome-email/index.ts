import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Safe for double-quoted HTML attributes (e.g. href). */
function escapeAttr(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function buildStaffWelcomeEmailHtml(params: {
  safeName: string;
  safeLogin: string;
  safePw: string;
  safeHref: string;
  logoUrl: string;
}) {
  const { safeName, safeLogin, safePw, safeHref, logoUrl } = params;
  const safeHrefAttr = safeHref ? escapeAttr(safeHref) : '';
  const logoTrim = logoUrl.trim();
  const logoBlock =
    logoTrim && /^https:\/\//i.test(logoTrim)
      ? `<img src="${escapeAttr(logoTrim)}" alt="Bridges of Hope" width="160" height="auto" style="display:block;margin:0 auto 16px;max-width:160px;height:auto;border:0;outline:none;" />`
      : '';

  const ctaRow = safeHref
    ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 8px;">
                <tr>
                  <td bgcolor="#f97316" style="border-radius:10px;background-color:#f97316;mso-padding-alt:14px 28px;">
                    <a href="${safeHrefAttr}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;font-weight:700;line-height:1.25;color:#ffffff;text-decoration:none;border-radius:10px;">Sign in to your account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
                <a href="${safeHrefAttr}" style="color:#2563eb;text-decoration:underline;">Having trouble with the button? Open this link</a>
              </p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>Your staff account</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your Bridges of Hope staff login details are ready. Sign in and change your password when you can.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2ff;">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(27,37,89,0.08);overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td bgcolor="#1B2559" style="background-color:#1B2559;padding:28px 28px 26px;text-align:center;">
                    ${logoBlock}
                    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;line-height:1.2;">
                      Bridges of Hope
                    </div>
                    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;font-weight:500;color:rgba(255,255,255,0.88);margin-top:8px;line-height:1.4;">
                      Staff welcome
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">
                      Hello <strong style="color:#1B2559;">${safeName}</strong>,
                    </p>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
                      Your staff account is ready. Use the credentials below to sign in, then update your password from your profile or security settings when you can.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;border-left:4px solid #1B2559;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">
                            Login email
                          </p>
                          <p style="margin:0 0 18px;font-size:15px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45;color:#0f172a;word-break:break-all;">
                            ${safeLogin}
                          </p>
                          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">
                            Initial password
                          </p>
                          <p style="margin:0;font-size:15px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45;color:#0f172a;word-break:break-word;">
                            ${safePw}
                          </p>
                        </td>
                      </tr>
                    </table>
                    ${ctaRow}
                    <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#94a3b8;text-align:center;">
                      If you did not expect this message, contact your administrator.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
              © ${new Date().getUTCFullYear()} Bridges of Hope
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Resend expects `from` like `Name <addr@domain>`. Full `RESEND_FROM` wins; else `RESEND_FROM_EMAIL` only. */
function resolveResendFromHeader(): string {
  const full = Deno.env.get('RESEND_FROM')?.trim();
  if (full) return full;
  const emailOnly = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (emailOnly && emailRe.test(emailOnly)) {
    return `Bridges of Hope <${emailOnly}>`;
  }
  return 'Bridges of Hope <onboarding@resend.dev>';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: prof } = await adminClient
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = String(prof?.account_type || '').toLowerCase().trim() === 'admin';
  if (!isAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const to = String(body.to || '').trim().slice(0, 320);
  const institutionalEmail = String(body.institutionalEmail || '').trim().slice(0, 320);
  const temporaryPassword = String(body.temporaryPassword || '').slice(0, 256);
  const fullName = String(body.fullName || '').trim().slice(0, 200);
  const loginUrl = String(body.loginUrl || '').trim().slice(0, 512);

  if (!emailRe.test(to) || !emailRe.test(institutionalEmail)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (temporaryPassword.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid password payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        skipped: true,
        reason: 'RESEND_API_KEY is not set on the Edge Function (supabase secrets set RESEND_API_KEY=...).',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const from = resolveResendFromHeader();
  const safeName = escapeHtml(fullName || 'there');
  const safeLogin = escapeHtml(institutionalEmail);
  const safePw = escapeHtml(temporaryPassword);
  let safeHref = '';
  try {
    const u = new URL(loginUrl);
    if (u.protocol === 'https:' || u.protocol === 'http:') safeHref = u.href;
  } catch {
    safeHref = '';
  }

  /** Optional HTTPS URL to a hosted logo (e.g. CDN). Supabase: `supabase secrets set RESEND_BRAND_LOGO_URL=https://...` */
  const logoUrl = String(Deno.env.get('RESEND_BRAND_LOGO_URL') || '').trim().slice(0, 512);
  const html = buildStaffWelcomeEmailHtml({
    safeName,
    safeLogin,
    safePw,
    safeHref,
    logoUrl,
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Welcome — your Bridges of Hope staff login',
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[send-staff-welcome-email] Resend error', res.status, errText);
    let msg =
      'Resend rejected the request. Verify RESEND_API_KEY, RESEND_FROM, and domain/DNS in the Resend dashboard.';
    try {
      const j = JSON.parse(errText) as Record<string, unknown>;
      const m = j?.message;
      if (typeof m === 'string' && m.trim()) msg = m.trim();
    } catch {
      /* use default */
    }
    // 200 so supabase-js returns JSON in `data` and the admin UI can show `error`.
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
