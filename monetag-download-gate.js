(function () {
  "use strict";

  // Monetag Direct Link fornecido pelo proprietário do site.
  var SMARTLINK = "https://uplcm.com/4/12318732";
  var SELECTOR = "#download-box a.download, #community-detail a[data-monetag-download=\"1\"]";

  function addNotice(link) {
    var host = link.parentNode;
    if (!host || host.querySelector(".monetag-download-note")) return;
    var note = document.createElement("p");
    note.className = "monetag-download-note";
    note.setAttribute("role", "status");
    note.textContent = "Obrigado por apoiar o Jogos Mods Global. Tentamos abrir uma oferta Monetag em outra aba; agora você pode continuar para o arquivo original.";
    host.insertBefore(note, link.nextSibling);
  }

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!link || !link.href || link.getAttribute("href") === "#") return;

    if (link.getAttribute("data-monetag-ready") === "1") {
      // Segundo clique: deixa o navegador abrir o endereço original do mod.
      link.removeAttribute("data-monetag-ready");
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Abre o SmartLink somente após uma ação explícita do visitante.
    var adWindow = window.open(SMARTLINK, "_blank", "noopener,noreferrer");
    if (!adWindow) {
      // Se o navegador bloquear a nova aba, o download continua disponível
      // pelo mesmo botão, sem prender o visitante numa página intermediária.
      link.textContent = "Continuar para download";
      link.setAttribute("data-monetag-ready", "1");
      addNotice(link);
      return;
    }

    link.textContent = "Continuar para download";
    link.setAttribute("data-monetag-ready", "1");
    addNotice(link);
  }, true);

  var style = document.createElement("style");
  style.textContent = ".monetag-download-note{margin:10px 0 8px;color:#c4ceda;font-size:13px;line-height:1.55}.monetag-download-note:before{content:'✦ ';color:#c5a66a}";
  document.head.appendChild(style);
})();
