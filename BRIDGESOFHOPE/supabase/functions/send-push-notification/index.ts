import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Delivers a guardian notification straight to Firebase Cloud Messaging (FCM
 * HTTP v1) — no Expo push service, so no Expo account needed.
 *
 * Called by the `family_notifications_push` trigger (pg_net) with a shared
 * secret:  Authorization: Bearer ${PUSH_HOOK_SECRET}
 *
 * Function secrets (supabase secrets set …):
 *   PUSH_HOOK_SECRET            – matches the `push_hook_secret` Vault secret
 *   FCM_SERVICE_ACCOUNT         – the Firebase service-account JSON, verbatim
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY – auto-populated on hosted projects
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Google service-account → OAuth access token ─────────────────────────────

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: tokenUri,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(data)}`);
  }
  cachedToken = { value: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('PUSH_HOOK_SECRET')?.trim();
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!expectedSecret || provided !== expectedSecret) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'Server misconfigured' }, 500);
  if (!saRaw) return json({ ok: false, error: 'FCM_SERVICE_ACCOUNT not set' }, 500);

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(saRaw) as ServiceAccount;
  } catch {
    return json({ ok: false, error: 'FCM_SERVICE_ACCOUNT is not valid JSON' }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const familyId = String(payload.family_id ?? '').trim();
  const title = (String(payload.title ?? '').trim() || 'Bridges of Hope').slice(0, 120);
  const body = String(payload.body ?? '').trim().slice(0, 400);
  const category = String(payload.category ?? 'general').trim().slice(0, 40);
  const notificationId = String(payload.notification_id ?? '').trim();
  if (!familyId || !body) return json({ ok: false, error: 'family_id and body are required' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: tokens, error: tokErr } = await admin
    .from('device_push_tokens')
    .select('token, platform, sound')
    .eq('user_id', familyId);

  if (tokErr) {
    console.error('[send-push-notification] token lookup failed', tokErr.message);
    return json({ ok: false, error: 'Token lookup failed' }, 500);
  }
  if (!tokens || tokens.length === 0) return json({ ok: true, sent: 0, reason: 'no registered devices' });

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error('[send-push-notification]', e);
    return json({ ok: false, error: 'FCM auth failed' }, 502);
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;

  for (const t of tokens) {
    const tone = String(t.sound || 'default');
    const channelId = tone === 'silent' ? 'alerts_silent' : `alerts_${tone}`;
    const message = {
      message: {
        token: t.token,
        notification: { title, body },
        data: { category, notificationId },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: channelId,
            // pre-Android-8 fallback; on 8+ the channel decides the sound
            sound: tone === 'silent' ? undefined : tone === 'default' ? 'default' : tone,
          },
        },
      },
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
      } else {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { status?: string; message?: string };
        };
        const status = err.error?.status;
        if (status === 'NOT_FOUND' || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
          dead.push(t.token as string);
        }
        console.error('[send-push-notification] FCM send failed', res.status, JSON.stringify(err));
      }
    } catch (e) {
      console.error('[send-push-notification] FCM request error', e);
    }
  }

  if (dead.length) {
    await admin.from('device_push_tokens').delete().in('token', dead);
  }

  return json({ ok: true, sent, failed: tokens.length - sent, pruned: dead.length });
});
