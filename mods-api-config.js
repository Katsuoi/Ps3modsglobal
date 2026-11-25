// A branch de teste usa o proxy same-origin ligado ao Worker isolado.
(function(){
  var host = window.location.hostname;
  var isPagesProject = host === "jogosmodsglobal.pages.dev" || host === "teste.jogosmodsglobal.pages.dev";
  window.PS3MODS_API_URL = isPagesProject ? "" : "https://ps3modsglobal-community-api.madarauchiha76189.workers.dev";
})();
