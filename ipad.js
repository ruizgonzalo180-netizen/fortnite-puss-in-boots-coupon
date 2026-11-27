(() => {
  "use strict";
  const isIPad = /iPad/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIPad) return;

  const root = document.documentElement;
  const stage = document.getElementById("stage");
  const theme = document.querySelector('meta[name="theme-color"]');
  const standalone = matchMedia("(display-mode: standalone)");
  const displayFullscreen = matchMedia("(display-mode: fullscreen)");
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const openedFromHome = navigator.standalone === true || standalone.matches || displayFullscreen.matches;
  let fullscreenUnavailable = false;

  function updateChrome() {
    // A Safari tab can hand the entire display to the game. Keep the recorded
    // framing in that case. A Home Screen window can retain its native overlay.
    const screenMatches = (w, h) => Math.abs(innerWidth - w) <= 1 && Math.abs(innerHeight - h) <= 1;
    const wholeScreen = screenMatches(screen.width, screen.height) || screenMatches(screen.height, screen.width);
    const nativeTop = parseFloat(getComputedStyle(root).getPropertyValue("--ipad-native-top")) || 0;
    const protect = openedFromHome || standalone.matches || fullscreenUnavailable ||
      (Boolean(fullscreenElement()) && (!wholeScreen || nativeTop > 0));
    root.classList.toggle("ipad-protected-top", protect);
  }

  function openGame(event) {
    if (!event.isTrusted || !event.target.closest("button")) return;
    stage.removeEventListener("click", openGame, true);
    if (fullscreenElement()) return;
    // Keep this in the icon's tap. Awaiting the launch movie consumes user activation.
    // Fullscreen the root so that the reward dialog remains in the same document surface.
    function useWindow() {
      fullscreenUnavailable = true;
      updateChrome();
    }
    try {
      if (root.requestFullscreen && document.fullscreenEnabled !== false) {
        const request = root.requestFullscreen({ navigationUI: "hide" });
        request?.then(updateChrome, useWindow);
      } else if (root.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false) {
        root.webkitRequestFullscreen();
      } else {
        useWindow();
      }
    } catch { useWindow(); }
  }
  stage.addEventListener("click", openGame, true);
  document.addEventListener("fullscreenchange", updateChrome);
  document.addEventListener("webkitfullscreenchange", updateChrome);
  document.addEventListener("webkitfullscreenerror", () => {
    fullscreenUnavailable = true;
    updateChrome();
  });
  window.addEventListener("pageshow", updateChrome);
  window.addEventListener("resize", updateChrome);
  updateChrome();

  // Match the two outside rows of the artwork on shells that paint beyond the web view.
  const edges = {
    home: ["#051645", "#020426"], launch: ["#171717", "#171717"],
    discover: ["#120718", "#0b0426"], lobby: ["#030618", "#d46a00"],
    wheel: ["#272637", "#5c4026"], catalog: ["#012c64", "#01336b"],
    detail: ["#021535", "#011f43"], locker: ["#052b53", "#063666"],
    reward: ["#021b49", "#02295d"]
  };
  window.ShopIPadDisplay = {
    setScene(name) {
      const [top, bottom] = edges[name === "dance" ? "lobby" : name] || edges.home;
      theme.content = top;
      root.style.setProperty("--game-floor", bottom);
    }
  };
})();
