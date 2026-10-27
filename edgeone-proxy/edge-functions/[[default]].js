const DEFAULT_ORIGIN_HOST = "flaremo.your-subdomain.workers.dev";
const TEO_PREFIX = "/.well-known/teo-verification/";

const SWR_FRESH_MS = 60_000;
const SWR_STALE_MS = 600_000;
const HTML_SWR_FRESH_MS = 300_000;
const HTML_SWR_STALE_MS = 86_400_000;

const SWR_CLIENT_CACHE_CONTROL = "public, max-age=60";
const API_SWR_CLIENT_CACHE_CONTROL = "no-cache";
const SWR_EDGE_CACHE_CONTROL = "public, max-age=60, s-maxage=3600";
const HTML_SWR_EDGE_CACHE_CONTROL = "public, max-age=300, s-maxage=86400";

const IMMUTABLE_CLIENT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const IMMUTABLE_EDGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable, s-maxage=604800";
const STATIC_CLIENT_CACHE_CONTROL = "public, max-age=86400";
const STATIC_EDGE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

const MAX_MEM_CACHE_ENTRIES = 64;
const MAX_MEM_BODY_BYTES = 512 * 1024;

// Embedded clean upstream index.html shell for 0ms cold-isolate response (FM-5).
const RAW_EMBEDDED_INDEX_HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <!-- Updated by the bootstrap script below and by ThemeProvider so the\n         browser chrome / iOS status bar tracks the resolved theme. -->\n    <meta data-flaremo-theme-color name=\"theme-color\" content=\"#faf9f7\" />\n    <link\n      data-dark-href=\"/brand/flaremo-mark-dark-320.png\"\n      data-flaremo-favicon\n      data-light-href=\"/brand/flaremo-mark-light-300.png\"\n      href=\"/brand/flaremo-mark-light-300.png\"\n      rel=\"icon\"\n      type=\"image/png\"\n    />\n    <link rel=\"apple-touch-icon\" href=\"/brand/flaremo-app-icon-touch-180.png\" />\n    <link rel=\"manifest\" href=\"/site.webmanifest\" />\n    <meta name=\"mobile-web-app-capable\" content=\"yes\" />\n    <meta name=\"apple-mobile-web-app-capable\" content=\"yes\" />\n    <meta name=\"apple-mobile-web-app-title\" content=\"FlareMo\" />\n    <meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\" />\n    <title>FlareMo</title>\n    <script>\n      try {\n        const theme = localStorage.getItem(\"theme\") || \"system\";\n        const resolved =\n          theme === \"system\"\n            ? matchMedia(\"(prefers-color-scheme: dark)\").matches\n              ? \"dark\"\n              : \"light\"\n            : theme;\n        document.documentElement.classList.add(resolved);\n        const favicon = document.querySelector(\"[data-flaremo-favicon]\");\n        const faviconHref = favicon?.dataset[\n          resolved === \"dark\" ? \"darkHref\" : \"lightHref\"\n        ];\n        if (faviconHref) favicon.href = faviconHref;\n        const themeColor = document.querySelector(\n          \"[data-flaremo-theme-color]\",\n        );\n        if (themeColor) {\n          themeColor.content = resolved === \"dark\" ? \"#0d0c0b\" : \"#faf9f7\";\n        }\n      } catch {}\n      // Mirror I18nProvider's resolution (stored preference, else navigator)\n      // before first paint: `lang` picks the CJK font family per script, and\n      // `dir` keeps Arabic from painting LTR and then flipping on hydration.\n      // Keep this list in sync with the Locale union in src/i18n.tsx.\n      try {\n        const locales = [\"zh-CN\", \"en-US\", \"ja\", \"fr\", \"es\", \"ko\", \"ru\", \"ar\"];\n        const base = (value) => value.toLowerCase().split(\"-\")[0];\n        const stored = localStorage.getItem(\"flaremo.locale\");\n        let locale = locales.includes(stored) ? stored : null;\n        if (!locale) {\n          for (const candidate of navigator.languages || []) {\n            const match = locales.find((l) => base(l) === base(candidate));\n            if (match) {\n              locale = match;\n              break;\n            }\n          }\n        }\n        locale = locale || \"en-US\";\n        document.documentElement.lang = locale;\n        document.documentElement.dir = locale === \"ar\" ? \"rtl\" : \"ltr\";\n      } catch {}\n    </script>\n    <script type=\"module\" crossorigin src=\"/assets/index-p8sBN8rS.js\"></script>\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/rolldown-runtime-hePW80VL.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/vendor-react-DmxvF14L.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/vendor-tanstack-BUmIwalA.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/useScrollLock-CgrwaJPc.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/preload-helper-Czpn1I53.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/createLucideIcon-Do-r8QfX.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/CompositeItem-3yB9gnek.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/ToolbarRootContext-DK23gHZj.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/dropdown-menu-C06f0VIm.js\">\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/DialogRoot-CdO6U0y1.js\">\n    <link rel=\"stylesheet\" crossorigin href=\"/assets/index-Aud275iW.css\">\n  </head>\n  <body>\n    <!-- Marker the service worker looks for before it will cache this document\n         as the offline app shell: it proves the response is the real app rather\n         than a Cloudflare Access login or error page. -->\n    <meta name=\"flaremo-app-shell\" content=\"flaremo-app-shell\" />\n    <div id=\"root\"></div>\n  </body>\n</html>\n";

const EARLY_PREFETCH_SCRIPT = `<script id="fm-early-prefetch">(function(){try{if(typeof window==="undefined"||typeof window.fetch!=="function")return;var origFetch=window.fetch.bind(window);var inflight=new Map();var bootTs=Date.now();function normKey(input){try{var raw=typeof input==="string"?input:(input instanceof URL?input.href:(input&&typeof input.url==="string"?input.url:""));if(!raw)return null;var u=new URL(raw,location.origin);if(u.origin!==location.origin)return null;return u.pathname+u.search;}catch(e){return null;}}function startPrefetch(pathWithQuery){try{var p=origFetch(pathWithQuery,{method:"GET",credentials:"same-origin",headers:{"Accept":"application/json"}});inflight.set(pathWithQuery,p);return p;}catch(e){return null;}}var memosKey="/api/app/memos?page_size=30&order_by=created_at+desc&state=normal";var tagsKey="/api/app/tags";var meKey="/api/app/me";var tz="UTC";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch(e){}var statsKey="/api/app/stats?time_zone="+encodeURIComponent(tz)+"&days=366";startPrefetch("/api/app/branding");var sessP=startPrefetch("/api/auth/get-session");if(sessP&&typeof sessP.then==="function"){sessP.then(function(res){try{if(!res||!res.ok){localStorage.removeItem("fm_authed");inflight.delete(memosKey);inflight.delete(tagsKey);inflight.delete(meKey);inflight.delete(statsKey);return;}res.clone().json().then(function(data){try{if(data&&data.user&&data.user.id){localStorage.setItem("fm_authed","1");}else{localStorage.removeItem("fm_authed");inflight.delete(memosKey);inflight.delete(tagsKey);inflight.delete(meKey);inflight.delete(statsKey);}}catch(e){}}).catch(function(){});}catch(e){}}).catch(function(){});}try{if(location.pathname==="/"&&!location.search&&localStorage.getItem("fm_authed")==="1"){startPrefetch(memosKey);startPrefetch(tagsKey);startPrefetch(meKey);startPrefetch(statsKey);}}catch(e){}window.fetch=function(input,init){try{var method=((init&&init.method)||(typeof Request!=="undefined"&&input instanceof Request&&input.method)||"GET").toUpperCase();var key=normKey(input);if(method!=="GET"){if(key&&key.indexOf("/api/auth/")===0){inflight.clear();if(key.indexOf("sign-out")!==-1){try{localStorage.removeItem("fm_authed");}catch(e){}}}return origFetch(input,init);}if(Date.now()-bootTs<8000&&!(init&&init.signal&&init.signal.aborted)){if(key&&inflight.has(key)){var p=inflight.get(key);inflight.delete(key);return p.then(function(res){return(res&&!res.bodyUsed)?res:origFetch(input,init);},function(){return origFetch(input,init);});}}}catch(e){}return origFetch(input,init);};}catch(e){}})();</script>`;

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
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/verify-email-change",
  "/reset",
  "/reset-password",
  "/recover",
  "/setup",
  "/privacy",
  "/terms",
  "/account",
  "/memory",
  "/projects",
  "/team-projects",
  "/capture",
  "/articles",
  "/review/daily",
  "/review/walk",
]);

const SPA_PREFIX_ROUTES = ["/memo/", "/articles/", "/auth/"];

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
  "/api/auth/flaremo/bootstrap/status",
  "/api/auth/flaremo/register/status",
  "/api/app/auth-providers",
  "/api/app/plugins",
]);

export function transformHtml(html) {
  if (typeof html !== "string" || !html.includes("/assets/index-p8sBN8rS.js")) {
    return html;
  }
  let out = html;

  // FM-6: Preload zh-CN locale dictionary in <head> to eliminate sequential i18n wave before createRoot().render().
  const zhPreloadTag =
    '<link rel="modulepreload" crossorigin href="/assets/zh-CN-D_-CIQ8-.js">';
  if (!out.includes("/assets/zh-CN-D_-CIQ8-.js")) {
    const dialogAnchor =
      '<link rel="modulepreload" crossorigin href="/assets/DialogRoot-CdO6U0y1.js">';
    if (out.includes(dialogAnchor)) {
      out = out.replace(dialogAnchor, `${dialogAnchor}\n    ${zhPreloadTag}`);
    } else if (out.includes('<link rel="stylesheet"')) {
      out = out.replace(
        '<link rel="stylesheet"',
        `${zhPreloadTag}\n    <link rel="stylesheet"`,
      );
    }
  }

  // FM-7: Inject t=0ms single-use in-flight fetch prefetch before entry module script.
  if (!out.includes('id="fm-early-prefetch"')) {
    const entryScriptTag =
      '<script type="module" crossorigin src="/assets/index-p8sBN8rS.js"></script>';
    if (out.includes(entryScriptTag)) {
      out = out.replace(
        entryScriptTag,
        `${EARLY_PREFETCH_SCRIPT}\n    ${entryScriptTag}`,
      );
    }
  }

  return out;
}

const EMBEDDED_TRANSFORMED_HTML_BYTES = new TextEncoder().encode(
  transformHtml(RAW_EMBEDDED_INDEX_HTML),
);

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

function getSwrClientCacheControl(pathname) {
  return pathname.startsWith("/api/")
    ? API_SWR_CLIENT_CACHE_CONTROL
    : SWR_CLIENT_CACHE_CONTROL;
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

function responseFromMemoryEntry(entry, method, cacheStatus, clientCacheControl) {
  const headers = new Headers(entry.headers);
  headers.set("cache-control", clientCacheControl);
  headers.set("x-eo-cache", cacheStatus);
  headers.set("x-eo-cached-at", String(entry.cachedAt));
  return new Response(method === "HEAD" ? null : entry.body.slice(0), {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
}

async function responseFromCachedResponse(cached, method, cacheStatus, clientCacheControl) {
  const headers = new Headers(cached.headers);
  headers.set("cache-control", clientCacheControl);
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
  isSpa,
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
    let bodyBuffer = await upstreamResponse.arrayBuffer();
    const contentType = (respHeaders.get("content-type") || "").toLowerCase();

    if (
      upstreamResponse.status === 200 &&
      (isSpa || contentType.includes("text/html"))
    ) {
      const rawText = new TextDecoder().decode(bodyBuffer);
      const transformedText = transformHtml(rawText);
      bodyBuffer = new TextEncoder().encode(transformedText).buffer;
      respHeaders.set("content-type", "text/html; charset=utf-8");
    }

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
          edgeHeaders.set(
            "cache-control",
            isSpa ? HTML_SWR_EDGE_CACHE_CONTROL : SWR_EDGE_CACHE_CONTROL,
          );
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
  const freshMs = isSpa ? HTML_SWR_FRESH_MS : SWR_FRESH_MS;
  const staleMs = isSpa ? HTML_SWR_STALE_MS : SWR_STALE_MS;
  const clientCacheControl = getSwrClientCacheControl(url.pathname);
  const cacheKeyUrl = isSpa
    ? new URL("/", url.origin).toString()
    : url.toString();
  const upstreamFetchUrl = isSpa
    ? `https://${originHost}/`
    : `https://${originHost}${url.pathname}${url.search}`;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });
  const cache = getEdgeCache();

  // 1. Check L1 Isolate Memory Cache first (0ms synchronous)
  const memEntry = memorySwrCache.get(cacheKeyUrl);
  if (memEntry) {
    const ageMs = Date.now() - memEntry.cachedAt;
    if (ageMs < freshMs) {
      return responseFromMemoryEntry(
        memEntry,
        method,
        "HIT-FRESH",
        clientCacheControl,
      );
    }
    if (ageMs < staleMs) {
      safeWaitUntil(
        context,
        fetchAndStoreSwr(
          cacheKeyUrl,
          cacheKey,
          upstreamFetchUrl,
          request,
          url,
          originHost,
          isSpa,
        ),
      );
      return responseFromMemoryEntry(
        memEntry,
        method,
        "HIT-STALE",
        clientCacheControl,
      );
    }
  }

  // 2. FM-5: Cold isolate SPA HTML seed -> seed L1 memory cache and return
  // pre-transformed embedded shell in 0ms without blocking on originHost.
  if (isSpa) {
    const cachedAt = Date.now();
    const embeddedBuffer = EMBEDDED_TRANSFORMED_HTML_BYTES.buffer.slice(
      EMBEDDED_TRANSFORMED_HTML_BYTES.byteOffset,
      EMBEDDED_TRANSFORMED_HTML_BYTES.byteOffset +
        EMBEDDED_TRANSFORMED_HTML_BYTES.byteLength,
    );
    const headerPairs = [
      ["content-type", "text/html; charset=utf-8"],
      ["x-flaremo-edge", "edgeone-proxy"],
    ];
    setMemorySwrEntry(cacheKeyUrl, {
      body: embeddedBuffer,
      status: 200,
      statusText: "OK",
      headers: headerPairs,
      cachedAt,
    });
    const headers = new Headers(headerPairs);
    headers.set("cache-control", clientCacheControl);
    headers.set("x-eo-cache", "HIT-EMBEDDED");
    headers.set("x-eo-cached-at", String(cachedAt));
    return new Response(method === "HEAD" ? null : embeddedBuffer.slice(0), {
      status: 200,
      statusText: "OK",
      headers,
    });
  }

  // 3. Check L2 Edge Cache API (caches.default) for non-SPA SWR routes
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedAt = Number(cached.headers.get("x-eo-cached-at") || "0");
        const ageMs = cachedAt > 0 ? Date.now() - cachedAt : 0;
        if (ageMs < freshMs) {
          return responseFromCachedResponse(
            cached,
            method,
            "HIT-FRESH",
            clientCacheControl,
          );
        }
        if (ageMs < staleMs) {
          safeWaitUntil(
            context,
            fetchAndStoreSwr(
              cacheKeyUrl,
              cacheKey,
              upstreamFetchUrl,
              request,
              url,
              originHost,
              false,
            ),
          );
          return responseFromCachedResponse(
            cached,
            method,
            "HIT-STALE",
            clientCacheControl,
          );
        }
      }
    } catch {
      // Fall through to upstream fetch.
    }
  }

  // 4. Non-SPA Cache Miss -> Singleflight Upstream Fetch
  const result = await fetchAndStoreSwr(
    cacheKeyUrl,
    cacheKey,
    upstreamFetchUrl,
    request,
    url,
    originHost,
    false,
  );
  const headers = new Headers(result.headers);
  if (result.Cacheable) {
    headers.set("cache-control", clientCacheControl);
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

  // FM-3..FM-8: Anonymous Edge Cache + Embedded SPA Shell + Singleflight + waitUntil SWR
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

  // If a mutation succeeded, invalidate L1 and L2 SWR caches
  if (hasBody && upstreamResponse.ok) {
    memorySwrCache.clear();
    const cache = getEdgeCache();
    if (cache) {
      const pathsToClear = ["/", ...PUBLIC_SSR_EXACT_ROUTES];
      safeWaitUntil(
        context,
        Promise.allSettled(
          pathsToClear.map((p) =>
            cache.delete(
              new Request(new URL(p, url.origin).toString(), { method: "GET" }),
            ),
          ),
        ),
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
