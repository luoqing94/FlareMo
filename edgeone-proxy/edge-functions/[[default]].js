const DEFAULT_ORIGIN_HOST = "flaremo.your-subdomain.workers.dev";
const TEO_PREFIX = "/.well-known/teo-verification/";

const SWR_FRESH_MS = 60_000;
const SWR_CLIENT_CACHE_CONTROL = "public, max-age=60";
const SWR_EDGE_CACHE_CONTROL = "public, max-age=60, s-maxage=3600";

const IMMUTABLE_CLIENT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const IMMUTABLE_EDGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable, s-maxage=604800";
const STATIC_CLIENT_CACHE_CONTROL = "public, max-age=86400";
const STATIC_EDGE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

const MAX_MEM_CACHE_ENTRIES = 64;
const MAX_MEM_BODY_BYTES = 512 * 1024;

// Singleflight map for deduplicating concurrent upstream requests per isolate.
const inFlight = globalThis.__flaremoInFlight || (globalThis.__flaremoInFlight = new Map());

// Bounded L1 isolate memory cache to complement caches.default for SWR routes.
const memorySwrCache = globalThis.__flaremoMemorySwrCache || (globalThis.__flaremoMemorySwrCache = new Map());

const HOP_BY_HOP_REQUEST = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const HOP_BY_HOP_RESPONSE = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const SPA_EXACT_ROUTES = new Set([
  "/",
  "/index.html",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/verify-email-change",
  "/reset",
  "/recover",
  "/setup",
  "/account",
  "/memory",
  "/projects",
  "/team-projects",
  "/capture",
  "/articles",
  "/review/daily",
  "/review/walk",
]);

const SPA_PREFIX_ROUTES = ["/memo/", "/articles/"];

const PUBLIC_SSR_EXACT_ROUTES = new Set([
  "/offline",
  "/offline.html",
  "/feed.xml",
  "/rss.xml",
  "/sitemap.xml",
  "/sitemap-articles.xml",
  "/openapi.json",
  "/api/app/branding",
  "/api/app/branding/marks/light",
  "/api/app/branding/marks/dark",
  "/api/app/branding/favicon",
]);

function normalizePath(pathname) {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function isKnownSpaPath(pathname) {
  const normalized = normalizePath(pathname);
  if (SPA_EXACT_ROUTES.has(normalized)) return true;
  return SPA_PREFIX_ROUTES.some((prefix) => normalized.startsWith(prefix));
}

function isSwrCacheablePath(pathname) {
  if (isKnownSpaPath(pathname)) return true;
  const normalized = normalizePath(pathname);
  if (PUBLIC_SSR_EXACT_ROUTES.has(normalized)) return true;
  if (normalized.startsWith("/share/") && normalized.length > "/share/".length) {
    return true;
  }
  if (
    normalized.startsWith("/article/") &&
    normalized.length > "/article/".length
  ) {
    return true;
  }
  if (
    normalized.startsWith("/api/public/shares/") &&
    !normalized.endsWith("/blob")
  ) {
    return true;
  }
  return false;
}

function isStaticAssetPath(pathname) {
  if (pathname.startsWith("/assets/") || pathname.startsWith("/brand/")) {
    return true;
  }
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/file/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/article/")
  ) {
    return false;
  }
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|webmanifest)$/i.test(
    pathname,
  );
}

function getEdgeCache() {
  try {
    if (typeof caches !== "undefined" && caches && caches.default) {
      return caches.default;
    }
  } catch {
    // Ignore when Cache API is unavailable in local build/test runners.
  }
  return null;
}

function safeWaitUntil(context, promise) {
  if (context && typeof context.waitUntil === "function") {
    try {
      context.waitUntil(promise);
      return;
    } catch {
      // Fall through if waitUntil is unavailable.
    }
  }
  promise.catch(() => {});
}

function cleanPublicVary(headers) {
  const vary = headers.get("vary");
  if (!vary) return;
  const parts = vary
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "cookie");
  if (parts.length > 0) {
    headers.set("vary", parts.join(", "));
  } else {
    headers.delete("vary");
  }
}

function buildAnonymousUpstreamHeaders(request, url, originHost) {
  const reqHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    const lower = k.toLowerCase();
    if (
      HOP_BY_HOP_REQUEST.has(lower) ||
      lower === "cookie" ||
      lower === "authorization" ||
      lower === "if-none-match" ||
      lower === "if-modified-since"
    ) {
      continue;
    }
    reqHeaders.append(k, v);
  }
  reqHeaders.set("host", originHost);
  reqHeaders.set("x-forwarded-host", url.host);
  reqHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));
  return reqHeaders;
}

function copyFilteredResponseHeaders(upstreamHeaders) {
  const respHeaders = new Headers();
  for (const [k, v] of upstreamHeaders.entries()) {
    const lower = k.toLowerCase();
    if (lower === "set-cookie") continue;
    if (!HOP_BY_HOP_RESPONSE.has(lower)) {
      respHeaders.append(k, v);
    }
  }
  cleanPublicVary(respHeaders);
  respHeaders.set("x-flaremo-edge", "edgeone-proxy");
  return respHeaders;
}

function setMemorySwrEntry(key, entry) {
  if (memorySwrCache.has(key)) {
    memorySwrCache.delete(key);
  } else if (memorySwrCache.size >= MAX_MEM_CACHE_ENTRIES) {
    const oldestKey = memorySwrCache.keys().next().value;
    if (oldestKey !== undefined) {
      memorySwrCache.delete(oldestKey);
    }
  }
  memorySwrCache.set(key, entry);
}

function responseFromMemoryEntry(entry, method, cacheStatus) {
  const headers = new Headers(entry.headers);
  headers.set("cache-control", SWR_CLIENT_CACHE_CONTROL);
  headers.set("x-eo-cache", cacheStatus);
  headers.set("x-eo-cached-at", String(entry.cachedAt));
  return new Response(method === "HEAD" ? null : entry.body.slice(0), {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
}

async function responseFromCachedResponse(cached, method, cacheStatus) {
  const headers = new Headers(cached.headers);
  headers.set("cache-control", SWR_CLIENT_CACHE_CONTROL);
  headers.set("x-eo-cache", cacheStatus);
  return new Response(method === "HEAD" ? null : cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function fetchAndStoreSwr(
  cacheKeyUrl,
  cacheKey,
  upstreamUrl,
  request,
  url,
  originHost,
) {
  const existing = inFlight.get(cacheKeyUrl);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    const cache = getEdgeCache();
    const reqHeaders = buildAnonymousUpstreamHeaders(request, url, originHost);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: reqHeaders,
      redirect: "manual",
    });

    if (upstreamResponse.status === 504 || upstreamResponse.status >= 500) {
      if (cache) {
        try {
          await cache.delete(cacheKey);
        } catch {
          // Ignore cache delete errors.
        }
      }
    }

    const respHeaders = copyFilteredResponseHeaders(upstreamResponse.headers);
    const bodyBuffer = await upstreamResponse.arrayBuffer();

    if (upstreamResponse.status === 200) {
      const cachedAt = Date.now();
      const headerPairs = Array.from(respHeaders.entries());
      if (bodyBuffer.byteLength <= MAX_MEM_BODY_BYTES) {
        setMemorySwrEntry(cacheKeyUrl, {
          body: bodyBuffer,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: headerPairs,
          cachedAt,
        });
      }

      if (cache) {
        try {
          const edgeHeaders = new Headers(headerPairs);
          edgeHeaders.set("cache-control", SWR_EDGE_CACHE_CONTROL);
          edgeHeaders.set("x-eo-cached-at", String(cachedAt));
          const toCache = new Response(bodyBuffer.slice(0), {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: edgeHeaders,
          });
          await cache.put(cacheKey, toCache);
        } catch {
          // Ignore cache put errors.
        }
      }

      return {
        Cacheable: true,
        body: bodyBuffer,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: headerPairs,
        cachedAt,
      };
    }

    return {
      Cacheable: false,
      body: bodyBuffer,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: Array.from(respHeaders.entries()),
      cachedAt: Date.now(),
    };
  })();

  inFlight.set(cacheKeyUrl, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKeyUrl);
  }
}

async function handleSwrRequest(context, request, url, originHost) {
  const method = request.method.toUpperCase();
  const isSpa = isKnownSpaPath(url.pathname);
  const cacheKeyUrl = isSpa
    ? new URL("/", url.origin).toString()
    : url.toString();
  const upstreamFetchUrl = isSpa
    ? `https://${originHost}/`
    : `https://${originHost}${url.pathname}${url.search}`;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });
  const cache = getEdgeCache();

  // 1. Check Edge Cache API (caches.default)
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedAt = Number(cached.headers.get("x-eo-cached-at") || "0");
        const ageMs = cachedAt > 0 ? Date.now() - cachedAt : 0;
        if (ageMs < SWR_FRESH_MS) {
          return responseFromCachedResponse(cached, method, "HIT-FRESH");
        }
        safeWaitUntil(
          context,
          fetchAndStoreSwr(
            cacheKeyUrl,
            cacheKey,
            upstreamFetchUrl,
            request,
            url,
            originHost,
          ),
        );
        return responseFromCachedResponse(cached, method, "HIT-STALE");
      }
    } catch {
      // Fall through to L1 memory cache or upstream fetch.
    }
  }

  // 2. Check L1 Isolate Memory Cache
  const memEntry = memorySwrCache.get(cacheKeyUrl);
  if (memEntry) {
    const ageMs = Date.now() - memEntry.cachedAt;
    if (ageMs < SWR_FRESH_MS) {
      return responseFromMemoryEntry(memEntry, method, "HIT-FRESH");
    }
    safeWaitUntil(
      context,
      fetchAndStoreSwr(
        cacheKeyUrl,
        cacheKey,
        upstreamFetchUrl,
        request,
        url,
        originHost,
      ),
    );
    return responseFromMemoryEntry(memEntry, method, "HIT-STALE");
  }

  // 3. Cache Miss -> Singleflight Upstream Fetch
  const result = await fetchAndStoreSwr(
    cacheKeyUrl,
    cacheKey,
    upstreamFetchUrl,
    request,
    url,
    originHost,
  );
  const headers = new Headers(result.headers);
  if (result.Cacheable) {
    headers.set("cache-control", SWR_CLIENT_CACHE_CONTROL);
    headers.set("x-eo-cache", "MISS");
    headers.set("x-eo-cached-at", String(result.cachedAt));
  } else {
    headers.set("cache-control", "private, no-store");
    headers.set("x-eo-cache", "MISS-PASS");
  }
  return new Response(method === "HEAD" ? null : result.body.slice(0), {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

async function handleStaticAssetRequest(context, request, url, originHost) {
  const method = request.method.toUpperCase();
  const isImmutable = url.pathname.startsWith("/assets/");
  const isServiceWorker = url.pathname === "/sw.js";
  const clientCacheControl = isServiceWorker
    ? "public, max-age=0, must-revalidate"
    : isImmutable
      ? IMMUTABLE_CLIENT_CACHE_CONTROL
      : STATIC_CLIENT_CACHE_CONTROL;
  const edgeCacheControl = isServiceWorker
    ? "public, max-age=0, must-revalidate"
    : isImmutable
      ? IMMUTABLE_EDGE_CACHE_CONTROL
      : STATIC_EDGE_CACHE_CONTROL;

  const cacheKeyUrl = url.toString();
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });
  const cache = getEdgeCache();

  if (cache && !isServiceWorker) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("cache-control", clientCacheControl);
        headers.set("x-eo-cache", "HIT-STATIC");
        return new Response(method === "HEAD" ? null : cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        });
      }
    } catch {
      // Fall through to upstream fetch.
    }
  }

  const upstreamUrl = `https://${originHost}${url.pathname}${url.search}`;
  const flightKey = `STATIC:${cacheKeyUrl}`;
  let task = inFlight.get(flightKey);
  if (!task) {
    task = (async () => {
      const reqHeaders = buildAnonymousUpstreamHeaders(
        request,
        url,
        originHost,
      );
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: reqHeaders,
        redirect: "manual",
      });
      const respHeaders = copyFilteredResponseHeaders(upstreamResponse.headers);
      const bodyBuffer = await upstreamResponse.arrayBuffer();
      const contentType = (respHeaders.get("content-type") || "").toLowerCase();
      const isHtmlFallback =
        contentType.includes("text/html") &&
        !url.pathname.endsWith(".html");
      const canCacheStatic =
        upstreamResponse.status === 200 && !isHtmlFallback && !isServiceWorker;

      if (canCacheStatic && cache) {
        safeWaitUntil(
          context,
          (async () => {
            try {
              const edgeHeaders = new Headers(respHeaders);
              edgeHeaders.set("cache-control", edgeCacheControl);
              await cache.put(
                cacheKey,
                new Response(bodyBuffer.slice(0), {
                  status: upstreamResponse.status,
                  statusText: upstreamResponse.statusText,
                  headers: edgeHeaders,
                }),
              );
            } catch {
              // Ignore cache put errors.
            }
          })(),
        );
      }

      return {
        body: bodyBuffer,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: Array.from(respHeaders.entries()),
        canCacheStatic,
      };
    })();
    inFlight.set(flightKey, task);
  }

  let result;
  try {
    result = await task;
  } finally {
    inFlight.delete(flightKey);
  }

  const headers = new Headers(result.headers);
  if (result.status === 200 && (result.canCacheStatic || isServiceWorker)) {
    headers.set("cache-control", clientCacheControl);
    headers.set("x-eo-cache", "MISS-STATIC");
  } else {
    headers.set("cache-control", "private, no-store");
    headers.set("x-eo-cache", "PASS-STATIC");
  }

  return new Response(method === "HEAD" ? null : result.body.slice(0), {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request } = context;
  const env = context.env || {};
  const originHost = env.ORIGIN_HOST || DEFAULT_ORIGIN_HOST;
  const teoBody = env.TEO_VERIFICATION || "";
  const url = new URL(request.url);

  if (
    teoBody &&
    url.pathname.startsWith(TEO_PREFIX) &&
    url.pathname.endsWith(".txt")
  ) {
    return new Response(teoBody, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const method = request.method.toUpperCase();
  const isGetOrHead = method === "GET" || method === "HEAD";
  const hasAuthHeader = request.headers.has("authorization");

  // FM-2: Static asset fallback proxy & Cache-Control override
  if (isGetOrHead && !hasAuthHeader && isStaticAssetPath(url.pathname)) {
    return handleStaticAssetRequest(context, request, url, originHost);
  }

  // FM-3 & FM-4: 60s Anonymous Edge Cache + Singleflight + context.waitUntil SWR
  if (isGetOrHead && !hasAuthHeader && isSwrCacheablePath(url.pathname)) {
    return handleSwrRequest(context, request, url, originHost);
  }

  // Public attachment blobs (/api/public/*/blob): preserve upstream public cache headers
  if (
    isGetOrHead &&
    !hasAuthHeader &&
    url.pathname.startsWith("/api/public/") &&
    url.pathname.endsWith("/blob")
  ) {
    const upstreamUrl = `https://${originHost}${url.pathname}${url.search}`;
    const reqHeaders = buildAnonymousUpstreamHeaders(request, url, originHost);
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: reqHeaders,
      redirect: "manual",
    });
    const respHeaders = copyFilteredResponseHeaders(upstreamResponse.headers);
    if (upstreamResponse.status === 200 && !respHeaders.has("cache-control")) {
      respHeaders.set("cache-control", "public, max-age=3600");
    }
    respHeaders.set("x-eo-cache", "PUBLIC-BLOB");
    return new Response(
      method === "HEAD" ? null : upstreamResponse.body,
      {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: respHeaders,
      },
    );
  }

  // Authenticated / dynamic routes and mutations: full pass-through
  const upstreamUrl = `https://${originHost}${url.pathname}${url.search}`;
  const reqHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (!HOP_BY_HOP_REQUEST.has(k.toLowerCase())) {
      reqHeaders.append(k, v);
    }
  }
  reqHeaders.set("host", originHost);
  reqHeaders.set("x-forwarded-host", url.host);
  reqHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const hasBody = method !== "GET" && method !== "HEAD";
  const needsJsonBody = method === "GET" && url.pathname.startsWith("/api/auth");
  if (needsJsonBody && !reqHeaders.has("content-type")) {
    reqHeaders.set("content-type", "application/json");
  }

  const init = {
    method,
    headers: reqHeaders,
    redirect: "manual",
    body: hasBody ? request.body : needsJsonBody ? "{}" : undefined,
  };
  if (hasBody) {
    init.duplex = "half";
  }

  const upstreamResponse = await fetch(upstreamUrl, init);

  // If a mutation succeeded on branding/articles/shares, invalidate SWR caches
  if (hasBody && upstreamResponse.ok) {
    memorySwrCache.clear();
    const cache = getEdgeCache();
    if (cache) {
      safeWaitUntil(
        context,
        Promise.allSettled([
          cache.delete(
            new Request(new URL("/", url.origin).toString(), { method: "GET" }),
          ),
          cache.delete(
            new Request(new URL("/api/app/branding", url.origin).toString(), {
              method: "GET",
            }),
          ),
          cache.delete(
            new Request(new URL("/feed.xml", url.origin).toString(), {
              method: "GET",
            }),
          ),
          cache.delete(
            new Request(
              new URL("/sitemap-articles.xml", url.origin).toString(),
              { method: "GET" },
            ),
          ),
        ]),
      );
    }
  }

  const respHeaders = new Headers();
  for (const [k, v] of upstreamResponse.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === "set-cookie") continue;
    if (!HOP_BY_HOP_RESPONSE.has(lower)) {
      respHeaders.append(k, v);
    }
  }

  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : upstreamResponse.headers.get("set-cookie")
        ? [upstreamResponse.headers.get("set-cookie")]
        : [];

  for (const sc of setCookies) {
    if (!sc) continue;
    const rewritten = sc.replace(/;\s*domain=[^;]*/gi, "");
    respHeaders.append("set-cookie", rewritten);
  }

  respHeaders.set("cache-control", "private, no-store");
  respHeaders.set("vary", "Cookie, Origin");
  respHeaders.set("x-flaremo-edge", "edgeone-proxy");
  respHeaders.set("x-eo-cache", "BYPASS");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: respHeaders,
  });
}
