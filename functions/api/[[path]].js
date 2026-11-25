const API_ORIGIN = "https://ps3modsglobal-community-api-test.madarauchiha76189.workers.dev";
const TRUSTED_SITE_ORIGIN = "https://teste.jogosmodsglobal.pages.dev";
const WORKER_ALLOWED_ORIGIN = "https://teste.jogosmodsglobal.pages.dev";

export async function onRequest(context) {
  const incoming = context.request;
  const browserOrigin = incoming.headers.get("Origin");

  if (browserOrigin && browserOrigin !== TRUSTED_SITE_ORIGIN) {
    return Response.json({ error: "Origem não autorizada" }, { status: 403 });
  }

  const sourceUrl = new URL(incoming.url);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, API_ORIGIN);
  const headers = new Headers(incoming.headers);
  headers.set("Origin", WORKER_ALLOWED_ORIGIN);
  headers.delete("Host");

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual"
  };
  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    init.body = incoming.body;
  }

  const upstream = await fetch(new Request(targetUrl.toString(), init));
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}
