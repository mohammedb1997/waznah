/**
 * وزنة — Admin BFF for Cloudflare Workers
 *
 * Secrets:
 *   PB_URL            = https://your-pocketbase.example.com
 *   ALLOWED_ORIGINS   = https://mohammedb1997.github.io,https://www.waznah.com
 *   COOKIE_NAME       = WZ_ADMIN_SESSION (optional)
 *   COOKIE_SAMESITE   = Strict | Lax | None (default: Strict)
 *
 * Purpose:
 *   1) Authenticate the PocketBase superuser on the server.
 *   2) Keep the PocketBase bearer token out of browser JavaScript/storage.
 *   3) Proxy only /api/* requests after checking the HttpOnly session cookie.
 */

const DEFAULT_COOKIE = 'WZ_ADMIN_SESSION';

function json(data, status = 200, origin = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers['vary'] = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Accept,X-Requested-With',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}

function parseCookies(cookieHeader) {
  const out = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function pbBase(env) {
  return String(env.PB_URL || '').replace(/\/$/, '');
}

function safePath(pathname) {
  // Only proxy PocketBase API paths. Never expose arbitrary worker URLs.
  return pathname.startsWith('/api/') || pathname === '/api' ? pathname : null;
}

async function authenticate(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return json({ message: 'طلب دخول غير صالح.' }, 400, origin); }
  const identity = String(body.identity || '').trim();
  const password = String(body.password || '');
  if (!identity || !password) return json({ message: 'بيانات الدخول ناقصة.' }, 400, origin);

  const base = pbBase(env);
  if (!base) return json({ message: 'PB_URL غير مضبوط في Worker.' }, 500, origin);

  const endpoints = [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password',
  ];

  let lastStatus = 401;
  for (const path of endpoints) {
    try {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ identity, password }),
      });
      if (res.ok) {
        const data = await res.json();
        const token = String(data.token || '');
        if (!token) return json({ message: 'الخادم لم يُرجع جلسة صالحة.' }, 502, origin);
        const cookieName = env.COOKIE_NAME || DEFAULT_COOKIE;
        const sameSite = String(env.COOKIE_SAMESITE || 'Strict');
        if (!['Strict', 'Lax', 'None'].includes(sameSite)) {
          return json({ message: 'COOKIE_SAMESITE غير صالح في Worker.' }, 500, origin);
        }
        const secureAttrs = [
          `${cookieName}=${encodeURIComponent(token)}`,
          'Path=/', 'HttpOnly', 'Secure', `SameSite=${sameSite}`,
          'Max-Age=1800',
        ].join('; ');
        const headers = { ...corsHeaders(origin), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': secureAttrs };
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
      lastStatus = res.status;
    } catch (_) {
      lastStatus = 502;
    }
  }
  return json({ message: lastStatus === 401 ? 'بيانات الدخول غير صحيحة.' : 'تعذّر الاتصال بPocketBase.' }, lastStatus, origin);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'PATCH' && request.method !== 'PUT' && request.method !== 'DELETE') {
      return json({ message: 'Method not allowed' }, 405, origin);
    }
    const hasOrigin = request.headers.has('Origin');
    if (hasOrigin && !origin) return new Response('Forbidden origin', { status: 403 });
    // جميع العمليات الحساسة يجب أن تأتي من Origin معروف. هذا يمنع CSRF
    // حتى عندما تكون جلسة الإدارة داخل Cookie HttpOnly.
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method) && !origin) {
      return new Response('Missing or forbidden Origin', { status: 403 });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'waznah-admin-bff' }, 200, origin);
    if (url.pathname === '/auth' && request.method === 'POST') return authenticate(request, env, origin);
    if (url.pathname === '/logout') {
      const cookieName = env.COOKIE_NAME || DEFAULT_COOKIE;
      const sameSite = String(env.COOKIE_SAMESITE || 'Strict');
      const headers = { ...corsHeaders(origin), 'set-cookie': `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=0`, 'content-type': 'application/json; charset=utf-8' };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    const path = safePath(url.pathname);
    if (!path) return json({ message: 'Not found' }, 404, origin);

    const cookies = parseCookies(request.headers.get('Cookie'));
    const cookieName = env.COOKIE_NAME || DEFAULT_COOKIE;
    const token = cookies[cookieName];
    if (!token) return json({ message: 'انتهت جلسة الإدارة.' }, 401, origin);

    const base = pbBase(env);
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${decodeURIComponent(token)}`);
    headers.delete('cookie');
    headers.delete('origin');
    headers.delete('host');

    const upstream = await fetch(base + path + url.search, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    const out = new Response(upstream.body, upstream);
    Object.entries(corsHeaders(origin || '')).forEach(([k, v]) => { if (origin) out.headers.set(k, v); });
    out.headers.set('cache-control', 'no-store');
    out.headers.set('x-content-type-options', 'nosniff');
    return out;
  },
};
