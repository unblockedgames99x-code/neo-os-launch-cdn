const PROXY_ROUTE_MARKER = "/browse-v69/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function proxiedResourceTarget(requestUrl) {
  const markerIndex = requestUrl.pathname.lastIndexOf(PROXY_ROUTE_MARKER);
  if (markerIndex < 0) return null;
  try {
    let decoded = decodeURIComponent(requestUrl.pathname.slice(markerIndex + PROXY_ROUTE_MARKER.length));
    decoded = decoded.replace(/^(https?):\/(?!\/)/i, "$1://");
    const target = new URL(decoded);
    return /^https?:$/.test(target.protocol) ? target : null;
  } catch (error) {
    return null;
  }
}

async function fetchProxiedResource(request, target) {
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "if-modified-since", "if-none-match", "if-range", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(target.href, {
    method: request.method,
    headers,
    credentials: "omit",
    redirect: "follow",
    cache: request.cache === "only-if-cached" ? "default" : request.cache,
  });
  const responseHeaders = new Headers(upstream.headers);
  for (const name of ["content-encoding", "content-security-policy", "cross-origin-resource-policy", "set-cookie", "transfer-encoding"]) {
    responseHeaders.delete(name);
  }
  responseHeaders.set("x-neo-resource-proxy", "launcher-service-worker");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

self.addEventListener("fetch", (event) => {
  const target = proxiedResourceTarget(new URL(event.request.url));
  if (!target || !["GET", "HEAD"].includes(event.request.method)) return;
  event.respondWith(fetchProxiedResource(event.request, target));
});
