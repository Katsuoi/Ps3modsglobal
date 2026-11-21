(function () {
  "use strict";
  var SELECTOR = "#download-box a[data-monetag-download=\"1\"], #community-detail a[data-monetag-download=\"1\"]";
  var GATE_PATH = "/download.html";

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!link || !link.href || link.getAttribute("href") === "#") return;
    var target;
    try { target = new URL(link.href, window.location.href); } catch (error) { return; }
    if (target.protocol !== "https:" && target.protocol !== "http:") return;
    event.preventDefault();
    event.stopPropagation();
    window.location.href = GATE_PATH + "?url=" + encodeURIComponent(target.href);
  }, true);
})();