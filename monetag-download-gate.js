(function () {
  "use strict";
  var SELECTOR = "#download-box a[data-monetag-download=\"1\"], #community-detail a[data-monetag-download=\"1\"]";
  var GATE_URL = "https://jogosmodsglobal.pages.dev/download.html";

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!link || !link.href || link.getAttribute("href") === "#") return;
    var target;
    try { target = new URL(link.href, window.location.href); } catch (error) { return; }
    if (target.protocol !== "https:" && target.protocol !== "http:") return;
    event.preventDefault();
    event.stopPropagation();
    var modId = link.getAttribute("data-mod-id") || "";
    var name = link.textContent || "Download";
    var query = "?url=" + encodeURIComponent(target.href) + "&mod=" + encodeURIComponent(modId) + "&name=" + encodeURIComponent(name);
    window.location.href = GATE_URL + query;
  }, true);
})();