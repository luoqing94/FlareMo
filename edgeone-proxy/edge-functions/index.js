const ORIGIN_HOST = 'flaremo.lq280657463.workers.dev';
const ORIGIN = `https://${ORIGIN_HOST}`;

const HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length',
]);

function shouldNoStore(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth')) return true;
  if (pathname === '/setup' || pathname === '/login' || pathname === '/logout') return true;
  if (pathname.startsWith('/rpc') || pathname.startsWith('/connect')) return true;
  // SPA shell and HTML navigations should not be edge-cached aggressively
  if (pathname === '/' || pathname.endsWith('.html')) return true;
  return false;
}

export default async function onRequest(context) {
  const { request } = context;
  const inbound = new URL(request.url);

  // Serve EO domain ownership verification from ASSETS when present
  const verifies = {
    '/.well-known/teo-verification/5fez15h45z.txt': 'xay6dlsb8fx4den0v9aos15d8848eovc',
  };
  if (verifies[inbound.pathname]) {
    return new Response(verifies[inbound.pathname], {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (inbound.pathname.startsWith('/.well-known/')) {
    try {
      const local = await context.env.ASSETS?.fetch?.(request);
      if (local && local.status === 200) return local;
    } catch (_) {}
  }

  const targetUrl = ORIGIN + inbound.pathname + inbound.search;
  const method = (request.method || 'GET').toUpperCase();
  const isBodyless = method === 'GET' || method === 'HEAD';

  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const lk = k.toLowerCase();
    if (HOP.has(lk)) continue;
    if (isBodyless && lk === 'content-length') continue;
    headers.append(k, v);
  }
  headers.set('host', ORIGIN_HOST);
  headers.set('x-forwarded-host', inbound.host);
  headers.set('x-forwarded-proto', inbound.protocol.replace(':', ''));
  if (!headers.has('x-forwarded-for')) {
    const ip = request.headers.get('eo-connecting-ip')
      || request.headers.get('cf-connecting-ip')
      || request.headers.get('x-real-ip')
      || '';
    if (ip) headers.set('x-forwarded-for', ip);
  }

  let upstream;
  try {
    if (isBodyless) {
      // EdgeOne often attaches an empty body on GET. Better Auth then sees
      // Content-Type: application/json + empty body → 400, or no CT → 415.
      // A literal "{}" body is accepted (verified against workers.dev).
      const needsJsonBody = inbound.pathname.startsWith('/api/auth')
        || (headers.get('content-type') || '').includes('application/json');
      if (needsJsonBody) {
        headers.set('content-type', 'application/json');
        // EdgeOne strips GET bodies unless duplex is set (same as undici/CF).
        const init = {
          method,
          headers,
          body: '{}',
          redirect: 'manual',
        };
        try { init.duplex = 'half'; } catch (_) {}
        upstream = await fetch(targetUrl, init);
      } else {
        upstream = await fetch(targetUrl, {
          method,
          headers,
          redirect: 'manual',
        });
      }
    } else {
      upstream = await fetch(targetUrl, {
        method,
        headers,
        body: request.body,
        redirect: 'manual',
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'origin_fetch_failed', detail: String(err) }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }

  function rewriteUpstreamValue(v) {
    return String(v)
      .split(ORIGIN).join(inbound.origin)
      .split(`https://${ORIGIN_HOST}`).join(inbound.origin)
      .split(ORIGIN_HOST).join(inbound.host);
  }

  const out = new Headers();
  // Fetch Headers often combine Set-Cookie with commas (breaks Expires=..., and
  // merges multiple cookies). Use getSetCookie() so each cookie stays its own header.
  const setCookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : [];
  for (const raw of setCookies) {
    out.append('set-cookie', rewriteUpstreamValue(raw));
  }

  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (lk === 'transfer-encoding' || lk === 'content-encoding') continue;
    if (lk === 'set-cookie') {
      if (setCookies.length) continue;
      out.append(k, rewriteUpstreamValue(v));
      continue;
    }
    if (lk === 'location') {
      out.append(k, rewriteUpstreamValue(v));
      continue;
    }
    out.append(k, v);
  }

  if (shouldNoStore(inbound.pathname)) {
    out.set('cache-control', 'private, no-store');
    out.set('vary', 'Cookie, Origin');
  }

  out.set('x-flaremo-edge', 'edgeone-proxy');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
