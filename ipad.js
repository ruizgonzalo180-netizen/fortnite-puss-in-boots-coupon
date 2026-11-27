(() => {
  "use strict";
  const tablet = /iPad/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!tablet) return;

  const root = document.documentElement;
  const stage = document.getElementById("stage");
  function enterFullscreen(event) {
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
