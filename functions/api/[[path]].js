const API_ORIGIN = "https://ps3modsglobal-community-api.madarauchiha76189.workers.dev";

export async function onRequest(context) {
  const incoming = context.request;
  const sourceUrl = new URL(incoming.url);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, API_ORIGIN);
  const headers = new Headers(incoming.headers);
  // A chamada entre Pages Function e Worker é server-to-server; não encaminhe
  // Origin do navegador, pois a resposta será entregue pelo mesmo domínio Pages.
  headers.delete("Origin");
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
