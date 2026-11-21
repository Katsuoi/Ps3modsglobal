(function () {
  "use strict";
  var SMARTLINK = "https://uplcm.com/4/12318732";
  var SELECTOR = "#download-box a[data-monetag-download=\"1\"], #community-detail a[data-monetag-download=\"1\"]";
  var STORAGE_PREFIX = "ps3mods_monetag_opened:";

  function wasOpened(link) {
    try { return sessionStorage.getItem(STORAGE_PREFIX + link.href) === "1"; }
    catch (error) { return link.getAttribute("data-monetag-done") === "1"; }
  }

  function markOpened(link) {
    link.setAttribute("data-monetag-done", "1");
    try { sessionStorage.setItem(STORAGE_PREFIX + link.href, "1"); } catch (error) {}
  }

  function addNotice(link) {
    var host = link.parentNode;
    if (!host || host.querySelector(".monetag-download-note")) return;
    var note = document.createElement("p");
    note.className = "monetag-download-note";
    note.setAttribute("role", "status");
    note.textContent = "A Monetag já foi aberta nesta sessão. Clique novamente para acessar o link de download.";
    host.insertBefore(note, link.nextSibling);
  }

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!link || !link.href || link.getAttribute("href") === "#") return;

    // A Monetag é aberta apenas uma vez por link em cada sessão do navegador.
    if (link.getAttribute("data-monetag-done") === "1" || wasOpened(link)) {
      link.setAttribute("data-monetag-done", "1");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    markOpened(link);
    window.open(SMARTLINK, "_blank", "noopener,noreferrer");
    link.textContent = "Continuar para download";
    addNotice(link);
  }, true);

  var style = document.createElement("style");
  style.textContent = ".monetag-download-note{margin:10px 0 8px;color:#c4ceda;font-size:13px;line-height:1.55}.monetag-download-note:before{content:'✦ ';color:#c5a66a}";
  document.head.appendChild(style);
})();
