// Usa proxy same-origin no Cloudflare Pages para evitar bloqueio CORS no novo endereço.
// O GitHub Pages antigo continua falando diretamente com o Worker até a migração ser validada.
(function(){
  var host = window.location.hostname;
  var isNewPages = host === "jogosmodsglobal.pages.dev";
  window.PS3MODS_API_URL = isNewPages ? "" : "https://ps3modsglobal-community-api.madarauchiha76189.workers.dev";
})();
