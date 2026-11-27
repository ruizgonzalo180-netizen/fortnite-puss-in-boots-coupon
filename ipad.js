(() => {
  "use strict";
  const tablet = /iPad/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!tablet) return;

  const root = document.documentElement;
  const stage = document.getElementById("stage");
  // The installed shop already owns its window. Use the recording's native
  // frame there; switching the root into DOM fullscreen changes WebKit's viewport.
  const standalone = matchMedia("(display-mode: standalone)");
  const fullscreen = matchMedia("(display-mode: fullscreen)");
  function installed() {
    return navigator.standalone === true || standalone.matches ||
      (fullscreen.matches && !document.fullscreenElement && !document.webkitFullscreenElement);
  }
  function fitInstalledWindow() {
    root.classList.toggle("ipad-installed", installed());
  }
  fitInstalledWindow();
  window.addEventListener("pageshow", fitInstalledWindow);
  window.addEventListener("resize", fitInstalledWindow);
  standalone.addEventListener("change", fitInstalledWindow);
  fullscreen.addEventListener("change", fitInstalledWindow);
  function enterFullscreen(event) {
    if (installed()) return;
    if (!event.isTrusted || !event.target.closest("button")) return;
    stage.removeEventListener("click", enterFullscreen, true);
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    // Make the request in the original tap, before starting playback.
    try {
      if (root.requestFullscreen && document.fullscreenEnabled !== false) {
        root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      }
    } catch { /* The game already fills the available viewport. */ }
  }
  stage.addEventListener("click", enterFullscreen, true);
})();
