const SITE = "https://jogosmodsglobal.pages.dev";
const API = "https://ps3modsglobal-community-api.madarauchiha76189.workers.dev";
function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
export async function onRequest() {
  const urls = ["/", "/mods/index.html", "/mods/categorias.html", "/tutoriais.html", "/contato.html", "/enviar-mod.html"];
  for (let id = 1; id <= 61; id++) urls.push("/mods/mod.html?id=" + id);
  try {
    const response = await fetch(API + "/api/mods", {
      headers: { "Origin": "https://katsuoi.github.io", "Accept": "application/json" }
    });
    if (response.ok) {
      const data = await response.json();
      (Array.isArray(data.items) ? data.items : []).forEach(function(mod) {
        if (mod && mod.id !== undefined && mod.id !== null) urls.push("/mod-comunidade.html?id=" + encodeURIComponent(mod.id));
      });
    }
  } catch (error) {
    // Mantém as páginas estáticas no sitemap se a API estiver indisponível.
  }
  const unique = Array.from(new Set(urls));
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique.map(function(path) { return "  <url><loc>" + xmlEscape(SITE + path) + "</loc></url>"; }).join("\n") +
    "\n</urlset>";
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
